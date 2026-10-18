import { ScraperMetadata, ScraperModule } from "../core/types.js";
import * as animeindo from "./animeindo/index.js";
import * as dracinema from "./dracinema/index.js";

export * as animeindo from "./animeindo/index.js";
export * as dracinema from "./dracinema/index.js";

export const scrapers: Record<string, ScraperModule> = {
  animeindo: {
    metadata: {
      id: "animeindo",
      name: "Anime-Indo",
      baseUrl: "https://anime-indo.lol",
      description: "Anime streaming and downloads catalog scraper for anime-indo.lol",
    },
    runCli: animeindo.runCli,
  },
  dracinema: {
    metadata: {
      id: "dracinema",
      name: "Dracinema",
      baseUrl: "https://www.dracinema.com",
      description: "Chinese drama (Drachin / Short Drama) streaming and raw m3u8 extractor for dracinema.com",
    },
    runCli: dracinema.runCli,
  },
};

export function getScraper(id: string): ScraperModule | undefined {
  return scrapers[id.toLowerCase()];
}

export function listScrapers(): ScraperMetadata[] {
  return Object.values(scrapers).map((s) => s.metadata);
}
