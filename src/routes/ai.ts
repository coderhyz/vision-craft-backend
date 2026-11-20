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
		const raw = source?.existingComponents;

		if (Array.isArray(raw)) {
			// 新版 POST：直接传数组
			existingComponents = raw;
		} else if (typeof raw === "string" && raw.trim()) {
			// 兼容旧版 GET：JSON 字符串
			const parsed = JSON.parse(raw);

			if (!Array.isArray(parsed)) {
				throw new Error("existingComponents 不是数组");
			}

			existingComponents = parsed;
		} else if (
			raw !== undefined &&
			raw !== null &&
			raw !== ""
		) {
			throw new Error("existingComponents 格式错误");
		}
	} catch {
		return {
			ok: false,
			message: "existingComponents 必须是数组或 JSON 数组字符串",
			code: RespCode.VALIDATION,
			status: 400,
		};
	}
	return {
		ok: true,
		prompt,
		mode,
		sessionId,
		pageId,
		existingComponents,
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
	_req: Request,
	res: Response,
	{
		prompt,
		mode,
		sessionId,
		pageId,
		existingComponents,
	}: SSEParams
) {
	// 1. 控制本次 Agent 执行的取消
	const abortController = new AbortController();

	let closed = false;

	// 2. SSE 响应头
	res.status(200);
	res.setHeader(
		"Content-Type",
		"text/event-stream; charset=utf-8"
	);
	res.setHeader(
		"Cache-Control",
		"no-cache, no-transform"
	);
	res.setHeader("Connection", "keep-alive");

	// 避免 Nginx 缓冲整个流
	res.setHeader("X-Accel-Buffering", "no");

	// 尽早把响应头发送给客户端
	res.flushHeaders?.();

	// 3. 统一发送 SSE 事件
	const send = (event: string, data: unknown) => {
		if (
			closed ||
			res.destroyed ||
			res.writableEnded
		) {
			return;
		}

		res.write(
			`event: ${event}\n` +
			`data: ${JSON.stringify(data)}\n\n`
		);
	};

	// 4. 检测客户端断开
	const onDisconnect = () => {
		if (closed || res.writableEnded) return;

		closed = true;

		// 将取消信号传递给 Agent Pipeline
		abortController.abort();

		console.log(
			`[SSE] 客户端已断开：${sessionId}`
		);
	};

	// 监听响应关闭，而非请求体读取结束
	res.once("close", onDisconnect);

	// 5. 结束 SSE 响应
	const finish = () => {
		if (closed) return;

		closed = true;

		if (!res.destroyed && !res.writableEnded) {
			res.end();
		}
	};

	// 6. 心跳，避免长时间没有事件时连接空闲
	const heartbeat = setInterval(() => {
		if (
			!closed &&
			!res.destroyed &&
			!res.writableEnded
		) {
			// SSE 注释事件，前端解析器会自动忽略
			res.write(": ping\n\n");
		}
	}, 15000);

	// 7. 通知前端生成开始
	send("start", {
		mode,
		sessionId,
	});

	try {
		// 8. 执行原有的 AI Schema Pipeline
		await generateSchema({
			userPrompt: prompt,
			mode,
			sessionId,
			pageId,
			existingComponents,

			// 关键：把 AbortSignal 传给 Pipeline
			abortSignal: abortController.signal,

			// 原有 Pipeline 的事件直接写入 SSE
			onProgress: send,
		});

		// 9. 正常结束
		if (!abortController.signal.aborted) {
			send("end", {
				ok: true,
				sessionId,
			});
		}
	} catch (error: unknown) {
		const isAbort =
			abortController.signal.aborted ||
			(
				error instanceof Error &&
				error.name === "AbortError"
			);

		if (isAbort) {
			send("end", {
				ok: false,
				cancelled: true,
			});
		} else {
			const message =
				error instanceof Error
					? error.message
					: "生成失败，请稍后重试";

			console.error("[SSE] AI 生成失败", error);

			send("error", { message });
			send("end", { ok: false });
		}
	} finally {
		// 10. 释放资源
		clearInterval(heartbeat);
		res.off("close", onDisconnect);

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
