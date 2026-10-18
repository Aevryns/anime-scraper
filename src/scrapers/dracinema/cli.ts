import { parseArgs } from "../../core/index.js";
import { DracinemaScraper } from "./scraper.js";
import { DracinemaStorage } from "./storage.js";

export function printBanner(): void {
  console.log("=".repeat(60));
  console.log("       DRACINEMA (DRAMA CHINA) SCRAPER & RAW EXTRACTOR");
  console.log("=".repeat(60));
}

export async function scrapeSitemaps(scraper: DracinemaScraper, storage: DracinemaStorage, maxSitemaps: number = 5) {
  console.log(`\n[*] Mengambil daftar drama dari sitemap (1 s/d ${maxSitemaps})...`);
  const start = Date.now();
  const movies = await scraper.getAllMoviesFromSitemaps(maxSitemaps, (idx, total, count) => {
    console.log(`    - Sitemap movies-${idx}.xml selesai (+${count} item baru)`);
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`[+] Berhasil mendapatkan ${movies.length} drama valid dalam ${elapsed}s!`);
  const count = storage.saveMovies(movies);
  console.log(`[+] Disimpan ke database SQLite (${count} baris di tabel 'movies')`);

  const jsonPath = storage.exportJson("dracinema_movies.json", movies);
  const csvPath = storage.exportCsv("dracinema_movies.csv", movies as any, [
    "slug",
    "title",
    "url",
    "thumbnail",
    "playerUrl",
    "lastmod",
  ]);
  console.log(`[+] Export JSON: ${jsonPath}`);
  console.log(`[+] Export CSV:  ${csvPath}`);
  return movies;
}

export async function scrapeGenres(scraper: DracinemaScraper, storage: DracinemaStorage) {
  console.log("\n[*] Mengambil daftar genre dari sitemaps/pages.xml...");
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

export async function scrapeCollections(scraper: DracinemaScraper, storage: DracinemaStorage, maxPages: number = 28) {
  console.log(`\n[*] Mengambil daftar koleksi (${maxPages} halaman)...`);
  const start = Date.now();
  const collections = await scraper.getCollections(maxPages, (page, total) => {
    if (page % 5 === 0 || page === total) {
      console.log(`    - Memproses halaman koleksi ${page}/${total}...`);
    }
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`[+] Berhasil mendapatkan ${collections.length} koleksi dalam ${elapsed}s!`);
  const count = storage.saveCollections(collections);
  console.log(`[+] Disimpan ke database SQLite (${count} baris di tabel 'collections')`);

  const jsonPath = storage.exportJson("dracinema_collections.json", collections);
  console.log(`[+] Export JSON: ${jsonPath}`);
  return collections;
}

export async function scrapeDetails(scraper: DracinemaScraper, storage: DracinemaStorage, limit?: number, concurrency: number = 10) {
  console.log("\n[*] Menyiapkan crawling detail drama (sinopsis, genre, episode)...");
  let movies = storage.getAllMovies();
  if (!movies.length) {
    movies = await scraper.getAllMoviesFromSitemaps(2);
    storage.saveMovies(movies);
  }

  const crawledSlugs = storage.getCrawledDetailSlugs();
  let toCrawl = movies.filter((m) => !crawledSlugs.has(m.slug));
  if (limit) toCrawl = toCrawl.slice(0, limit);

  console.log(`[*] Total drama di katalog: ${movies.length}`);
  console.log(`[*] Sudah di-crawl sebelumnya: ${crawledSlugs.size}`);
  console.log(`[*] Target yang akan di-crawl sekarang: ${toCrawl.length}`);

  if (toCrawl.length === 0) {
    console.log("[+] Semua detail drama sudah lengkap tersimpan di database!");
    return;
  }

  const start = Date.now();
  await scraper.crawlMovieDetailsAsync(toCrawl, concurrency, 25, (completed, total, batch) => {
    const pct = total ? ((completed / total) * 100).toFixed(1) : "100.0";
    console.log(`    -> Progress: ${completed}/${total} (${pct}%) | Batch ini berhasil: ${batch.length}`);
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const stats = storage.getStats();
  console.log(`[+] Selesai crawling detail drama dalam ${elapsed}s!`);
  console.log(`[+] Total details tersimpan: ${stats["details"] || 0}`);
  console.log(`[+] Total episodes tersimpan: ${stats["episodes"] || 0}`);
}

export function printSummary(storage: DracinemaStorage): void {
  console.log("\n" + "=".repeat(60));
  console.log("            DRACINEMA DATABASE & SCRAPER STATS");
  console.log("=".repeat(60));
  const stats = storage.getStats();
  for (const [table, count] of Object.entries(stats)) {
    console.log(` - ${table.padEnd(18)}: ${String(count).padStart(6)} baris`);
  }
  console.log("=".repeat(60));
}


export async function runCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  printBanner();
  const args = parseArgs(argv);

  const storage = new DracinemaStorage();
  const scraper = new DracinemaScraper(undefined, storage);

  if (args["summary"]) {
    printSummary(storage);
    return;
  }

  if (args["search"]) {
    const query = String(args["search"]);
    console.log(`\n[*] Mencari drama China dengan kata kunci '${query}'...`);
    const results = await scraper.search(query);
    console.log(`[+] Ditemukan ${results.length} hasil:\n`);
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.title} (${r.slug})`);
      console.log(`   Book ID  : ${r.bookId}`);
      console.log(`   Episodes : ${r.chapterCount || "?"}`);
      console.log(`   Movie URL: ${r.movieUrl}`);
      console.log(`   Play URL : ${r.playUrl}`);
      if (r.synopsis) console.log(`   Synopsis : ${r.synopsis.slice(0, 100)}...`);
      console.log("");
    });
    return;
  }

  if (args["download"]) {
    const slug = String(args["download"]);
    const episode = typeof args["episode"] === "number" ? args["episode"] : 1;
    const outputPath = typeof args["output"] === "string" ? args["output"] : undefined;
    console.log(`\n[*] Mengunduh video MP4 untuk '${slug}' Episode ${episode}...`);
    try {
      const result = await scraper.downloadEpisodeMp4(slug, episode, outputPath, (p) => {
        process.stdout.write(`\r    -> [${p.percent}%] ${p.stage}`);
      });
      console.log(`\n[+] Unduhan selesai berhasil!`);
      console.log(`    File path : ${result.filePath}`);
      console.log(`    Ukuran    : ${result.fileSizeFormatted} (${result.fileSizeBytes} bytes)`);
      console.log(`    Format    : ${result.format}`);
    } catch (err: any) {
      console.error(`\n[-] Gagal mengunduh video: ${err.message || err}`);
    }
    return;
  }

  if (args["playback"]) {
    const slug = String(args["playback"]);
    const episode = typeof args["episode"] === "number" ? args["episode"] : 1;
    console.log(`\n[*] Mengambil raw video & subtitle untuk '${slug}' Episode ${episode}...`);
    const playback = await scraper.getPlaybackStream(slug, episode);

    if (!playback) {
      console.error(`[-] Gagal mendapatkan playback untuk '${slug}' episode ${episode}.`);
      return;
    }

    console.log("\n" + "=".repeat(60));
    console.log(`Judul       : ${playback.movieName}`);
    console.log(`Episode     : ${playback.chapterName}`);
    console.log(`Format      : ${playback.videoFormat.toUpperCase()} (${playback.videoFormat === "mp4" ? "Direct Playable MP4 Video" : "HLS Playlist"})`);
    console.log(`Cover       : ${playback.cover}`);
    console.log(`Web Player  : ${playback.webPlayerUrl}`);
    if (playback.directMp4Url) {
      console.log(`Direct MP4  : ${playback.directMp4Url}`);
    }
    console.log(`Master URL  : ${playback.masterPlaylistUrl}`);
    console.log("-".repeat(60));
    console.log(`Raw Stream Qualities (${playback.videoFormat === "mp4" ? "Direct MP4 URLs" : "HLS Stream URLs"}):`);
    playback.rawStreams.forEach((s) => {
      const typeTag = s.format === "mp4" ? "[Direct MP4]" : "[HLS Playlist]";
      console.log(`  [${s.quality.padEnd(5)}] (${s.resolution.padEnd(9)}) ${typeTag} => ${s.rawStreamUrl}`);
    });
    console.log("-".repeat(60));
    if (playback.rawSubtitleUrl) {
      console.log(`Raw Subtitle (.srt direct) : ${playback.rawSubtitleUrl}`);
    }
    if (playback.subtitleProxyUrl) {
      console.log(`Subtitle Proxy URL         : ${playback.subtitleProxyUrl}`);
    }
    if (playback.subtitlesPreview) {
      console.log(`Subtitle Preview           :\n${playback.subtitlesPreview.slice(0, 200)}...`);
    }
    if (playback.videoFormat === "hls") {
      console.log("-".repeat(60));
      console.log(`[Info] Stream ini menggunakan format HLS (.m3u8). Browser biasa (Chrome/Edge) mendownload file teks m3u8 jika diklik langsung.`);
      console.log(`       - Putar langsung di browser: ${playback.webPlayerUrl}`);
      console.log(`       - Atau unduh sebagai video .mp4 utuh:`);
      console.log(`         npm run dracinema -- --download "${slug}" --episode ${episode}`);
    } else {
      console.log("-".repeat(60));
      console.log(`[Info] Stream ini adalah Direct MP4! Siap diputar langsung di browser, VLC, atau media player.`);
      console.log(`       - Unduh file .mp4 langsung:`);
      console.log(`         npm run dracinema -- --download "${slug}" --episode ${episode}`);
    }
    console.log("=".repeat(60));
    return;
  }

  if (args["all"]) {
    await scrapeSitemaps(scraper, storage, typeof args["sitemaps"] === "number" ? args["sitemaps"] : 5);
    await scrapeGenres(scraper, storage);
    await scrapeCollections(scraper, storage, typeof args["collections-pages"] === "number" ? args["collections-pages"] : 28);
    printSummary(storage);
    return;
  }

  let executed = false;
  if (args["movies"]) {
    await scrapeSitemaps(scraper, storage, typeof args["sitemaps"] === "number" ? args["sitemaps"] : 5);
    executed = true;
  }
  if (args["genres"]) {
    await scrapeGenres(scraper, storage);
    executed = true;
  }
  if (args["collections"]) {
    await scrapeCollections(scraper, storage, typeof args["collections-pages"] === "number" ? args["collections-pages"] : 28);
    executed = true;
  }
  if (args["details"]) {
    const limit = typeof args["limit-details"] === "number" ? args["limit-details"] : undefined;
    const concurrency = typeof args["concurrency"] === "number" ? args["concurrency"] : 10;
    await scrapeDetails(scraper, storage, limit, concurrency);
    executed = true;
  }

  if (!executed) {
    console.log("[!] Menjalankan mode default --all...");
    await scrapeSitemaps(scraper, storage, 5);
    await scrapeGenres(scraper, storage);
    await scrapeCollections(scraper, storage, 28);
    printSummary(storage);
  }
}
