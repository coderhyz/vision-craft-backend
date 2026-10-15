import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let client: MongoClient | null = null;
let vectorStore: MongoDBAtlasVectorSearch | null = null;

export const VECTOR_INDEX_NAME = "vector_index";
export const VECTOR_TEXT_KEY = "text";
export const VECTOR_EMBEDDING_KEY = "embedding";

function requireEnv(name: string) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`[knowledge/store] 缺少环境变量 ${name}`);
	}
	return value;
}

/**
 * 获取 MongoDB Atlas 向量存储单例
 * 首次调用时初始化连接，后续复用
 */
export async function getVectorStore() {
	if (vectorStore) return vectorStore;

	client = new MongoClient(requireEnv("MONGODB_ATLAS_URI"));
	await client.connect();

	const collection = client
		.db(requireEnv("MONGODB_ATLAS_DB_NAME"))
		.collection(requireEnv("MONGODB_ATLAS_COLLECTION_NAME"));

	const embeddings = new OpenAIEmbeddings({
		model: requireEnv("ZHIPU_EMBEDDING_MODEL"),
		apiKey: requireEnv("ZHIPU_API_KEY"),
		configuration: {
			baseURL: requireEnv("ZHIPU_BASE_URL"),
		},
	});
	// 智谱 API 不支持 base64 encoding_format（OpenAI SDK v6 默认开启），强制关闭
	embeddings.encodingFormat = "float";

	vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
		collection: collection as any,
		indexName: VECTOR_INDEX_NAME,
		textKey: VECTOR_TEXT_KEY,
		embeddingKey: VECTOR_EMBEDDING_KEY,
	});

	console.log("[knowledge/store] MongoDBAtlasVectorSearch 初始化完成");
	return vectorStore;
}

/**
 * 获取底层 MongoDB collection（供 indexer 清空集合等操作使用）
 */
export async function getCollection() {
	if (!client) {
		client = new MongoClient(requireEnv("MONGODB_ATLAS_URI"));
		await client.connect();
	}
	return client
		.db(requireEnv("MONGODB_ATLAS_DB_NAME"))
		.collection(requireEnv("MONGODB_ATLAS_COLLECTION_NAME"));
}

export async function getKnowledgeDocumentCount() {
	const collection = await getCollection();
	return collection.countDocuments();
}

export async function getStoredEmbeddingDimensions() {
	const collection = await getCollection();
	const doc = await collection.findOne(
		{ [VECTOR_EMBEDDING_KEY]: { $exists: true } },
		{ projection: { [VECTOR_EMBEDDING_KEY]: 1 } },
	);
	const embedding = doc?.[VECTOR_EMBEDDING_KEY];
	return Array.isArray(embedding) ? embedding.length : null;
}

export async function ensureVectorSearchIndex(dimensions: number) {
	const collection = await getCollection();
	const existingIndexes = await (collection as any).listSearchIndexes(VECTOR_INDEX_NAME).toArray();

	if (existingIndexes.length > 0) {
		console.log(`[knowledge/store] Atlas Vector Search 索引已存在: ${VECTOR_INDEX_NAME}`);
		return;
	}

	console.warn(`[knowledge/store] Atlas Vector Search 索引不存在，正在创建: ${VECTOR_INDEX_NAME}`);
	await (collection as any).createSearchIndex({
		name: VECTOR_INDEX_NAME,
		type: "vectorSearch",
		definition: {
			fields: [
				{
					type: "vector",
					path: VECTOR_EMBEDDING_KEY,
					numDimensions: dimensions,
					similarity: "cosine",
				},
			],
		},
	});
}

export async function waitForVectorSearchIndexReady({ timeoutMs = 120_000, intervalMs = 5_000 } = {}) {
	const collection = await getCollection();
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		const indexes = await (collection as any).listSearchIndexes(VECTOR_INDEX_NAME).toArray();
		const index = indexes[0];
		if (index?.status === "READY" || index?.queryable === true) {
			console.log(`[knowledge/store] Atlas Vector Search 索引已就绪: ${VECTOR_INDEX_NAME}`);
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	console.warn(`[knowledge/store] 等待索引就绪超时，请稍后重试检索: ${VECTOR_INDEX_NAME}`);
}

/**
 * 关闭 MongoDB 连接（优雅退出时调用）
 */
export async function closeConnection() {
	if (client) {
		await client.close();
		client = null;
		vectorStore = null;
		console.log("[knowledge/store] MongoDB 连接已关闭");
	}
}
