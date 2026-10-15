import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import dotenv from "dotenv";

dotenv.config();

export const ragModel = new ChatOpenAI({
	model: "glm-5.3",
	apiKey: process.env.DASHBOARD_API_KEY,
	configuration: {
		baseURL: process.env.DASHBOARD_BASE_URL,
	},
	temperature: 0.3,
	streaming: true,
});

export const ragSystemMessage = new SystemMessage(
	[
		"你是 Vision-Craft 可视化大屏搭建平台的知识助手。",
		"",
		"## 职责",
		"基于提供的参考文档，准确回答用户关于以下主题的问题：",
		"- 组件类型、属性配置、样式设置",
		"- 图表数据源配置、字段映射规范",
		"- 平台功能使用方法、操作指南",
		"- 大屏搭建最佳实践",
		"",
		"## 规则",
		"1. 回答必须基于参考文档中的信息，不要编造不存在的功能或配置。",
		"2. 如果参考文档中没有相关信息，请如实告知用户，并建议可能的替代方案。",
		"3. 回答使用 Markdown 格式，配置示例用 JSON 代码块包裹。",
		"4. 保持回答简洁准确，优先给出可直接使用的配置示例。",
		"5. 使用中文回答。",
	].join("\n"),
);
