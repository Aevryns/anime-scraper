import { AnimeItem, AnimeDetail, MovieItem, GenreItem, UpdateItem } from "./models.js";

export const BASE_URL = "https://anime-indo.lol";

export function normalizeUrl(url: string, base: string = BASE_URL): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  } else if (trimmed.startsWith("/")) {
    return new URL(trimmed, base).toString();
  } else if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return new URL("/" + trimmed, base).toString();
  }
  return trimmed;
}

export function validateAnimeItem(item: AnimeItem): { valid: boolean; reason?: string } {
  if (!item.title || !item.title.trim()) {
    return { valid: false, reason: "Title is empty" };
  }
  if (!item.slug || !item.slug.trim()) {
    return { valid: false, reason: "Slug is empty" };
  }
  if (!item.url || !item.url.startsWith(BASE_URL)) {
    return { valid: false, reason: `Invalid URL: ${item.url}` };
  }
  return { valid: true };
}

export function validateAnimeDetail(detail: AnimeDetail): { valid: boolean; reason?: string } {
  if (!detail.title || !detail.title.trim()) {
    return { valid: false, reason: "Title is empty" };
  }
  if (!detail.slug || !detail.slug.trim()) {
    return { valid: false, reason: "Slug is empty" };
  }
  if (!detail.url || !detail.url.startsWith(BASE_URL)) {
    return { valid: false, reason: `Invalid URL: ${detail.url}` };
  }
  if (detail.episodesCount < 0) {
    return { valid: false, reason: "Episodes count cannot be negative" };
  }
  return { valid: true };
}

export function validateMovieItem(item: MovieItem): { valid: boolean; reason?: string } {
  if (!item.title || !item.title.trim()) {
    return { valid: false, reason: "Title is empty" };
  }
  if (!item.slug || !item.slug.trim()) {
    return { valid: false, reason: "Slug is empty" };
  }
  if (!item.url || !item.url.startsWith(BASE_URL)) {
    return { valid: false, reason: `Invalid URL: ${item.url}` };
  }
  return { valid: true };
}

export function validateGenreItem(item: GenreItem): { valid: boolean; reason?: string } {
  if (!item.name || !item.name.trim()) {
    return { valid: false, reason: "Genre name is empty" };
  }
  if (!item.url || !item.url.startsWith(BASE_URL)) {
    return { valid: false, reason: `Invalid URL: ${item.url}` };
  }
  return { valid: true };
}

export function validateUpdateItem(item: UpdateItem): { valid: boolean; reason?: string } {
  if (!item.title || !item.title.trim()) {
    return { valid: false, reason: "Update title is empty" };
  }
  if (!item.url || !item.url.startsWith(BASE_URL)) {
    return { valid: false, reason: `Invalid URL: ${item.url}` };
  }
  return { valid: true };
}
