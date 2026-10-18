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

export interface VideoStreamQuality {
  quality: number;
  url: string;
  cdn?: string;
}

export interface DracinemaPlayback {
  movieKey: string;
  episode: number;
  movieName: string;
  cover: string;
  chapterName: string;
  videoUrls: VideoStreamQuality[];
  subtitleCdnUrl?: string;
  subtitlesPreview?: string;
}
