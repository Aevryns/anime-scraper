import { cleanText, slugifyTitle } from "../../core/index.js";
import {
  DracinemaMovie,
  DracinemaGenre,
  DracinemaDetail,
  DracinemaEpisode,
  DracinemaPlayback,
  DracinemaSearchResult,
  RawStreamQuality,
} from "./models.js";

export { cleanText, slugifyTitle };

export function generateDracinemaSlug(title: string, bookId?: string): string {
  const clean = slugifyTitle(title);
  if (bookId) {
    if (clean.endsWith(bookId.toLowerCase())) {
      return clean;
    }
    return `${clean}-${bookId}`;
  }
  return clean;
}

export function validateDracinemaMovie(item: Partial<DracinemaMovie>): DracinemaMovie | null {
  const title = cleanText(item.title);
  const slug = cleanText(item.slug);
  const url = cleanText(item.url);

  if (!title || !slug || !url || !url.startsWith("http")) {
    return null;
  }

  return {
    title,
    slug,
    url,
    thumbnail: cleanText(item.thumbnail),
    description: cleanText(item.description),
    playerUrl: cleanText(item.playerUrl) || url.replace("/movie/", "/play/"),
    lastmod: item.lastmod ? cleanText(item.lastmod) : undefined,
  };
}

export function validateDracinemaGenre(item: Partial<DracinemaGenre>): DracinemaGenre | null {
  const name = cleanText(item.name);
  const slug = cleanText(item.slug);
  const url = cleanText(item.url);

  if (!name || !slug || !url) {
    return null;
  }

  return { name, slug, url };
}

export function validateDracinemaEpisode(item: Partial<DracinemaEpisode>): DracinemaEpisode | null {
  const epNum = Number(item.episodeNumber);
  const playUrl = cleanText(item.playUrl);

  if (isNaN(epNum) || epNum <= 0 || !playUrl || !playUrl.startsWith("http")) {
    return null;
  }

  return {
    episodeNumber: epNum,
    playUrl,
  };
}

export function validateDracinemaDetail(item: Partial<DracinemaDetail>): DracinemaDetail | null {
  const title = cleanText(item.title);
  const slug = cleanText(item.slug);
  const url = cleanText(item.url);

  if (!title || !slug || !url) {
    return null;
  }

  const validEpisodes: DracinemaEpisode[] = [];
  if (Array.isArray(item.episodes)) {
    for (const ep of item.episodes) {
      const v = validateDracinemaEpisode(ep);
      if (v) validEpisodes.push(v);
    }
  }

  return {
    title,
    slug,
    url,
    cover: cleanText(item.cover),
    genres: Array.isArray(item.genres) ? item.genres.map(cleanText).filter(Boolean) : [],
    synopsis: cleanText(item.synopsis),
    totalEpisodes: Number(item.totalEpisodes) || validEpisodes.length,
    releasedEpisodes: Number(item.releasedEpisodes) || validEpisodes.length,
    episodes: validEpisodes,
  };
}

export function validateRawStreamQuality(item: Partial<RawStreamQuality>): RawStreamQuality | null {
  const quality = cleanText(item.quality);
  const rawStreamUrl = cleanText(item.rawStreamUrl);
  const resolution = cleanText(item.resolution);
  const height = Number(item.height);
  const format = item.format === "mp4" ? "mp4" : "hls";
  const isDirectPlayable = item.isDirectPlayable !== undefined ? Boolean(item.isDirectPlayable) : format === "mp4";

  if (!quality || !rawStreamUrl || !rawStreamUrl.startsWith("http")) {
    return null;
  }

  return {
    quality,
    resolution: resolution || `${height}p`,
    height: isNaN(height) ? 0 : height,
    format,
    bandwidth: item.bandwidth ? Number(item.bandwidth) : undefined,
    rawStreamUrl,
    isDirectPlayable,
  };
}

export function validateDracinemaPlayback(item: Partial<DracinemaPlayback>): DracinemaPlayback | null {
  const movieKey = cleanText(item.movieKey);
  const episode = Number(item.episode);
  const masterPlaylistUrl = cleanText(item.masterPlaylistUrl);
  const videoFormat = item.videoFormat === "mp4" ? "mp4" : "hls";

  if (!movieKey || isNaN(episode) || episode <= 0 || !masterPlaylistUrl) {
    return null;
  }

  const validStreams: RawStreamQuality[] = [];
  if (Array.isArray(item.rawStreams)) {
    for (const s of item.rawStreams) {
      const vs = validateRawStreamQuality(s);
      if (vs) validStreams.push(vs);
    }
  }

  return {
    movieKey,
    episode,
    movieName: cleanText(item.movieName) || movieKey,
    cover: cleanText(item.cover),
    chapterName: cleanText(item.chapterName) || `Episode ${episode}`,
    videoFormat,
    directMp4Url: item.directMp4Url ? cleanText(item.directMp4Url) : undefined,
    webPlayerUrl: cleanText(item.webPlayerUrl) || `https://www.dracinema.com/play/${movieKey}/${episode}`,
    masterPlaylistUrl,
    rawStreams: validStreams,
    rawSubtitleUrl: item.rawSubtitleUrl ? cleanText(item.rawSubtitleUrl) : undefined,
    subtitleProxyUrl: item.subtitleProxyUrl ? cleanText(item.subtitleProxyUrl) : undefined,
    subtitlesPreview: item.subtitlesPreview,
  };
}

export function validateDracinemaSearchResult(item: Partial<DracinemaSearchResult>): DracinemaSearchResult | null {
  const bookId = cleanText(item.bookId);
  const title = cleanText(item.title);
  const slug = cleanText(item.slug);

  if (!bookId || !title || !slug) {
    return null;
  }

  const movieUrl = cleanText(item.movieUrl) || `https://www.dracinema.com/movie/${slug}`;
  const playUrl = cleanText(item.playUrl) || `https://www.dracinema.com/play/${slug}`;

  return {
    bookId,
    title,
    slug,
    cover: cleanText(item.cover),
    synopsis: cleanText(item.synopsis),
    chapterCount: Number(item.chapterCount) || 0,
    movieUrl,
    playUrl,
    similarity: item.similarity !== undefined ? Number(item.similarity) : undefined,
  };
}
