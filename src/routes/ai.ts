import express from "express";
import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { generateSchema } from "../ai/pipelines/create-pipeline.ts";
import { ok, fail, RespCode, type RespCodeValue } from "../utils/response.ts";

const router = express.Router();

// step 模式通过 SSE 持续返回生成进度，full 模式等待任务完整执行后再返回。
const VALID_MODE = new Set(["step", "full"]);

// 参数校验成功后使用的统一结构，供 GET、POST 两个入口复用。
interface GenerateParamsSuccess {
	ok: true;
	prompt: string;
	mode: string;
	sessionId: string;
	pageId: string | null;
	existingComponents: any[];
}

interface GenerateParamsError {
	ok: false;
	message: string;
	code: RespCodeValue;
	status: number;
}

type GenerateParams = GenerateParamsSuccess | GenerateParamsError;

/**
 * 解析并校验 Schema 生成参数。
 * GET 请求传入 req.query，POST 请求传入 req.body；缺少会话 ID 时自动创建新会话。
 */
function parseGenerateParams(source: any): GenerateParams {
	const prompt = source?.prompt;
	const mode = source?.mode ?? "step";
	// 生成一个唯一的会话 ID，便于客户端在多次请求中关联同一会话。
	const sessionId = source?.sessionId || nanoid();
	const pageId = source?.pageId || null;

	let existingComponents: any[] = [];
	try {
		if (source?.existingComponents) {
			// 查询参数中的组件列表以 JSON 字符串传输，进入流水线前还原为数组。
			existingComponents = JSON.parse(source.existingComponents);
		}
	} catch {
		// 解析失败则忽略，使用空数组
	}

	if (!prompt) {
		return {
			ok: false,
			message: "prompt 不能为空",
			code: RespCode.VALIDATION,
			status: 400,
		};
	}
	if (!VALID_MODE.has(mode)) {
		return {
			ok: false,
			message: "mode 不合法，应为 step/full",
			code: RespCode.VALIDATION,
			status: 400,
		};
	}
	return {
		ok: true,
		prompt, // 用户的提示词
		mode, // 用户要求的生成模式
		sessionId, // 会话 ID
		pageId, // 页面 ID
		existingComponents
	};
}

interface SSEParams {
	prompt: string;
	mode: string;
	sessionId: string;
	pageId: string | null;
	existingComponents: any[];
}

/**
 * 以 SSE 方式执行 Schema 生成，并将流水线进度原样转发给客户端。
 * 客户端断开连接时会同步中止下游任务，避免无效计算继续占用资源。
 */
async function handleGenerateSchemaSSE(
	req: Request,
	res: Response,
	{ prompt, mode, sessionId, pageId, existingComponents }: SSEParams
) {
	const abortController = new AbortController();
	// 防止断连、异常和 finally 多条路径重复写入或关闭响应。
	let closed = false;

	// SSE 响应必须禁用缓存并保持长连接。
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.flushHeaders?.();
	// 定义一个 send 函数，统一格式化事件并写入响应流。
	const send = (event: string, data: unknown) => {
		if (closed) return;
		// 每个事件由 event/data 两行组成，空行表示本次事件结束。
		res.write(`event: ${event}\n`);
		res.write(`data: ${JSON.stringify(data)}\n\n`);
	};

	const finish = () => {
		if (closed) return;
		closed = true;
		// 结束响应前可选地发送一个空事件，确保客户端收到完整的 SSE 流。
		res.end();
	};

	const closeHandler = () => {
		// 将 HTTP 连接生命周期传递给 AI 流水线。
		abortController.abort();
		finish();
	};
	req.on("close", closeHandler);
	// 在流水线开始前发送一个 start 事件，告知客户端生成已启动。
	send("start", { mode, sessionId });

	try {
		await generateSchema({
			userPrompt: prompt,
			mode,
			sessionId,
			pageId,
			existingComponents,
			abortSignal: abortController.signal,
			onProgress: send,
		});
		send("end", { ok: true, sessionId });
	} catch (err: any) {
		if (err?.name === "AbortError") {
			send("end", { ok: false, cancelled: true });
		} else {
			send("error", { message: err?.message || "生成失败，请稍后重试" });
			send("end", { ok: false });
		}
	} finally {
		// 无论成功、失败还是取消，都移除监听器并确保响应只结束一次。
		req.off("close", closeHandler);
		finish();
	}
}

// GET 入口兼容通过查询参数发起生成的客户端。
router.get("/schema/generate", async (req: Request, res: Response) => {
	// 先解析参数，避免在流水线中出现未定义的值。
	const parsed = parseGenerateParams(req.query);
	if (!parsed.ok) {
		return fail(res, parsed.message, parsed.code, parsed.status);
	}

	const { prompt, mode, sessionId, pageId, existingComponents } = parsed;
	try {
		// step 模式保持连接并持续推送进度；full 模式仅返回最终执行结果。
		if (mode === "step") {
			return await handleGenerateSchemaSSE(req, res, {
				prompt,
				mode,
				sessionId,
				pageId,
				existingComponents,
			});
		}
		await generateSchema({
			userPrompt: prompt,
			mode,
			sessionId,
			pageId,
			existingComponents,
		});
		return ok(res, { sessionId }, "生成成功");
	} catch (err: any) {
		console.error("[ai/schema/generate][GET] error", err);
		const message = err?.message || "生成失败，请稍后重试";
		return fail(res, message, RespCode.SERVER_ERROR, 500);
	}
});

// POST 入口适合在请求体中携带较大的 prompt 或组件快照。
router.post("/schema/generate", async (req: Request, res: Response) => {
	const parsed = parseGenerateParams(req.body);
	if (!parsed.ok) {
		return fail(res, parsed.message, parsed.code, parsed.status);
	}
	const { prompt, mode, sessionId, pageId, existingComponents } = parsed;

	try {
		if (mode === "step") {
			return await handleGenerateSchemaSSE(req, res, {
				prompt,
				mode,
				sessionId,
				pageId,
				existingComponents,
			});
		} else {
			await generateSchema({
				userPrompt: prompt,
				mode,
				sessionId,
				pageId,
				existingComponents,
			});
		}
		return ok(res, { sessionId }, "生成成功");
	} catch (err: any) {
		console.error("[ai/schema/generate] error", err);
		const message = err?.message || "生成失败，请稍后重试";
		return fail(res, message, RespCode.SERVER_ERROR, 500);
	}
});

export default router;
