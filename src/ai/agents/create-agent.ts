import { createAgent, toolStrategy, summarizationMiddleware } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatOpenAI } from "@langchain/openai";
import { componentTools } from "../tools/component-tools.ts";
import { integrationTools } from "../tools/integration-tools.ts";
import { pageSchema } from "../schema.ts";
import { buildSystemMessage } from "../prompt.ts";
import dotenv from "dotenv";

dotenv.config();

const checkpointer = new MemorySaver();
const systemPrompt = buildSystemMessage();

const model = process.env.DEEPSEEK_MODEL || "deepseek-flash";
const reasoningEffort = ["low", "high", "max"].includes(process.env.DEEPSEEK_REASONING_EFFORT || "")
	? process.env.DEEPSEEK_REASONING_EFFORT
	: "high";
const configuration = process.env.DEEPSEEK_BASE_URL
	? { baseURL: process.env.DEEPSEEK_BASE_URL }
	: undefined;

/**
 * 独立的需求分析模型，不绑定任何工具，因此可以安全开启 DeepSeek 思考模式。
 * reasoning_content 由 ChatDeepSeek 保存在 additional_kwargs 中，供流水线推送给前端。
 */
export const reasoningModel = new ChatDeepSeek({
	model,
	apiKey: process.env.DEEPSEEK_API_KEY,
	configuration,
	maxTokens: 2048,
	modelKwargs: {
		thinking: { type: "enabled" },
		reasoning_effort: reasoningEffort,
	},
});

// 工具执行模型必须关闭思考模式，否则 toolStrategy 的 tool_choice 会被 DeepSeek 拒绝。
const executionModel = new ChatOpenAI({
	model,
	apiKey: process.env.DEEPSEEK_API_KEY,
	configuration,
	temperature: 0.5,
	modelKwargs: {
		thinking: { type: "disabled" },
		reasoning_effort: "none",
	},
});

// 生成组件的 Agent。
export const agent = createAgent({
	model: executionModel,
	middleware: [
		summarizationMiddleware({
			model: new ChatOpenAI({
				model,
				apiKey: process.env.DEEPSEEK_API_KEY,
				configuration,
				modelKwargs: {
					thinking: { type: "disabled" },
					reasoning_effort: "none",
				},
			}),
			trigger: { tokens: 500000, messages: 10 },
			keep: { messages: 10 },
		}),
	],
	checkpointer,
	tools: [...componentTools, ...integrationTools],
	responseFormat: toolStrategy(pageSchema),
	systemPrompt,
});
