export interface AnimeItem {
  title: string;
  slug: string;
  url: string;
  letter: string;
}

export interface EpisodeRef {
  episode: string;
  url: string;
}

export interface AnimeDetail {
  title: string;
  altTitle: string;
  slug: string;
  url: string;
  imageUrl: string;
  genres: string[];
  synopsis: string;
  episodesCount: number;
  episodes: EpisodeRef[];
}

export interface MovieItem {
  title: string;
  slug: string;
  url: string;
  imageUrl: string;
  labels: string[];
  description: string;
}

export interface GenreItem {
  name: string;
  slug: string;
  url: string;
}

export interface UpdateItem {
  title: string;
  episode: string;
  url: string;
  imageUrl: string;
}

export interface VideoServer {
  name: string;
  videoUrl: string;
}

export interface DownloadLink {
  name: string;
  url: string;
}

export interface EpisodeStream {
  episodeTitle: string;
  episodeUrl: string;
  mainVideo: string | null;
  servers: VideoServer[];
  downloads: DownloadLink[];
  parentAnimeUrl: string | null;
  prevUrl: string | null;
  nextUrl: string | null;
}

export interface SearchResult {
  title: string;
  slug: string;
  url: string;
  imageUrl: string;
  labels: string[];
  description: string;
}
