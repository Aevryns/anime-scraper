import * as cheerio from "cheerio";
import {
  DracinemaMovie,
  DracinemaGenre,
  DracinemaDetail,
  DracinemaEpisode,
  DracinemaPlayback,
} from "./models.js";
import { DracinemaStorage } from "./storage.js";

const BASE_URL = "https://www.dracinema.com";
const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "id,en-US;q=0.9,en;q=0.8",
};

export class DracinemaScraper {
  public readonly baseUrl: string;
  public readonly storage: DracinemaStorage;
  private readonly apiKey: string = "xb3MdwdLrZrpaDXvrLLwfP==";

  constructor(baseUrl: string = BASE_URL, storage?: DracinemaStorage) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.storage = storage || new DracinemaStorage();
  }

  public async fetchText(url: string, retries: number = 3): Promise<string> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url, {
          headers: DEFAULT_HEADERS,
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

  public async getMoviesFromSitemap(sitemapIndex: number = 1): Promise<DracinemaMovie[]> {
    const url = `${this.baseUrl}/sitemaps/movies-${sitemapIndex}.xml`;
    const xml = await this.fetchText(url);
    if (!xml) return [];

    const movies: DracinemaMovie[] = [];
    const urlBlocks = xml.split("<url>").slice(1);

    for (const block of urlBlocks) {
      const locMatch = block.match(/<loc>(.*?)<\/loc>/);
      const titleMatch = block.match(/<video:title>(.*?)<\/video:title>/);
      const thumbMatch = block.match(/<video:thumbnail_loc>(.*?)<\/video:thumbnail_loc>/);
      const descMatch = block.match(/<video:description>(.*?)<\/video:description>/);
      const playerMatch = block.match(/<video:player_loc>(.*?)<\/video:player_loc>/);
      const lastmodMatch = block.match(/<lastmod>(.*?)<\/lastmod>/);

      if (!locMatch || !locMatch[1]) continue;

      const pageUrl = locMatch[1].trim();
      const slug = pageUrl.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
      const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : slug;
      const thumbnail = thumbMatch && thumbMatch[1] ? thumbMatch[1].trim() : "";
      const description = descMatch && descMatch[1] ? descMatch[1].trim() : "";
      const playerUrl = playerMatch && playerMatch[1] ? playerMatch[1].trim() : `${this.baseUrl}/play/${slug}`;
      const lastmod = lastmodMatch && lastmodMatch[1] ? lastmodMatch[1].trim() : undefined;

      movies.push({
        title,
        slug,
        url: pageUrl,
        thumbnail,
        description,
        playerUrl,
        lastmod,
      });
    }

    return movies;
  }

  public async getGenres(): Promise<DracinemaGenre[]> {
    const url = `${this.baseUrl}/sitemaps/pages.xml`;
    const xml = await this.fetchText(url);
    if (!xml) return [];

    const genres: DracinemaGenre[] = [];
    const locMatches = xml.match(/<loc>(.*?)<\/loc>/g) || [];

    for (const locTag of locMatches) {
      const locUrl = locTag.replace(/<\/?loc>/g, "").trim();
      if (locUrl.includes("/genre/")) {
        const slug = locUrl.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
        const name = slug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

        genres.push({
          name,
          slug,
          url: locUrl,
        });
      }
    }

    genres.sort((a, b) => a.name.localeCompare(b.name));
    return genres;
  }

  public async getCollections(
    maxPages: number = 28,
    onProgress?: (page: number, total: number) => void
  ): Promise<Array<{ slug: string; title: string; url: string; thumbnail: string }>> {
    const collections: Array<{ slug: string; title: string; url: string; thumbnail: string }> = [];
    const seenSlugs = new Set<string>();

    for (let p = 1; p <= maxPages; p++) {
      const url = p > 1 ? `${this.baseUrl}/collections/page/${p}` : `${this.baseUrl}/collections`;
      let html = "";
      try {
        html = await this.fetchText(url);
      } catch {
        break;
      }
      if (!html) break;

      const $ = cheerio.load(html);
      $("article").each((_, art) => {
        const $art = $(art);
        const a = $art.find("a").first();
        const href = a.attr("href") || "";
        if (!href.includes("/movie/")) return;

        const slug = href.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
        const title = $art.find("p").first().text().trim() || slug;
        const img = $art.find("img").first();
        const thumbnail = img.attr("src") || "";

        if (slug && !seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          collections.push({
            slug,
            title,
            url: href.startsWith("http") ? href : `${this.baseUrl}${href}`,
            thumbnail,
          });
        }
      });

      if (onProgress) onProgress(p, maxPages);
    }

    return collections;
  }

  public async getMovieDetail(urlOrSlug: string): Promise<DracinemaDetail | null> {
    const isUrl = urlOrSlug.startsWith("http");
    const slug = isUrl ? urlOrSlug.replace(/^\/+|\/+$/g, "").split("/").pop() || "" : urlOrSlug.trim();
    const url = isUrl ? urlOrSlug : `${this.baseUrl}/movie/${slug}`;

    const html = await this.fetchText(url);
    if (!html) return null;

    const $ = cheerio.load(html);
    const title = $("h1").first().text().trim();
    if (!title) return null;

    const genres: string[] = [];
    $('a[href*="/genre/"]').each((_, a) => {
      const genre = $(a).text().trim();
      if (genre && !genres.includes(genre)) genres.push(genre);
    });

    const paragraphs: string[] = [];
    $("p").each((_, p) => {
      const text = $(p).text().trim();
      if (text.length > 30) paragraphs.push(text);
    });
    const synopsis = paragraphs.join("\n\n");

    const episodes: DracinemaEpisode[] = [];
    const seenEpUrls = new Set<string>();

    $('a[href*="/play/"]').each((_, a) => {
      const href = $(a).attr("href") || "";
      if (href && !seenEpUrls.has(href)) {
        seenEpUrls.add(href);
        const parts = href.replace(/\/+$/, "").split("/");
        const lastPart = parts[parts.length - 1];
        const epNum = /^\d+$/.test(lastPart) ? parseInt(lastPart, 10) : 1;
        episodes.push({
          episodeNumber: epNum,
          playUrl: href.startsWith("http") ? href : `${this.baseUrl}${href}`,
        });
      }
    });

    episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);

    const ogImage = $('meta[property="og:image"]').attr("content") || "";

    return {
      title,
      slug,
      url,
      cover: ogImage,
      genres,
      synopsis,
      totalEpisodes: episodes.length,
      releasedEpisodes: episodes.length,
      episodes,
    };
  }

  public async getPlaybackStream(movieKey: string, episode: number = 1): Promise<DracinemaPlayback | null> {
    const cleanMovieKey = movieKey.replace(/^\/+|\/+$/g, "").split("/").pop() || movieKey;
    const playUrl = `${this.baseUrl}/play/${cleanMovieKey}`;

    try {
      const res = await fetch(`${this.baseUrl}/api/playback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
          "User-Agent": DEFAULT_HEADERS["User-Agent"],
          Referer: playUrl,
          Origin: this.baseUrl,
        },
        body: JSON.stringify({ movieKey: cleanMovieKey, episode }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from playback API`);
      }

      const json = await res.json() as { token?: string };
      if (!json?.token) return null;

      const part = json.token.split(".")[1];
      if (!part) return null;

      const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(4 * Math.ceil(part.length / 4), "=");
      const decodedStr = Buffer.from(padded, "base64").toString("utf-8");
      const payload = JSON.parse(decodedStr);

      const data = payload?.data || {};
      const detail = data?.detail || {};
      const meta = data?.meta || {};

      const videoUrls = (detail?.videoUrls || []).map((v: any) => ({
        quality: v.quality || 720,
        url: v.url || "",
        cdn: v.cdn,
      }));

      return {
        movieKey: cleanMovieKey,
        episode,
        movieName: meta?.movieName || "",
        cover: meta?.cover || "",
        chapterName: detail?.chapterName || `Episode ${episode}`,
        videoUrls,
        subtitleCdnUrl: videoUrls[0]?.cdn,
        subtitlesPreview: payload?.subtitle ? payload.subtitle.slice(0, 300) : undefined,
      };
    } catch (err) {
      console.error("Playback error:", err);
      return null;
    }
  }
}
