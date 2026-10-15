import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, "docs");

/**
 * 加载 docs/ 目录下所有 .md 文件，分块后返回 Document[]
 * @param {Object} [options]
 * @param {number} [options.chunkSize=500] - 分块大小（字符数）
 * @param {number} [options.chunkOverlap=50] - 分块重叠（字符数）
 * @returns {Promise<import("@langchain/core/documents").Document[]>}
 */
export async function loadAndSplitDocs({ chunkSize = 500, chunkOverlap = 50 } = {}) {
	const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));

	if (files.length === 0) {
		console.warn("[knowledge/loader] docs/ 目录下没有找到 .md 文件");
		return [];
	}

	const allDocs = [];

	for (const file of files) {
		const filePath = join(DOCS_DIR, file);
		const loader = new TextLoader(filePath);
		const docs = await loader.load();

		// 为每个文档注入来源文件名
		for (const doc of docs) {
			doc.metadata.source = file;
			doc.metadata.title = file.replace(/\.md$/, "");
		}

		allDocs.push(...docs);
	}

	// 分块
	const splitter = new RecursiveCharacterTextSplitter({
		chunkSize,
		chunkOverlap,
	});

	const chunks = await splitter.splitDocuments(allDocs);

	console.log(
		`[knowledge/loader] 加载 ${files.length} 个文档，分为 ${chunks.length} 个块`,
	);

	return chunks;
}
