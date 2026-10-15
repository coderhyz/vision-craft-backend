import { createHash } from "crypto";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟缓存，覆盖一次生成窗口

interface CacheItem {
	value: unknown;
	expiredAt: number;
}

// 使用进程内存保存临时结果；服务重启后缓存会自然清空。
const cacheStore = new Map<string, CacheItem>();

const now = () => Date.now();

export function makeCacheKey(payload: unknown): string {
	const raw = JSON.stringify(payload);
	return createHash("sha256").update(raw).digest("hex");
}

export function getCache(key: string): unknown | null {
	const item = cacheStore.get(key);
	if (!item) return null;

	const { expiredAt, value } = item;
	if (expiredAt < now()) {
		cacheStore.delete(key);
		return null;
	}
	return value;
}

export function setCache(key: string, value: unknown, ttlMs = CACHE_TTL_MS) {
	cacheStore.set(key, {
		value,
		expiredAt: now() + ttlMs,
	});
}
