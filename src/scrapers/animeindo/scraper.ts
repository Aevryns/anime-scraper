import * as cheerio from "cheerio";
import { BaseScraper } from "../../core/index.js";
import {
  AnimeItem,
  AnimeDetail,
  MovieItem,
  GenreItem,
  UpdateItem,
  EpisodeStream,
  SearchResult,
  EpisodeRef,
  VideoServer,
  DownloadLink,
} from "./models.js";
import {
  BASE_URL,
  normalizeUrl,
  validateAnimeItem,
  validateAnimeDetail,
  validateMovieItem,
  validateGenreItem,
  validateUpdateItem,
} from "./validator.js";
import { AnimeIndoStorage } from "./storage.js";

export class AnimeIndoScraper extends BaseScraper {
  public readonly name: string = "animeindo";
  public readonly baseUrl: string;
  public readonly storage: AnimeIndoStorage;

  constructor(baseUrl: string = BASE_URL, storage?: AnimeIndoStorage) {
    super();
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.storage = storage || new AnimeIndoStorage();
  }

  public async getAnimeList(): Promise<AnimeItem[]> {
    const url = `${this.baseUrl}/anime-list/`;
    const html = await this.fetchText(url);
    const $ = cheerio.load(html);

    const validItems: AnimeItem[] = [];
    const seenSlugs = new Set<string>();
    let currentLetter = "";

    const container = $(".ngirix").length ? $(".ngirix") : $(".ngiri").length ? $(".ngiri") : $("body");

    container.find("div.letter, li").each((_, elem) => {
      const $el = $(elem);
      if ($el.hasClass("letter")) {
        currentLetter = $el.text().trim();
      } else if (elem.tagName === "li") {
        const a = $el.find("a");
        const rawHref = a.attr("href")?.trim() || "";
        const title = a.text().trim();
        if (!rawHref || !title) return;

        const fullUrl = normalizeUrl(rawHref, this.baseUrl);
        const slug = rawHref.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
        if (!slug) return;

        const item: AnimeItem = {
          title,
          slug,
          url: fullUrl,
          letter: currentLetter,
        };

        const { valid } = validateAnimeItem(item);
        if (valid && !seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          validItems.push(item);
        }
      }
    });

    return validItems;
  }

  public async getGenres(): Promise<GenreItem[]> {
    const url = `${this.baseUrl}/list-genre/`;
    const html = await this.fetchText(url);
    const $ = cheerio.load(html);

    const genres: GenreItem[] = [];
    const seenSlugs = new Set<string>();

    $("a").each((_, elem) => {
      const href = $(elem).attr("href") || "";
      if (href.includes("/genres/")) {
        const name = $(elem).text().trim();
        if (!name) return;

        const fullUrl = normalizeUrl(href, this.baseUrl);
        const slug = href.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
        if (slug && !seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          const item: GenreItem = { name, slug, url: fullUrl };
          const { valid } = validateGenreItem(item);
          if (valid) genres.push(item);
        }
      }
    });

    genres.sort((a, b) => a.name.localeCompare(b.name));
    return genres;
  }

  public async getTotalMoviePages(): Promise<number> {
    const url = `${this.baseUrl}/movie/`;
    const html = await this.fetchText(url);
    const $ = cheerio.load(html);

    let lastPage = 1;
    $(".pag a").each((_, elem) => {
      const href = $(elem).attr("href") || "";
      if (href.includes("/page/")) {
        const part = href.replace(/^\/+|\/+$/g, "").split("/").pop();
        if (part && /^\d+$/.test(part)) {
          lastPage = Math.max(lastPage, parseInt(part, 10));
        }
      }
    });

    return lastPage;
  }

  public async getMoviesFromPage(pageNum: number): Promise<MovieItem[]> {
    const url = pageNum > 1 ? `${this.baseUrl}/movie/page/${pageNum}/` : `${this.baseUrl}/movie/`;
    let html = "";
    try {
      html = await this.fetchText(url);
    } catch {
      return [];
    }

    const $ = cheerio.load(html);
    const movies: MovieItem[] = [];

    $("table.otable").each((_, table) => {
      const $table = $(table);
      const videsc = $table.find("td.videsc");
      const vithumb = $table.find("td.vithumb");
      if (!videsc.length) return;

      const aTitle = videsc.find("a").first();
      if (!aTitle.length) return;

      const title = aTitle.text().trim();
      const href = aTitle.attr("href") || "";
      const fullUrl = normalizeUrl(href, this.baseUrl);
      const slug = href.replace(/^\/+|\/+$/g, "").split("/").pop() || "";

      const imgEl = vithumb.find("img");
      let rawImg = imgEl.attr("data-original") || imgEl.attr("src") || "";
      const imageUrl = normalizeUrl(rawImg, this.baseUrl);

      const labels: string[] = [];
      videsc.find("span.label").each((_, s) => {
        labels.push($(s).text().trim());
      });

      const pDes = videsc.find("p.des");
      const description = pDes.length ? pDes.text().trim() : "";

      const item: MovieItem = {
        title,
        slug,
        url: fullUrl,
        imageUrl,
        labels,
        description,
      };

      const { valid } = validateMovieItem(item);
      if (valid) movies.push(item);
    });

    return movies;
  }

  public async getAllMovies(
    maxPages?: number,
    onProgress?: (page: number, total: number) => void
  ): Promise<MovieItem[]> {
    let totalPages = await this.getTotalMoviePages();
    if (maxPages) totalPages = Math.min(totalPages, maxPages);

    const allMovies: MovieItem[] = [];
    const seenSlugs = new Set<string>();

    for (let page = 1; page <= totalPages; page++) {
      const pageMovies = await this.getMoviesFromPage(page);
      for (const m of pageMovies) {
        if (!seenSlugs.has(m.slug)) {
          seenSlugs.add(m.slug);
          allMovies.push(m);
        }
      }
      if (onProgress) onProgress(page, totalPages);
    }

    return allMovies;
  }

  public async getLatestUpdates(maxPages: number = 10): Promise<UpdateItem[]> {
    const updates: UpdateItem[] = [];

    for (let p = 1; p <= maxPages; p++) {
      const url = p > 1 ? `${this.baseUrl}/page/${p}/` : `${this.baseUrl}/`;
      let html = "";
      try {
        html = await this.fetchText(url);
      } catch {
        continue;
      }

      const $ = cheerio.load(html);
      $("div.list-anime").each((_, div) => {
        const $div = $(div);
        const parentA = $div.parent("a").length ? $div.parent("a") : $div.find("a");
        const href = parentA.attr("href") || "";
        const fullUrl = normalizeUrl(href, this.baseUrl);

        const title = $div.find("p").text().trim();
        const episode = $div.find("span.eps").text().trim();

        const imgEl = $div.find("img");
        const rawImg = imgEl.attr("data-original") || imgEl.attr("src") || "";
        const imageUrl = normalizeUrl(rawImg, this.baseUrl);

        const item: UpdateItem = {
          title,
          episode,
          url: fullUrl,
          imageUrl,
        };

        const { valid } = validateUpdateItem(item);
        if (valid) updates.push(item);
      });
    }

    return updates;
  }

  public async getAnimeDetail(urlOrSlug: string): Promise<AnimeDetail | null> {
    const isUrl = urlOrSlug.startsWith("http");
    const slug = isUrl ? urlOrSlug.replace(/^\/+|\/+$/g, "").split("/").pop() || "" : urlOrSlug.trim();
    const url = isUrl ? urlOrSlug : `${this.baseUrl}/anime/${slug}/`;

    let html = "";
    try {
      html = await this.fetchText(url);
    } catch {
      return null;
    }
    if (!html) return null;

    return this.parseAnimeDetailHtml(html, slug, url);
  }

  private parseAnimeDetailHtml(html: string, slug: string, url: string): AnimeDetail | null {
    const $ = cheerio.load(html);
    const title = $("h1.title").first().text().trim();
    if (!title) return null;

    const detailDiv = $("div.detail");
    let altTitle = "";
    let imageUrl = "";
    const genres: string[] = [];
    let synopsis = "";

    if (detailDiv.length) {
      const img = detailDiv.find("img");
      if (img.length) {
        const rawImg = img.attr("data-original") || img.attr("src") || "";
        imageUrl = normalizeUrl(rawImg, this.baseUrl);
      }

      altTitle = detailDiv.find("h2").text().trim();

      detailDiv.find('a[rel="tag"]').each((_, a) => {
        genres.push($(a).text().trim());
      });

      synopsis = detailDiv.find("p").first().text().trim();
    }

    const episodes: EpisodeRef[] = [];
    $("div.ep a").each((_, a) => {
      const epText = $(a).text().trim();
      const href = $(a).attr("href") || "";
      if (href) {
        episodes.push({
          episode: epText,
          url: normalizeUrl(href, this.baseUrl),
        });
      }
    });

    const detail: AnimeDetail = {
      title,
      altTitle,
      slug,
      url,
      imageUrl,
      genres,
      synopsis,
      episodesCount: episodes.length,
      episodes,
    };

    const { valid } = validateAnimeDetail(detail);
    return valid ? detail : null;
  }

  public async crawlAnimeDetailsAsync(
    animeItems: AnimeItem[],
    concurrency: number = 20,
    batchSize: number = 50,
    onBatchDone?: (completed: number, total: number, batch: AnimeDetail[]) => void
  ): Promise<AnimeDetail[]> {
    const crawledSlugs = this.storage.getCrawledDetailSlugs();
    const pendingItems = animeItems.filter((it) => !crawledSlugs.has(it.slug));

    const total = pendingItems.length;
    let completed = 0;
    const allResults: AnimeDetail[] = [];

    const fetchOne = async (item: AnimeItem): Promise<AnimeDetail | null> => {
      try {
        const html = await this.fetchText(item.url, {}, 2);
        if (!html) return null;
        return this.parseAnimeDetailHtml(html, item.slug, item.url);
      } catch {
        return null;
      }
    };

    for (let i = 0; i < total; i += batchSize) {
      const chunk = pendingItems.slice(i, i + batchSize);
      const chunkResults = await this.runConcurrent(chunk, fetchOne, concurrency);

      const validBatch = chunkResults.filter((d): d is AnimeDetail => d !== null);
      if (validBatch.length > 0) {
        this.storage.saveAnimeDetailsBatch(validBatch);
        allResults.push(...validBatch);
      }

      completed += chunk.length;
      if (onBatchDone) {
        onBatchDone(completed, total, validBatch);
      }
    }

    return allResults;
  }

  public async getEpisodeStream(urlOrSlug: string): Promise<EpisodeStream | null> {
    const isUrl = urlOrSlug.startsWith("http");
    const cleaned = urlOrSlug.replace(/^\/+|\/+$/g, "");
    const url = isUrl ? urlOrSlug : `${this.baseUrl}/${cleaned}/`;

    let html = "";
    try {
      html = await this.fetchText(url);
    } catch {
      return null;
    }
    if (!html) return null;

    const $ = cheerio.load(html);
    const episodeTitle = $("h1.title").first().text().trim();

    const iframe = $("iframe#tontonin");
    const mainVideo = iframe.attr("src") || null;

    const servers: VideoServer[] = [];
    $("div.servers a").each((_, a) => {
      servers.push({
        name: $(a).text().trim(),
        videoUrl: $(a).attr("data-video") || "",
      });
    });

    const downloads: DownloadLink[] = [];
    let prevUrl: string | null = null;
    let nextUrl: string | null = null;
    let parentAnimeUrl: string | null = null;

    $("div.nav a").each((_, a) => {
      const text = $(a).text().trim();
      const href = $(a).attr("href") || "";
      if (text.includes("Download")) {
        downloads.push({ name: text, url: href });
      } else if (text.includes("Prev")) {
        prevUrl = normalizeUrl(href, this.baseUrl);
      } else if (text.includes("Next")) {
        nextUrl = normalizeUrl(href, this.baseUrl);
      } else if (text.includes("Semua Episode") || href.includes("/anime/")) {
        parentAnimeUrl = normalizeUrl(href, this.baseUrl);
      }
    });

    return {
      episodeTitle,
      episodeUrl: url,
      mainVideo,
      servers,
      downloads,
      parentAnimeUrl,
      prevUrl,
      nextUrl,
    };
  }

  public async search(query: string): Promise<SearchResult[]> {
    const url = `${this.baseUrl}/search.php?q=${encodeURIComponent(query)}`;
    const html = await this.fetchText(url);
    const $ = cheerio.load(html);

    const results: SearchResult[] = [];
    $("table.otable").each((_, table) => {
      const $table = $(table);
      const videsc = $table.find("td.videsc");
      const vithumb = $table.find("td.vithumb");
      if (!videsc.length) return;

      const aTitle = videsc.find("a").first();
      if (!aTitle.length) return;

      const title = aTitle.text().trim();
      const href = aTitle.attr("href") || "";
      const slug = href.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
      const fullUrl = normalizeUrl(href, this.baseUrl);

      const img = vithumb.find("img");
      const rawImg = img.attr("data-original") || img.attr("src") || "";
      const imageUrl = normalizeUrl(rawImg, this.baseUrl);

      const labels: string[] = [];
      videsc.find("span.label").each((_, s) => {
        labels.push($(s).text().trim());
      });

      const description = videsc.find("p.des").text().trim();

      results.push({
        title,
        slug,
        url: fullUrl,
        imageUrl,
        labels,
        description,
      });
    });

    return results;
  }
}
