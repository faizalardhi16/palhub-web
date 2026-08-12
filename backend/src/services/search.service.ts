import * as cheerio from "cheerio";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * WebSearchService — search the web for sources, no API key required.
 * Provider strategy (polymorphism, no if-else):
 *  - "duckduckgo" (default): scrapes DuckDuckGo HTML — free, works from datacenter IPs.
 *  - "serper": Google SERP API (needs SEARCH_API_KEY) — higher quality results.
 * Each provider implements SearchProvider; the service picks by config.
 */
export interface SearchProvider {
  readonly name: string;
  search(query: string, limit: number): Promise<SearchResult[]>;
}

class DuckDuckGoProvider implements SearchProvider {
  readonly name = "duckduckgo";

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result").each((_, el) => {
      if (results.length >= limit) return;
      const titleEl = $(el).find(".result__a").first();
      const snippetEl = $(el).find(".result__snippet").first();
      const rawHref = titleEl.attr("href") ?? "";
      const title = titleEl.text().trim();
      const snippet = snippetEl.text().trim();
      if (!title || !rawHref) return;

      // DuckDuckGo wraps links: //duckduckgo.com/l/?uddg=<encoded>&rut=...
      let target = rawHref;
      const uddg = rawHref.match(/uddg=([^&]+)/);
      if (uddg) {
        try {
          target = decodeURIComponent(uddg[1]);
        } catch {
          /* keep raw */
        }
      }
      if (!/^https?:\/\//.test(target)) return;

      results.push({ title, url: target, snippet });
    });

    return results;
  }
}

class SerperProvider implements SearchProvider {
  readonly name = "serper";

  constructor(private readonly apiKey: string) {}

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: limit }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
    return (data.organic ?? [])
      .filter((r) => r.title && r.link && /^https?:\/\//.test(r.link))
      .slice(0, limit)
      .map((r) => ({ title: r.title!, url: r.link!, snippet: r.snippet ?? "" }));
  }
}

export class WebSearchService {
  private readonly providers = new Map<string, SearchProvider>();
  readonly active: string;

  constructor(providerName: string, apiKey: string) {
    const ddg = new DuckDuckGoProvider();
    this.providers.set(ddg.name, ddg);

    const serper = new SerperProvider(apiKey);
    this.providers.set(serper.name, serper);

    const normalized = providerName === "serper" && !apiKey ? ddg.name : providerName;
    this.active = this.providers.has(normalized) ? normalized : ddg.name;
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    const provider = this.providers.get(this.active)!;
    try {
      return await provider.search(query, limit);
    } catch {
      return [];
    }
  }
}
