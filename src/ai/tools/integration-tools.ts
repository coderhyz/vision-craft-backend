import { ExaSearchResults } from "@langchain/exa";
import Exa from "exa-js";
import dotenv from "dotenv";

dotenv.config();

const client = new Exa(process.env.EXASEARCH_API_KEY);

// 通用联网搜索 tool（保留原有能力）
const EXASearchTool = new ExaSearchResults({
	client: client as any,
	searchArgs: {
		numResults: 3,
	},
});

// 集合导出（背景图搜索已合并到 updatePageConfigTool，此处仅保留通用搜索能力）
export const integrationTools: any[] = [];
