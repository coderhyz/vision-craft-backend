import { buildUserMessage, buildComponentManifest } from "../prompt.ts";
import { COMPONENT_TYPES } from "../schema.ts";
import { agent, reasoningModel } from "../agents/create-agent.ts";
import { makeCacheKey, getCache, setCache } from "../cache.ts";
import { createAbortGuard } from "../abort-guard.ts";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { nanoid } from "nanoid";
// [memory] checkpointer + summarizationMiddleware 已在 agent.js 中统一管理历史，无需手动维护
// import { getHistory, pushToHistory } from "../memory.js";
// import { HumanMessage, AIMessage } from "@langchain/core/messages";

const COMPONENT_TOOL_LABELS: Record<string, string> = {
	text: "文本",
	image: "图片",
	button: "按钮",
	clock: "时钟",
	statistic_card: "统计卡片",
	progress_bar: "进度条",
	countdown: "倒计时",
	container: "容器",
	divider: "分割线",
	badge: "徽标",
	tag: "标签",
	avatar: "头像",
	rate: "评分",
	switch: "开关",
	bar_chart: "柱状图",
	multi_bar_chart: "多序列柱状图",
	line_chart: "折线图",
	area_chart: "面积图",
	multi_line_chart: "多序列折线图",
	scatter_chart: "散点图",
	bubble_chart: "气泡图",
	horizontal_bar_chart: "横向柱状图",
	pie_chart: "饼图",
	rose_pie_chart: "玫瑰图",
	radar_chart: "雷达图",
	funnel_chart: "漏斗图",
	gauge_chart: "仪表盘",
	treemap_chart: "矩形树图",
};

function getToolLabel(toolName: string) {
	if (toolName === "get_component_palette") return "读取可用组件清单";
	if (toolName === "update_page_config") return "更新页面配置";

	const componentName = toolName.match(/^create_(.+)_component$/)?.[1];
	if (componentName) {
		return `创建${COMPONENT_TOOL_LABELS[componentName] || componentName}组件`;
	}
	return toolName;
}

function parseJsonValue(value: unknown): any {
	if (typeof value !== "string") return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function summarizeToolInput(input: unknown): string {
	const value = parseJsonValue(input);
	if (!value || typeof value !== "object") return "按规划参数执行";

	const params = value as Record<string, any>;
	const details: string[] = [];
	if (params.name) details.push(`名称：${params.name}`);
	if (params.id) details.push(`目标：${params.id}`);
	if (params.style) {
		const { left, top, width, height } = params.style;
		if ([left, top, width, height].some((item) => typeof item === "number")) {
			details.push(`布局：(${left ?? "-"}, ${top ?? "-"}) ${width ?? "-"}×${height ?? "-"}`);
		}
	}
	if (params.backgroundImageQuery) details.push(`搜索背景：${params.backgroundImageQuery}`);
	if (params.props || params.settings) {
		const fields = [...Object.keys(params.props || {}), ...Object.keys(params.settings || {})];
		if (fields.length > 0) details.push(`配置：${fields.join("、")}`);
	}
	return details.join("；") || "按规划参数执行";
}

function summarizeToolResult(toolName: string, output: any): string {
	if (toolName === "get_component_palette") {
		return `已读取 ${output?.components?.length || 0} 种可用组件`;
	}
	if (toolName === "update_page_config") return "页面配置已更新";
	if (output?.type) return `${output.name || output.type} 已通过 Schema 校验`;
	return "工具执行完成";
}

function getTextContent(content: unknown): string {
	if (typeof content === "string") return content.trim();
	if (!Array.isArray(content)) return "";
	return content
		.map((block) => {
			if (typeof block === "string") return block;
			if (block && typeof block === "object" && "text" in block) {
				return String((block as { text: unknown }).text || "");
			}
			return "";
		})
		.join("")
		.trim();
}

interface GenerateSchemaParams {
	userPrompt?: string;
	mode?: string;
	sessionId?: string;
	pageId?: string | null;
	existingComponents?: any[];
	abortSignal?: AbortSignal;
	/**
	 * Pipeline 与路由之间的事件出口。
	 * routes/ai.ts 会把这里产生的事件转换为 SSE，前端 useAIGenerate 再按事件名消费。
	 */
	onProgress?: (event: string, data: unknown) => void;
}

/**
 * 生成或修改页面 Schema 的核心流水线。
 *
 * 数据链路：
 * 1. 推送需求分析和规划进度；
 * 2. reasoningModel 生成执行计划；
 * 3. Agent 根据计划调用组件工具；
 * 4. 将思考、工具状态和可渲染结果通过 onProgress 逐步交给路由；
 * 5. 路由将事件编码成 SSE，前端最终通过 schema-store 更新画布。
 *
 * 注意：本函数不会直接返回完整 Schema。真正用于更新画布的数据通过
 * `onProgress("ai_chunk", { chunk })` 增量发送；正常结束后的 `end` 事件由路由发送。
 */
export async function generateSchema({
	userPrompt = "智慧园区运营大屏，显示园区概览、能耗、客流、工单",
	mode = "step",
	sessionId = "default",
	pageId = null,
	existingComponents = [],
	abortSignal,
	onProgress,
}: GenerateSchemaParams) {
	if (!userPrompt) {
		throw new Error("userPrompt 不能为空");
	}
	// 统一管理取消状态：在阶段切换和异步调用期间及时响应前端的“停止生成”。
	const guard = createAbortGuard(abortSignal);

	try {
		await guard.run(async () => {
			// 阶段 1：先告诉前端 Pipeline 已开始分析，让聊天面板立即展示执行进度。
			onProgress?.("progress", {
				stage: "analysis",
				title: "分析需求",
				detail: existingComponents.length
					? `已读取当前画布的 ${existingComponents.length} 个组件，正在识别需要新增或修改的内容。`
					: "当前画布为空，正在提取页面主题、指标和视觉层级。",
			});

			// 阶段 2：缓存命中时只发送 cached，随后直接结束本次 Pipeline。
			// 路由会在 generateSchema 返回后补发 end；当前缓存只记录成功状态，不回放组件数据。
			const cacheKey = makeCacheKey({ userPrompt, mode });
			const cachedResult = getCache(cacheKey);
			if (cachedResult) {
				console.log(`[generateSchema] [CACHE HIT] sessionId: ${sessionId}`);
				onProgress?.("cached", { fromCache: true });
				return;
			}

			console.log(
				`[generateSchema] sessionId: ${sessionId}, thread_id: ${pageId || sessionId}`
			);

			// 阶段 3：构建本轮 Agent 输入。
			// checkpointer 会按 thread_id 自动维护历史，因此这里只传当前用户消息。
			// 注入组件清单可让 AI 使用画布中的真实 id，避免修改组件时编造目标 id。
			const componentManifest = buildComponentManifest(existingComponents);
			const allMessages = [buildUserMessage(userPrompt, mode, componentManifest)];
			onProgress?.("progress", {
				stage: "planning",
				title: "模型正在思考",
				detail: "正在分析组件选型、页面层级和布局方案。",
			});

			// 阶段 4：先用不绑定工具的 reasoningModel 生成执行计划，
			// 避免 DeepSeek thinking 与 tool_choice 冲突，再由 Agent 真正执行工具调用。
			try {
				const reasoningResponse = await reasoningModel.invoke(
					[
						new SystemMessage(
							"你是大屏设计规划助手。请分析用户需求并给出简洁的执行计划，不生成最终 Schema，也不调用工具。"
						),
						new HumanMessage(
							[`用户需求：${userPrompt}`, componentManifest]
								.filter(Boolean)
								.join("\n")
						),
					],
					{ signal: abortSignal }
				);
				const reasoningContent = reasoningResponse.additional_kwargs?.reasoning_content;
				if (typeof reasoningContent === "string" && reasoningContent.trim()) {
					// thinking 只用于前端展示思考步骤，不会直接修改画布。
					onProgress?.("thinking", {
						id: reasoningResponse.id || "planning-reasoning",
						round: 1,
						content: reasoningContent.trim(),
					});
				}
				// 模型正文作为执行阶段说明；截断可避免进度卡片被过长文本撑开。
				const plan = getTextContent(reasoningResponse.content);
				onProgress?.("progress", {
					stage: "execution",
					title: "开始执行方案",
					detail: plan
						? plan.slice(0, 300)
						: "思考完成，开始调用组件工具并校验生成结果。",
				});
			} catch (error: any) {
				if (error?.name === "AbortError" || abortSignal?.aborted) throw error;
				// 规划模型失败不阻断生成，降级为让 Agent 直接执行组件工具。
				console.warn("[generateSchema] [REASONING SKIPPED]", error?.message || error);
				onProgress?.("progress", {
					stage: "execution",
					title: "开始执行方案",
					detail: "思考过程暂不可用，已自动切换为直接调用组件工具。",
				});
			}

			// 阶段 5：流式运行 Agent。pageId 优先作为 thread_id，使同一页面共享多轮上下文；
			// 没有 pageId 时退回 sessionId，保证独立会话仍能延续上下文。
			const stream = await agent.stream(
				{ messages: allMessages },
				{
					signal: abortSignal,
					recursionLimit: 60,
					configurable: {
						thread_id: pageId || sessionId,
					},
				}
			);

			// 阶段 6：逐块拆分 Agent 输出并推送给前端。
			// model 分支负责 thinking/tool_call，tools 分支负责 tool_result/ai_chunk。
			// LangGraph 的流式快照可能重复携带消息，因此用 Set 做事件去重。
			const seenToolCalls = new Set<string>();
			const seenReasoning = new Set<string>();
			for await (const chunk of stream) {
				if (chunk?.model?.messages) {
					// 模型消息描述“正在想什么、准备调用什么”，用于丰富聊天过程展示。
					for (const rawMessage of chunk.model.messages) {
						const message = rawMessage as any;
						const reasoningContent = message?.additional_kwargs?.reasoning_content;
						if (
							typeof reasoningContent === "string" &&
							reasoningContent.trim() &&
							!seenReasoning.has(reasoningContent)
						) {
							seenReasoning.add(reasoningContent);
							onProgress?.("thinking", {
								id: message.id || `reasoning-${seenReasoning.size}`,
								round: seenReasoning.size,
								content: reasoningContent.trim(),
							});
						}

						const toolCalls =
							message?.tool_calls || message?.additional_kwargs?.tool_calls || [];
						for (const toolCall of toolCalls) {
							const toolName = toolCall?.name || toolCall?.function?.name;
							if (!toolName) continue;

							const toolCallId =
								toolCall?.id || `${toolName}-${seenToolCalls.size + 1}`;
							if (seenToolCalls.has(toolCallId)) continue;
							seenToolCalls.add(toolCallId);

							onProgress?.("tool_call", {
								id: toolCallId,
								name: toolName,
								label: getToolLabel(toolName),
								inputSummary: summarizeToolInput(
									toolCall?.args || toolCall?.function?.arguments
								),
							});
						}
					}
				}

				if (chunk?.tools) {
					// 工具消息包含已经执行完成的结构化结果。
					for (const rawToolMessage of chunk.tools.messages || []) {
						const toolMessage = rawToolMessage as any;
						const toolName = toolMessage.name;
						if (!toolName) continue;
						console.log(`[generateSchema] [TOOL CALL] ${toolName}`);
						const toolOutput = parseJsonValue(toolMessage.content);

						// tool_result 只负责把聊天面板中的工具步骤标记为完成。
						onProgress?.("tool_result", {
							id: toolMessage.tool_call_id || toolMessage.toolCallId,
							name: toolName,
							label: getToolLabel(toolName),
							status: "success",
							summary: summarizeToolResult(toolName, toolOutput),
						});

						// notes 是给 Agent 使用的中间态说明，不是页面节点，不能交给画布渲染。
						if (toolOutput?.notes) continue;

						// 只放行两种前端认识的数据：页面配置，或 schema.ts 中声明的组件节点。
						const isPageConfig =
							!toolOutput?.type && (toolOutput?.props || toolOutput?.settings);
						const isComponent =
							toolOutput?.type && COMPONENT_TYPES.includes(toolOutput.type);

						if (!isPageConfig && !isComponent) {
							console.log(`[generateSchema] [SKIP] 非可渲染的工具输出: ${toolName}`);
							continue;
						}

						// 组件节点兜底：前端依赖 id 判断新增/更新，依赖 style 在画布中定位。
						if (isComponent) {
							if (!toolOutput.id) {
								toolOutput.id = nanoid();
							}
							if (!toolOutput.style) {
								toolOutput.style = {
									top: 0,
									left: 0,
									width: 400,
									height: 240,
									zIndex: 1,
								};
							}
						}

						const toolOutputPretty = JSON.stringify(toolOutput, null, 2);
						// ai_chunk 是真正的画布数据通道：路由先把该对象编码为 SSE data，
						// 前端再解析 event.data 和 chunk，并调用 updatePage/updateItem/addItem。
						onProgress?.("ai_chunk", {
							chunk: toolOutputPretty,
						});
					}
				}
			}

			// 阶段 7：工具流结束后发送收尾状态；最终 end 事件仍由 routes/ai.ts 统一发送。
			onProgress?.("progress", {
				stage: "finalizing",
				title: "整理生成结果",
				detail: "组件工具已执行完成，正在完成最后的结果校验。",
			});

			// 仅在整条流水线成功完成后写入缓存，避免失败或中断请求被误判为已完成。
			setCache(cacheKey, { success: true });
			console.log(`[generateSchema] [CACHE SAVED]`);
		});
	} catch (err: any) {
		if (err?.name === "AbortError") {
			console.log(`[generateSchema] [ABORTED] sessionId: ${sessionId}`);
		} else {
			console.error("[generateSchema] [ERROR]", err.message);
		}
		throw err;
	} finally {
		// 无论成功、失败还是取消，都释放 AbortSignal 监听器，防止会话级资源泄漏。
		guard.dispose();
	}
}
