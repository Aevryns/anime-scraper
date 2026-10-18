# 🌐 Web Scraper Suite

[![GitHub Topics](https://img.shields.io/badge/topics-web--scraper%20%7C%20dracinema%20%7C%20anime--scraper-blue.svg)](https://github.com/Aevryns/web-scraper)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24%2B-green?logo=node.js)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/SQLite-node%3Asqlite-lightgrey?logo=sqlite)](https://nodejs.org/api/sqlite.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/website-zeltoria.web.id-007acc?logo=googlechrome&logoColor=white)](https://zeltoria.web.id)

> **All-in-one modular web scraper & data extraction suite built with TypeScript and Node.js.**  
> High-performance crawler engine featuring structured SQLite/JSON/CSV outputs, extensible plugin architecture for adding new scrapers, master playlist `.m3u8` stream resolution parser (1080p, 720p, 480p, etc.), direct raw subtitle extraction (`.srt`), and search API integration with local fallback.

---

### 🏷️ Tags & Topics
`#web-scraper` `#scraper` `#crawler` `#anime-scraper` `#anime-api` `#dracinema` `#drama-china` `#animeindo` `#data-extraction` `#typescript` `#nodejs` `#cheerio` `#sqlite` `#api`

---

## 📊 Dataset Statistics

Data yang telah terekstrak secara lengkap dan tersimpan di dalam folder [`data/`](./data):

### 1. Anime-Indo (`anime-indo.lol`)
Disimpan di `data/anime_indo.db`:
| Kategori Data | Jumlah Data Valid | Format Ekspor | Keterangan |
| :--- | :---: | :---: | :--- |
| **Katalog Anime (`anime`)** | **4.635** | SQLite, JSON, CSV | Seluruh direktori alfabetis (`/anime-list/`) |
| **Detail Lengkap (`anime_details`)** | **4.635** | SQLite, JSON, CSV | Sinopsis, poster URL, judul alternatif, tag genre |
| **Daftar Episode (`episodes`)** | **56.593** | SQLite | Terhubung relasional dengan anime slug |
| **Katalog Movie (`movies`)** | **605** | SQLite, JSON, CSV | 41 halaman film (`/movie/`) beserta durasi & tahun |
| **Kategori Genre (`genres`)** | **93** | SQLite, JSON | Seluruh kategori genre dari (`/list-genre/`) |
| **Update Terbaru (`latest_updates`)** | **159** | SQLite, JSON | Rilis episode terkini dari 10 halaman beranda |

### 2. Dracinema (`dracinema.com`)
Disimpan di `data/dracinema/dracinema.db`:
| Kategori Data | Jumlah Data Valid | Format Ekspor | Keterangan |
| :--- | :---: | :---: | :--- |
| **Katalog Drama / Movie (`movies`)** | **10.000+** | SQLite, JSON, CSV | Ekstraksi sitemap dengan judul, sinopsis, player URL |
| **Featured Collections (`collections`)** | **661** | SQLite, JSON, CSV | 28 halaman featured drama koleksi terpopuler |
| **Kategori Genre (`genres`)** | **151** | SQLite, JSON | Kategori genre lengkap dari sitemap |
| **Raw Video Streams (.m3u8 1080p/720p/etc)** | **Tersedia via CLI/API** | JSON, Console | Raw master & sub-playlist streams per resolusi (tanpa proxy) |
| **Raw Subtitles (.srt direct)** | **Tersedia via CLI/API** | Raw URL, Preview | File direct `.srt` langsung dari CDN tanpa proxy |

---

## ✨ Fitur Utama

- 🧩 **Modular Scraper Architecture**: Inti (`src/core/`) menyediakan `BaseScraper` dan `BaseStorage` yang mudah diwariskan untuk menambahkan situs scraper baru di `src/scrapers/<name>/`.
- ⚡ **Super Fast & Lightweight**: Menggunakan parser **Cheerio** dan native `fetch` dengan concurrency worker pool.
- 📦 **Zero External DB Dependency**: Menggunakan database bawaan **`node:sqlite`** (`DatabaseSync` bawaan Node.js modern).
- 🛡️ **Comprehensive Data Validation**: Seluruh data yang diekstrak divalidasi dan disanitasi sebelum disimpan ke SQLite atau diekspor.
- 🎥 **Raw Video Stream & Subtitle Extractor (Dracinema)**:
  - Mem-parsing master `.m3u8` menjadi direct raw stream URLs per resolusi: **1080p, 720p, 540p, 480p, 360p, 240p** tanpa melewati proxy.
  - Mendekode URL subtitle langsung dari CDN menjadi file **`.srt` mentah (raw direct URL)** tanpa proxy.
- 🔍 **Search Engine dengan Fallback**:
  - Dukungan pencarian Dracinema via endpoint API resmi (`/api/search?keyword=...`) dengan fallback cerdas ke pencarian SQLite lokal.
  - Dukungan pencarian Anime-Indo via query katalog dan database.
- 🚀 **100% Pure TypeScript**: Type safety penuh, ES Modules, dan kompilasi bersih ke `dist/`.

---

## 📁 Struktur Direktori

```
.
├── src/
│   ├── core/                        # Inti modul reusable
│   │   ├── types.ts                 # Metadata scraper & interface modul
│   │   ├── base-scraper.ts          # BaseScraper (retry, concurrency, fetch helpers)
│   │   ├── base-storage.ts          # BaseStorage (SQLite sync, JSON & CSV export)
│   │   └── index.ts                 # Core exports
│   ├── scrapers/                    # Direktori modul scraper
│   │   ├── animeindo/               # Scraper anime-indo.lol
│   │   │   ├── models.ts
│   │   │   ├── validator.ts
│   │   │   ├── storage.ts
│   │   │   ├── scraper.ts
│   │   │   ├── cli.ts
│   │   │   └── index.ts
│   │   ├── dracinema/               # Scraper dracinema.com
│   │   │   ├── models.ts
│   │   │   ├── validator.ts
│   │   │   ├── storage.ts
│   │   │   ├── scraper.ts
│   │   │   ├── cli.ts
│   │   │   └── index.ts
│   │   └── index.ts                 # Scraper registry (getScraper, listScrapers)
│   ├── cli.ts                       # CLI dispatcher universal
│   └── index.ts                     # Main library exports
├── data/                            # Dataset terstruktur
│   ├── anime_indo.db                # SQLite Anime-Indo (4.635 anime + 56.593 episode)
│   ├── anime_list.json / .csv
│   ├── anime_details.json / .csv
│   ├── movies.json / .csv
│   ├── genres.json
│   ├── latest_updates.json
│   └── dracinema/                   # Dataset Dracinema
│       ├── dracinema.db             # SQLite Dracinema (10.000 drama)
│       ├── dracinema_movies.json / .csv
│       ├── dracinema_collections.json / .csv
│       └── dracinema_genres.json
├── package.json
├── tsconfig.json
├── LICENSE
└── README.md
```

---

## 🚀 Panduan Instalasi & Penggunaan

### 1. Instalasi
```bash
git clone https://github.com/Aevryns/web-scraper.git
cd web-scraper
npm install
npm run build
```

---

## 💻 Menjalankan Scraper via CLI

### 1. Bantuan & Daftar Scraper
```bash
npx tsx src/cli.ts
```

### 2. Scraper Dracinema (`dracinema.com`)

```bash
# A. Cari Drama China berdasarkan kata kunci
npx tsx src/cli.ts dracinema --search "boss"

# B. Ekstraksi raw video streams (1080p, 720p, etc.) & raw .srt subtitle
npx tsx src/cli.ts dracinema --playback "1-hp-summon-tanpa-batas-dw_o6OsDcj9f2" --episode 1

# C. Tampilkan statistik database Dracinema
npx tsx src/cli.ts dracinema --summary

# D. Scraping penuh katalog sitemap, genre, dan koleksi
npx tsx src/cli.ts dracinema --all
```

### 3. Scraper Anime-Indo (`anime-indo.lol`)

```bash
# A. Tampilkan statistik database Anime-Indo
npx tsx src/cli.ts animeindo --summary

# B. Cari Anime berdasarkan kata kunci
npx tsx src/cli.ts animeindo --search "Naruto"

# C. Ekstraksi stream embed & download episode
npx tsx src/cli.ts animeindo --episode "/one-piece-episode-001/"

# D. Scraping penuh katalog anime
npx tsx src/cli.ts animeindo --all
```

---

## 🧩 Penggunaan sebagai Library TypeScript

### Menggunakan Dracinema:
```typescript
import { dracinema } from "./src/scrapers/index.js";

const scraper = new dracinema.DracinemaScraper();

// 1. Pencarian drama
const searchResults = await scraper.search("boss");
console.log(`Ditemukan ${searchResults.length} drama:`, searchResults[0].title);

// 2. Ekstraksi raw video streams (1080p/720p) & raw subtitle SRT
const playback = await scraper.getPlaybackStream("1-hp-summon-tanpa-batas-dw_o6OsDcj9f2", 1);
if (playback) {
  console.log("Master M3U8:", playback.masterPlaylistUrl);
  playback.rawStreams.forEach((s) => {
    console.log(`- ${s.quality} (${s.resolution}): ${s.rawStreamUrl}`);
  });
  console.log("Raw SRT Subtitle:", playback.rawSubtitleUrl);
}
```

### Menggunakan Anime-Indo:
```typescript
import { animeindo } from "./src/scrapers/index.js";

const scraper = new animeindo.AnimeIndoScraper();
const anime = await scraper.getAnimeDetail("one-piece");
console.log(`Judul: ${anime?.title}, Total Episode: ${anime?.episodesCount}`);
```

---

## ➕ Cara Menambahkan Scraper Baru

Untuk menambahkan situs target scraper baru, buat folder di `src/scrapers/<nama-situs>/`:

1. Buat `models.ts` untuk interface data.
2. Buat `validator.ts` untuk fungsi validasi dan sanitasi data.
3. Buat `storage.ts` dengan mewarisi `BaseStorage` dari `../../core/index.js`.
4. Buat `scraper.ts` dengan mewarisi `BaseScraper` dari `../../core/index.js`.
5. Buat `cli.ts` untuk menangani command line options.
6. Daftarkan di `src/scrapers/index.ts` pada objek `scrapers`.

---

## 📄 Lisensi
[MIT License](LICENSE) © 2026 [Zeltoria Aevryns](https://zeltoria.web.id)
