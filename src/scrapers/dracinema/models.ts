export interface DracinemaMovie {
  title: string;
  slug: string;
  url: string;
  thumbnail: string;
  description: string;
  playerUrl: string;
  lastmod?: string;
}

export interface DracinemaGenre {
  name: string;
  slug: string;
  url: string;
}

export interface DracinemaEpisode {
  episodeNumber: number;
  playUrl: string;
}

export interface DracinemaDetail {
  title: string;
  slug: string;
  url: string;
  cover: string;
  genres: string[];
  synopsis: string;
  totalEpisodes: number;
  releasedEpisodes: number;
  episodes: DracinemaEpisode[];
}

export interface RawStreamQuality {
  quality: string;        // e.g. "1080p", "720p", "540p", "480p", "360p", "240p"
  resolution: string;     // e.g. "1920x1080"
  height: number;         // e.g. 1080
  bandwidth?: number;     // e.g. 3894736
  rawStreamUrl: string;   // Direct .m3u8 stream URL (no proxy)
}

export interface DracinemaPlayback {
  movieKey: string;
  episode: number;
  movieName: string;
  cover: string;
  chapterName: string;
  masterPlaylistUrl: string;       // Original master .m3u8 URL
  rawStreams: RawStreamQuality[];  // Parsed individual stream URLs by quality
  rawSubtitleUrl?: string;         // Direct .srt subtitle URL from CDN (no proxy)
  subtitleProxyUrl?: string;       // Proxied subtitle URL if needed
  subtitlesPreview?: string;       // Subtitle text preview
}

export interface DracinemaSearchResult {
  bookId: string;
  title: string;
  slug: string;
  cover: string;
  synopsis: string;
  chapterCount: number;
  movieUrl: string;
  playUrl: string;
  similarity?: number;
}
