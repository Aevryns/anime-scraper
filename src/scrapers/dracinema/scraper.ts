import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { BaseScraper, DEFAULT_USER_AGENT } from "../../core/index.js";
import {
  DracinemaMovie,
  DracinemaGenre,
  DracinemaDetail,
  DracinemaEpisode,
  DracinemaPlayback,
  DracinemaSearchResult,
  RawStreamQuality,
  VideoFormatType,
  DownloadResult,
} from "./models.js";
import { DracinemaStorage } from "./storage.js";
import {
  cleanText,
  generateDracinemaSlug,
  validateDracinemaMovie,
  validateDracinemaGenre,
  validateDracinemaDetail,
  validateDracinemaPlayback,
  validateDracinemaSearchResult,
} from "./validator.js";

const BASE_URL = "https://www.dracinema.com";

export class DracinemaScraper extends BaseScraper {
  public readonly name: string = "dracinema";
  public readonly baseUrl: string;
  public readonly storage: DracinemaStorage;
  private readonly apiKey: string = "xb3MdwdLrZrpaDXvrLLwfP==";

  constructor(baseUrl: string = BASE_URL, storage?: DracinemaStorage) {
    super();
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.storage = storage || new DracinemaStorage();
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

      const validated = validateDracinemaMovie({
        title,
        slug,
        url: pageUrl,
        thumbnail,
        description,
        playerUrl,
        lastmod,
      });

      if (validated) {
        movies.push(validated);
      }
    }

    return movies;
  }

  public async getAllMoviesFromSitemaps(
    maxSitemaps: number = 5,
    onProgress?: (index: number, total: number, count: number) => void
  ): Promise<DracinemaMovie[]> {
    const allMovies: DracinemaMovie[] = [];
    const seenSlugs = new Set<string>();

    for (let i = 1; i <= maxSitemaps; i++) {
      try {
        const batch = await this.getMoviesFromSitemap(i);
        if (!batch.length) break;

        let added = 0;
        for (const m of batch) {
          if (!seenSlugs.has(m.slug)) {
            seenSlugs.add(m.slug);
            allMovies.push(m);
            added++;
          }
        }

        if (onProgress) onProgress(i, maxSitemaps, added);
      } catch {
        break;
      }
    }

    return allMovies;
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

        const validated = validateDracinemaGenre({
          name,
          slug,
          url: locUrl,
        });

        if (validated) {
          genres.push(validated);
        }
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
        const title = cleanText($art.find("p").first().text()) || slug;
        const img = $art.find("img").first();
        const thumbnail = cleanText(img.attr("src") || "");

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
    const title = cleanText($("h1").first().text());
    if (!title) return null;

    const genres: string[] = [];
    $('a[href*="/genre/"]').each((_, a) => {
      const genre = cleanText($(a).text());
      if (genre && !genres.includes(genre)) genres.push(genre);
    });

    const paragraphs: string[] = [];
    $("p").each((_, p) => {
      const text = cleanText($(p).text());
      if (text.length > 30) paragraphs.push(text);
    });
    const synopsis = paragraphs.join("\n\n");

    const episodes: DracinemaEpisode[] = [];
    const seenEpUrls = new Set<string>();

    $('a[href*="/play/"]').each((_, a) => {
      const href = cleanText($(a).attr("href") || "");
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
    const ogImage = cleanText($('meta[property="og:image"]').attr("content") || "");

    return validateDracinemaDetail({
      title,
      slug,
      url,
      cover: ogImage,
      genres,
      synopsis,
      totalEpisodes: episodes.length,
      releasedEpisodes: episodes.length,
      episodes,
    });
  }

  public async crawlMovieDetailsAsync(
    items: DracinemaMovie[],
    concurrency: number = 10,
    batchSize: number = 25,
    onProgress?: (completed: number, total: number, batch: DracinemaDetail[]) => void
  ): Promise<DracinemaDetail[]> {
    const allDetails: DracinemaDetail[] = [];
    let currentBatch: DracinemaDetail[] = [];

    await this.runConcurrent(
      items,
      async (movie) => {
        try {
          const detail = await this.getMovieDetail(movie.url);
          if (detail) {
            currentBatch.push(detail);
            allDetails.push(detail);
            if (currentBatch.length >= batchSize) {
              this.storage.saveDetailsBatch(currentBatch);
              const flushed = [...currentBatch];
              currentBatch = [];
              if (onProgress) onProgress(allDetails.length, items.length, flushed);
            }
          }
        } catch {
          // ignore single item failure
        }
      },
      concurrency
    );

    if (currentBatch.length > 0) {
      this.storage.saveDetailsBatch(currentBatch);
      if (onProgress) onProgress(allDetails.length, items.length, currentBatch);
    }

    return allDetails;
  }

  public async search(keyword: string): Promise<DracinemaSearchResult[]> {
    const trimmed = keyword.trim();
    if (!trimmed) return [];

    try {
      const searchUrl = `${this.baseUrl}/api/search?keyword=${encodeURIComponent(trimmed)}`;
      const res = await fetch(searchUrl, {
        headers: {
          "X-API-Key": this.apiKey,
          "User-Agent": DEFAULT_USER_AGENT,
          Referer: this.baseUrl,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const json = await res.json() as { data?: any[] };
        if (Array.isArray(json?.data) && json.data.length > 0) {
          const results: DracinemaSearchResult[] = [];

          for (const item of json.data) {
            const originalBookId = cleanText(item.originalBookId);
            const bookName = cleanText(item.bookName);

            // Lookup existing slug in storage if present, or generate it
            let slug = "";
            const existing = originalBookId ? this.storage.findMovieByBookId(originalBookId) : null;
            if (existing) {
              slug = existing.slug;
            } else {
              slug = generateDracinemaSlug(bookName, originalBookId);
            }

            const validated = validateDracinemaSearchResult({
              bookId: originalBookId,
              title: bookName,
              slug,
              cover: cleanText(item.cover),
              synopsis: cleanText(item.introduction),
              chapterCount: Number(item.chapterCount) || 0,
              movieUrl: `${this.baseUrl}/movie/${slug}`,
              playUrl: `${this.baseUrl}/play/${slug}`,
              similarity: item.sim !== undefined ? Number(item.sim) : undefined,
            });

            if (validated) {
              results.push(validated);
            }
          }

          if (results.length > 0) {
            return results;
          }
        }
      }
    } catch {
      // API search failed or timed out, fallback to local DB search
    }

    // Fallback: search local database
    return this.storage.searchLocal(trimmed);
  }

  public async getPlaybackStream(movieKey: string, episode: number = 1): Promise<DracinemaPlayback | null> {
    const cleanMovieKey = movieKey.replace(/^\/+|\/+$/g, "").split("/").pop() || movieKey;
    const playUrl = `${this.baseUrl}/play/${cleanMovieKey}/${episode}`;

    try {
      const res = await fetch(`${this.baseUrl}/api/playback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
          "User-Agent": DEFAULT_USER_AGENT,
          Referer: playUrl,
          Origin: this.baseUrl,
        },
        body: JSON.stringify({ movieKey: cleanMovieKey, episode }),
        signal: AbortSignal.timeout(15000),
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
      const videoItems: Array<{ quality?: number; url?: string; cdn?: string }> = detail?.videoUrls || [];
      if (!videoItems.length) return null;

      const primaryVideo = videoItems[0] || {};
      const firstUrl = cleanText(primaryVideo.url || "");
      if (!firstUrl) return null;

      // Check whether streams are direct MP4 (e.g. pd_, ml_, ext_, etc.) or HLS M3U8
      const isDirectMp4 = videoItems.some((v) => {
        const u = (v.url || "").toLowerCase();
        return u.includes(".mp4") || u.includes("mime_type=video_mp4");
      });

      const videoFormat: VideoFormatType = isDirectMp4 ? "mp4" : "hls";
      const rawStreams: RawStreamQuality[] = [];
      let directMp4Url: string | undefined;

      if (videoFormat === "mp4") {
        for (const v of videoItems) {
          const streamUrl = cleanText(v.url || "");
          if (!streamUrl) continue;
          const height = Number(v.quality) || 720;
          const resolution =
            height >= 1080
              ? "1920x1080"
              : height >= 720
              ? "1280x720"
              : height >= 540
              ? "960x540"
              : height >= 480
              ? "854x480"
              : "640x360";

          rawStreams.push({
            quality: `${height}p`,
            resolution,
            height,
            format: "mp4",
            rawStreamUrl: streamUrl,
            isDirectPlayable: true,
          });
        }
        rawStreams.sort((a, b) => b.height - a.height);
        directMp4Url = rawStreams[0]?.rawStreamUrl;
      } else {
        // HLS M3U8 stream: parse master playlist into individual quality sub-playlists
        const masterPlaylistUrl = firstUrl;
        try {
          const masterContent = await this.fetchText(masterPlaylistUrl);
          if (masterContent && masterContent.includes("#EXT-X-STREAM-INF:")) {
            const lines = masterContent.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line.startsWith("#EXT-X-STREAM-INF:")) {
                const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
                const bwMatch = line.match(/BANDWIDTH=(\d+)/i);

                let width = 0;
                let height = 0;
                let resolution = "unknown";
                if (resMatch) {
                  width = parseInt(resMatch[1], 10);
                  height = parseInt(resMatch[2], 10);
                  resolution = `${width}x${height}`;
                }

                const dimension = Math.max(width, height);
                let effectiveHeight = height;
                if (dimension >= 1920) effectiveHeight = 1080;
                else if (dimension >= 1280) effectiveHeight = 720;
                else if (dimension >= 960) effectiveHeight = 540;
                else if (dimension >= 854) effectiveHeight = 480;
                else if (dimension >= 640) effectiveHeight = 360;
                else if (dimension >= 426) effectiveHeight = 240;

                const nextLine = lines[i + 1]?.trim();
                if (nextLine && !nextLine.startsWith("#")) {
                  const rawStreamUrl = nextLine.startsWith("http")
                    ? nextLine
                    : new URL(nextLine, masterPlaylistUrl).href;

                  rawStreams.push({
                    quality: `${effectiveHeight}p`,
                    resolution,
                    height: effectiveHeight,
                    format: "hls",
                    bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : undefined,
                    rawStreamUrl,
                    isDirectPlayable: false,
                  });
                }
              }
            }
            rawStreams.sort((a, b) => (b.height - a.height) || ((b.bandwidth || 0) - (a.bandwidth || 0)));
          }
        } catch {
          // Fallback if master playlist fetching/parsing fails
        }

        if (rawStreams.length === 0) {
          rawStreams.push({
            quality: `${primaryVideo.quality || 720}p`,
            resolution: "1280x720",
            height: primaryVideo.quality || 720,
            format: "hls",
            rawStreamUrl: masterPlaylistUrl,
            isDirectPlayable: false,
          });
        }
      }

      // Extract raw direct .srt subtitle URL from CDN without proxy
      let rawSubtitleUrl: string | undefined;
      const subtitleProxyUrl = primaryVideo.cdn ? cleanText(primaryVideo.cdn) : undefined;
      if (subtitleProxyUrl) {
        if (subtitleProxyUrl.includes("cdn=")) {
          try {
            const extracted = decodeURIComponent(subtitleProxyUrl.split("cdn=")[1].split("&")[0]);
            if (extracted.startsWith("http")) {
              rawSubtitleUrl = extracted;
            }
          } catch {
            // ignore URI decode error
          }
        }
        if (!rawSubtitleUrl && (subtitleProxyUrl.endsWith(".srt") || subtitleProxyUrl.endsWith(".vtt"))) {
          rawSubtitleUrl = subtitleProxyUrl;
        }
      }

      return validateDracinemaPlayback({
        movieKey: cleanMovieKey,
        episode,
        movieName: cleanText(meta?.movieName) || cleanMovieKey,
        cover: cleanText(meta?.cover),
        chapterName: cleanText(detail?.chapterName) || `Episode ${episode}`,
        videoFormat,
        directMp4Url,
        webPlayerUrl: `${this.baseUrl}/play/${cleanMovieKey}/${episode}`,
        masterPlaylistUrl: firstUrl,
        rawStreams,
        rawSubtitleUrl,
        subtitleProxyUrl,
        subtitlesPreview: payload?.subtitle ? String(payload.subtitle).slice(0, 300) : undefined,
      });
    } catch (err) {
      console.error(`Playback error for ${movieKey} ep ${episode}:`, err);
      return null;
    }
  }

  public async downloadEpisodeMp4(
    movieKey: string,
    episode: number = 1,
    targetFilePath?: string,
    onProgress?: (progress: { completed: number; total: number; percent: number; stage: string }) => void
  ): Promise<DownloadResult> {
    const playback = await this.getPlaybackStream(movieKey, episode);
    if (!playback) {
      throw new Error(`Failed to get playback information for ${movieKey} episode ${episode}`);
    }

    const downloadDir = path.resolve(this.storage.dataDir, "downloads");
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const defaultFileName = `${playback.movieKey}_ep${episode}.mp4`;
    const finalPath = targetFilePath ? path.resolve(targetFilePath) : path.join(downloadDir, defaultFileName);

    if (playback.videoFormat === "mp4" && playback.directMp4Url) {
      if (onProgress) {
        onProgress({ completed: 0, total: 100, percent: 0, stage: "Downloading direct MP4..." });
      }
      const res = await fetch(playback.directMp4Url, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Referer: "https://www.dracinema.com/",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} when downloading MP4`);
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(finalPath, buffer);
      if (onProgress) {
        onProgress({ completed: 100, total: 100, percent: 100, stage: "Done" });
      }

      const stats = fs.statSync(finalPath);
      const mb = (stats.size / (1024 * 1024)).toFixed(2);
      return {
        success: true,
        filePath: finalPath,
        fileSizeBytes: stats.size,
        fileSizeFormatted: `${mb} MB`,
        format: "mp4",
      };
    } else {
      // HLS fragmented MP4 download & assembly
      const streamUrl = playback.rawStreams[0]?.rawStreamUrl || playback.masterPlaylistUrl;
      let playlistText = await this.fetchText(streamUrl);
      let streamBaseUrl = streamUrl;

      // If master playlist with sub-playlists, get the highest sub-playlist
      if (playlistText.includes("#EXT-X-STREAM-INF:")) {
        const subStream = playback.rawStreams[0]?.rawStreamUrl;
        if (subStream && subStream !== streamUrl) {
          playlistText = await this.fetchText(subStream);
          streamBaseUrl = subStream;
        }
      }

      const mapMatch = playlistText.match(/#EXT-X-MAP:URI="([^"]+)"/);
      const initUri = mapMatch ? mapMatch[1] : null;
      const segmentUris = playlistText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));

      if (!segmentUris.length) {
        throw new Error("No media segments found in HLS playlist");
      }

      const chunks: Buffer[] = [];
      const totalSteps = (initUri ? 1 : 0) + segmentUris.length;
      let completedSteps = 0;

      if (initUri) {
        if (onProgress) {
          onProgress({ completed: completedSteps, total: totalSteps, percent: 0, stage: "Downloading initialization segment..." });
        }
        const initUrl = initUri.startsWith("http") ? initUri : new URL(initUri, streamBaseUrl).href;
        const initRes = await fetch(initUrl);
        if (initRes.ok) {
          chunks.push(Buffer.from(await initRes.arrayBuffer()));
        }
        completedSteps++;
      }

      const segResults = new Map<number, Buffer>();
      const queue = segmentUris.map((uri, idx) => ({ idx, uri }));
      const concurrency = 6;

      const workers = Array.from({ length: concurrency }, async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) break;
          const segUrl = item.uri.startsWith("http") ? item.uri : new URL(item.uri, streamBaseUrl).href;
          try {
            const res = await fetch(segUrl);
            if (res.ok) {
              const buf = Buffer.from(await res.arrayBuffer());
              segResults.set(item.idx, buf);
            }
          } catch {
            // retry once
            try {
              const res = await fetch(segUrl);
              if (res.ok) {
                const buf = Buffer.from(await res.arrayBuffer());
                segResults.set(item.idx, buf);
              }
            } catch {
              // ignore
            }
          }
          completedSteps++;
          if (onProgress) {
            const pct = Math.floor((completedSteps / totalSteps) * 100);
            onProgress({
              completed: completedSteps,
              total: totalSteps,
              percent: pct,
              stage: `Downloading chunk ${completedSteps}/${totalSteps}...`,
            });
          }
        }
      });

      await Promise.all(workers);

      for (let i = 0; i < segmentUris.length; i++) {
        const segBuf = segResults.get(i);
        if (segBuf) chunks.push(segBuf);
      }

      const merged = Buffer.concat(chunks);
      fs.writeFileSync(finalPath, merged);

      const stats = fs.statSync(finalPath);
      const mb = (stats.size / (1024 * 1024)).toFixed(2);
      return {
        success: true,
        filePath: finalPath,
        fileSizeBytes: stats.size,
        fileSizeFormatted: `${mb} MB`,
        format: "fmp4/mp4",
      };
    }
  }
}
