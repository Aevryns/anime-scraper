import { AnimeIndoScraper } from "./scraper.js";
import { AnimeIndoStorage } from "./storage.js";

export function printBanner(): void {
  console.log("=".repeat(60));
  console.log("   ANIME-INDO.LOL FULL SCRAPER & EXTRACTOR");
  console.log("=".repeat(60));
}

export async function scrapeAnimeList(scraper: AnimeIndoScraper, storage: AnimeIndoStorage) {
  console.log("\n[*] Mengambil seluruh daftar anime dari /anime-list/...");
  const start = Date.now();
  const items = await scraper.getAnimeList();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`[+] Berhasil mendapatkan ${items.length} anime valid dalam ${elapsed}s!`);
  const count = storage.saveAnimeList(items);
  console.log(`[+] Disimpan ke database SQLite (${count} baris di tabel 'anime')`);

  const jsonPath = storage.exportJson("anime_list.json", items);
  const csvPath = storage.exportCsv("anime_list.csv", items as any, ["letter", "slug", "title", "url"]);
  console.log(`[+] Export JSON: ${jsonPath}`);
  console.log(`[+] Export CSV:  ${csvPath}`);
  return items;
}

export async function scrapeGenres(scraper: AnimeIndoScraper, storage: AnimeIndoStorage) {
  console.log("\n[*] Mengambil daftar genre dari /list-genre/...");
  const start = Date.now();
  const genres = await scraper.getGenres();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`[+] Berhasil mendapatkan ${genres.length} genre valid dalam ${elapsed}s!`);
  const count = storage.saveGenres(genres);
  console.log(`[+] Disimpan ke database SQLite (${count} baris di tabel 'genres')`);

  const jsonPath = storage.exportJson("genres.json", genres);
  console.log(`[+] Export JSON: ${jsonPath}`);
  return genres;
}

export async function scrapeMovies(scraper: AnimeIndoScraper, storage: AnimeIndoStorage, maxPages?: number) {
  console.log("\n[*] Mengambil seluruh daftar movie dari /movie/...");
  const start = Date.now();
  const movies = await scraper.getAllMovies(maxPages, (page, total) => {
    if (page % 5 === 0 || page === total) {
      console.log(`    - Memproses movie halaman ${page}/${total}...`);
    }
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`[+] Berhasil mendapatkan ${movies.length} movie valid dalam ${elapsed}s!`);
  const count = storage.saveMovies(movies);
  console.log(`[+] Disimpan ke database SQLite (${count} baris di tabel 'movies')`);

  const jsonPath = storage.exportJson("movies.json", movies);
  const csvPath = storage.exportCsv("movies.csv", movies as any, [
    "slug",
    "title",
    "url",
    "imageUrl",
    "labels",
    "description",
  ]);
  console.log(`[+] Export JSON: ${jsonPath}`);
  console.log(`[+] Export CSV:  ${csvPath}`);
  return movies;
}

export async function scrapeUpdates(scraper: AnimeIndoScraper, storage: AnimeIndoStorage, pages: number = 10) {
  console.log(`\n[*] Mengambil update episode terbaru (${pages} halaman)...`);
  const start = Date.now();
  const updates = await scraper.getLatestUpdates(pages);
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`[+] Berhasil mendapatkan ${updates.length} update episode terbaru dalam ${elapsed}s!`);
  const count = storage.saveLatestUpdates(updates);
  console.log(`[+] Disimpan ke database SQLite (${count} baris di tabel 'latest_updates')`);

  const jsonPath = storage.exportJson("latest_updates.json", updates);
  console.log(`[+] Export JSON: ${jsonPath}`);
  return updates;
}

export async function scrapeDetails(scraper: AnimeIndoScraper, storage: AnimeIndoStorage, limit?: number, concurrency: number = 20) {
  console.log("\n[*] Menyiapkan crawling detail anime (sinopsis, genre, poster, daftar episode)...");
  let animeItems = storage.getAllAnimeItems();
  if (!animeItems.length) {
    animeItems = await scraper.getAnimeList();
    storage.saveAnimeList(animeItems);
  }

  const crawledSlugs = storage.getCrawledDetailSlugs();
  let toCrawl = animeItems.filter((it) => !crawledSlugs.has(it.slug));
  if (limit) toCrawl = toCrawl.slice(0, limit);

  console.log(`[*] Total anime di katalog: ${animeItems.length}`);
  console.log(`[*] Sudah di-crawl sebelumnya: ${crawledSlugs.size}`);
  console.log(`[*] Target yang akan di-crawl sekarang: ${toCrawl.length}`);

  if (toCrawl.length === 0) {
    console.log("[+] Semua detail anime sudah lengkap tersimpan di database!");
    return;
  }

  const start = Date.now();
  await scraper.crawlAnimeDetailsAsync(toCrawl, concurrency, 50, (completed, total, batch) => {
    const pct = total ? ((completed / total) * 100).toFixed(1) : "100.0";
    console.log(`    -> Progress: ${completed}/${total} (${pct}%) | Batch ini berhasil: ${batch.length}`);
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const stats = storage.getStats();
  console.log(`[+] Selesai crawling detail anime dalam ${elapsed}s!`);
  console.log(`[+] Total anime_details tersimpan: ${stats["anime_details"] || 0}`);
  console.log(`[+] Total episode tersimpan: ${stats["episodes"] || 0}`);
}

export function printSummary(storage: AnimeIndoStorage): void {
  console.log("\n" + "=".repeat(60));
  console.log("            ANIME-INDO DATABASE & SCRAPER STATS");
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

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  printBanner();
  const args = parseArgs(argv);

  const storage = new AnimeIndoStorage();
  const scraper = new AnimeIndoScraper(undefined, storage);

  if (args["summary"]) {
    printSummary(storage);
    return;
  }

  if (args["search"]) {
    const query = String(args["search"]);
    console.log(`\n[*] Mencari anime dengan kata kunci '${query}'...`);
    const results = await scraper.search(query);
    console.log(`[+] Ditemukan ${results.length} hasil:`);
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.title} (${r.slug})`);
      console.log(`   URL: ${r.url}`);
      if (r.labels.length) console.log(`   Labels: ${r.labels.join(", ")}`);
    });
    return;
  }

  if (args["episode"]) {
    const urlOrSlug = String(args["episode"]);
    console.log(`\n[*] Mengambil stream & download: ${urlOrSlug}`);
    const stream = await scraper.getEpisodeStream(urlOrSlug);
    console.log(JSON.stringify(stream, null, 2));
    return;
  }

  if (args["all"]) {
    await scrapeAnimeList(scraper, storage);
    await scrapeGenres(scraper, storage);
    await scrapeMovies(scraper, storage, typeof args["max-movie-pages"] === "number" ? args["max-movie-pages"] : undefined);
    await scrapeUpdates(scraper, storage, typeof args["update-pages"] === "number" ? args["update-pages"] : 10);
    printSummary(storage);
    return;
  }

  let executed = false;
  if (args["anime-list"]) {
    await scrapeAnimeList(scraper, storage);
    executed = true;
  }
  if (args["genres"]) {
    await scrapeGenres(scraper, storage);
    executed = true;
  }
  if (args["movies"]) {
    await scrapeMovies(scraper, storage, typeof args["max-movie-pages"] === "number" ? args["max-movie-pages"] : undefined);
    executed = true;
  }
  if (args["updates"]) {
    await scrapeUpdates(scraper, storage, typeof args["update-pages"] === "number" ? args["update-pages"] : 10);
    executed = true;
  }
  if (args["details"]) {
    const limit = typeof args["limit-details"] === "number" ? args["limit-details"] : undefined;
    const concurrency = typeof args["concurrency"] === "number" ? args["concurrency"] : 20;
    await scrapeDetails(scraper, storage, limit, concurrency);
    executed = true;
  }

  if (!executed) {
    console.log("[!] Menjalankan mode default --all...");
    await scrapeAnimeList(scraper, storage);
    await scrapeGenres(scraper, storage);
    await scrapeMovies(scraper, storage, typeof args["max-movie-pages"] === "number" ? args["max-movie-pages"] : undefined);
    await scrapeUpdates(scraper, storage, typeof args["update-pages"] === "number" ? args["update-pages"] : 10);
    printSummary(storage);
  }
}
