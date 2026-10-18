import { DracinemaScraper } from "./scraper.js";
import { DracinemaStorage } from "./storage.js";

function printBanner(): void {
  console.log("=".repeat(60));
  console.log("   DRACINEMA.COM FULL SCRAPER & EXTRACTOR (TypeScript/Node.js)");
  console.log("=".repeat(60));
}

async function scrapeMovies(scraper: DracinemaScraper, storage: DracinemaStorage, sitemapIndex: number = 1) {
  console.log(`\n[*] Mengambil daftar drama/movie dari sitemaps/movies-${sitemapIndex}.xml...`);
  const start = Date.now();
  const movies = await scraper.getMoviesFromSitemap(sitemapIndex);
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`[+] Berhasil mendapatkan ${movies.length} movie/drama valid dalam ${elapsed}s!`);
  const count = storage.saveMovies(movies);
  console.log(`[+] Disimpan ke database SQLite (${count} baris di tabel 'movies')`);

  const jsonPath = storage.exportJson("dracinema_movies.json", movies);
  const csvPath = storage.exportCsv("dracinema_movies.csv", movies as any, [
    "slug",
    "title",
    "url",
    "thumbnail",
    "description",
    "playerUrl",
    "lastmod",
  ]);
  console.log(`[+] Export JSON: ${jsonPath}`);
  console.log(`[+] Export CSV:  ${csvPath}`);
  return movies;
}

async function scrapeGenres(scraper: DracinemaScraper, storage: DracinemaStorage) {
  console.log("\n[*] Mengambil seluruh daftar genre dari sitemaps/pages.xml...");
  const start = Date.now();
  const genres = await scraper.getGenres();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`[+] Berhasil mendapatkan ${genres.length} genre valid dalam ${elapsed}s!`);
  const count = storage.saveGenres(genres);
  console.log(`[+] Disimpan ke database SQLite (${count} baris di tabel 'genres')`);

  const jsonPath = storage.exportJson("dracinema_genres.json", genres);
  console.log(`[+] Export JSON: ${jsonPath}`);
  return genres;
}

async function scrapeCollections(scraper: DracinemaScraper, storage: DracinemaStorage, maxPages: number = 28) {
  console.log(`\n[*] Mengambil featured collections (${maxPages} halaman)...`);
  const start = Date.now();
  const collections = await scraper.getCollections(maxPages, (page, total) => {
    if (page % 5 === 0 || page === total) {
      console.log(`    - Memproses koleksi halaman ${page}/${total}...`);
    }
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`[+] Berhasil mendapatkan ${collections.length} koleksi valid dalam ${elapsed}s!`);
  const count = storage.saveCollections(collections);
  console.log(`[+] Disimpan ke database SQLite (${count} baris di tabel 'collections')`);

  const jsonPath = storage.exportJson("dracinema_collections.json", collections);
  const csvPath = storage.exportCsv("dracinema_collections.csv", collections as any, ["slug", "title", "url", "thumbnail"]);
  console.log(`[+] Export JSON: ${jsonPath}`);
  console.log(`[+] Export CSV:  ${csvPath}`);
  return collections;
}

async function scrapeDetail(scraper: DracinemaScraper, storage: DracinemaStorage, urlOrSlug: string) {
  console.log(`\n[*] Mengambil detail drama: ${urlOrSlug}...`);
  const detail = await scraper.getMovieDetail(urlOrSlug);
  if (!detail) {
    console.log("[-] Gagal mengambil detail drama.");
    return;
  }
  console.log(`[+] Judul: ${detail.title}`);
  console.log(`[+] Total Episode: ${detail.totalEpisodes}`);
  console.log(`[+] Genres: ${detail.genres.join(", ")}`);
  if (detail.synopsis) console.log(`[+] Sinopsis:\n${detail.synopsis.slice(0, 200)}...`);

  storage.saveDetailsBatch([detail]);
  console.log("[+] Detail dan daftar episode disimpan ke database SQLite!");
}

async function scrapePlayback(scraper: DracinemaScraper, movieKey: string, episode: number = 1) {
  console.log(`\n[*] Mengambil video stream (.m3u8) & subtitle untuk: ${movieKey} (Episode ${episode})...`);
  const stream = await scraper.getPlaybackStream(movieKey, episode);
  if (!stream) {
    console.log("[-] Gagal mengambil video stream.");
    return;
  }
  console.log(JSON.stringify(stream, null, 2));
}

function printSummary(storage: DracinemaStorage): void {
  console.log("\n" + "=".repeat(60));
  console.log("             DRACINEMA DATABASE & SCRAPER STATS");
  console.log("=".repeat(60));
  const stats = storage.getStats();
  for (const [table, count] of Object.entries(stats)) {
    console.log(` - ${table.padEnd(18)}: ${String(count).padStart(6)} baris`);
  }
  console.log("=".repeat(60));
}

function parseArgs(args: string[]): Record<string, string | boolean | number> {
  const parsed: Record<string, string | boolean | number> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        const num = Number(next);
        parsed[key] = isNaN(num) ? next : num;
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }
  return parsed;
}

async function main() {
  printBanner();
  const args = parseArgs(process.argv.slice(2));

  const storage = new DracinemaStorage();
  const scraper = new DracinemaScraper(undefined, storage);

  if (args["summary"]) {
    printSummary(storage);
    return;
  }

  if (args["playback"]) {
    const movieKey = String(args["playback"]);
    const ep = typeof args["episode"] === "number" ? args["episode"] : 1;
    await scrapePlayback(scraper, movieKey, ep);
    return;
  }

  if (args["detail"]) {
    await scrapeDetail(scraper, storage, String(args["detail"]));
    return;
  }

  if (args["all"]) {
    const sitemapIdx = typeof args["sitemap-index"] === "number" ? args["sitemap-index"] : 1;
    await scrapeMovies(scraper, storage, sitemapIdx);
    await scrapeGenres(scraper, storage);
    await scrapeCollections(scraper, storage, typeof args["max-pages"] === "number" ? args["max-pages"] : 28);
    printSummary(storage);
    return;
  }

  let executed = false;
  if (args["movies"]) {
    const sitemapIdx = typeof args["sitemap-index"] === "number" ? args["sitemap-index"] : 1;
    await scrapeMovies(scraper, storage, sitemapIdx);
    executed = true;
  }
  if (args["genres"]) {
    await scrapeGenres(scraper, storage);
    executed = true;
  }
  if (args["collections"]) {
    await scrapeCollections(scraper, storage, typeof args["max-pages"] === "number" ? args["max-pages"] : 28);
    executed = true;
  }

  if (!executed) {
    console.log("[!] Menjalankan mode default --all...");
    await scrapeMovies(scraper, storage, 1);
    await scrapeGenres(scraper, storage);
    await scrapeCollections(scraper, storage, 28);
    printSummary(storage);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
