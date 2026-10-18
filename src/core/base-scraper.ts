export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": DEFAULT_USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "id,en-US;q=0.9,en;q=0.8",
};

export abstract class BaseScraper {
  public abstract readonly name: string;
  public abstract readonly baseUrl: string;

  public async fetchText(url: string, headers: Record<string, string> = {}, retries: number = 3): Promise<string> {
    const combinedHeaders = { ...DEFAULT_HEADERS, ...headers };
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url, {
          headers: combinedHeaders,
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) {
          if (res.status === 404) return "";
          throw new Error(`HTTP ${res.status} on ${url}`);
        }
        return await res.text();
      } catch (err) {
        if (attempt === retries - 1) throw err;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    return "";
  }

  public async fetchJson<T>(
    url: string,
    options: RequestInit = {},
    retries: number = 3
  ): Promise<T | null> {
    const headers = { ...DEFAULT_HEADERS, ...(options.headers as Record<string, string> || {}) };
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url, {
          ...options,
          headers,
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} on ${url}`);
        }
        return (await res.json()) as T;
      } catch (err) {
        if (attempt === retries - 1) throw err;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    return null;
  }

  public async runConcurrent<TItem, TResult>(
    items: TItem[],
    workerFn: (item: TItem) => Promise<TResult>,
    concurrency: number = 10,
    onProgress?: (completed: number, total: number) => void
  ): Promise<TResult[]> {
    const results: TResult[] = [];
    const queue = [...items];
    const total = items.length;
    let completed = 0;

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        const res = await workerFn(item);
        results.push(res);
        completed++;
        if (onProgress) onProgress(completed, total);
      }
    });

    await Promise.all(workers);
    return results;
  }
}
