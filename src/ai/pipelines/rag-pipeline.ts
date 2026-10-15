import { HumanMessage } from "@langchain/core/messages";
import { ragModel, ragSystemMessage } from "../agents/rag-agent.ts";
import { getVectorStore } from "../knowledge/store.ts";
import { ensureKnowledgeIndex } from "../knowledge/indexer.ts";
import { createAbortGuard } from "../abort-guard.ts";

const RETRIEVAL_K = 4;

interface AnswerQuestionParams {
	question: string;
	sessionId?: string;
	abortSignal?: AbortSignal;
	onProgress?: (event: string, data: unknown) => void;
}

/**
 * RAG 问答 pipeline
 * 检索相关文档 → 组装上下文 → LLM 流式生成回答
 */
export async function answerQuestion({
	question,
	sessionId,
	abortSignal,
	onProgress,
}: AnswerQuestionParams) {
	const guard = createAbortGuard(abortSignal);

	try {
		await guard.run(async () => {
			// 1. 向量检索——不可取消操作，发起前主动拦截
			guard.throwIfAborted();
			await ensureKnowledgeIndex();
			guard.throwIfAborted();
			const vectorStore = await getVectorStore();
			guard.throwIfAborted();
			const retrievedDocs = await vectorStore.similaritySearch(question, RETRIEVAL_K);

			console.log(
				`[rag-pipeline] 检索到 ${retrievedDocs.length} 个相关文档片段，sessionId: ${sessionId}`,
			);

			// 2. 组装上下文
			const contextParts = retrievedDocs.map((doc: any, i: number) => {
				const source = doc.metadata?.title || doc.metadata?.source || "未知来源";
				return `[参考文档 ${i + 1}] 来源: ${source}\n${doc.pageContent}`;
			});
			const context = contextParts.join("\n\n---\n\n");

			// 3. 构建消息
			const humanMessage = new HumanMessage(
				[
					"## 参考文档",
					"",
					context,
					"",
					"---",
					"",
					"## 用户问题",
					"",
					question,
					"",
					"请基于以上参考文档回答用户问题。如果文档中没有相关信息，请如实告知。",
				].join("\n"),
			);

			// 4. LLM 流式调用
			const stream = await ragModel.stream([ragSystemMessage, humanMessage], {
				signal: abortSignal,
			});

			// 5. 逐块推送文本
			for await (const chunk of stream) {
				const text = chunk?.content;
				if (typeof text === "string" && text.length > 0) {
					onProgress?.("text_chunk", { text });
				}
			}

			// 6. 推送引用来源
			const sources = retrievedDocs.map((doc: any) => ({
				title: doc.metadata?.title || doc.metadata?.source || "未知来源",
				snippet: doc.pageContent?.slice(0, 100) + (doc.pageContent?.length > 100 ? "..." : ""),
			}));

			onProgress?.("sources", { sources });
		});
	} catch (err: any) {
		if (err?.name === "AbortError") {
			console.log(`[rag-pipeline] [ABORTED] sessionId: ${sessionId}`);
		} else {
			console.error("[rag-pipeline] [ERROR]", err.message);
		}
		throw err;
	} finally {
		guard.dispose();
	}
}
