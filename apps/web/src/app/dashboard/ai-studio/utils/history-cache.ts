const CACHE_TTL_MS = 30_000; // 30 segundos

interface CacheEntry<T> {
	data: T;
	fetchedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export async function fetchWithCache<T>(
	url: string,
	ttl = CACHE_TTL_MS,
): Promise<T> {
	const now = Date.now();
	const entry = cache.get(url) as CacheEntry<T> | undefined;

	if (entry && now - entry.fetchedAt < ttl) {
		return entry.data;
	}

	const response = await fetch(url);
	if (!response.ok) throw new Error(`Request failed: ${response.status}`);
	const data: T = await response.json();

	cache.set(url, { data, fetchedAt: now });
	return data;
}

export function invalidateCache(url: string) {
	cache.delete(url);
}
