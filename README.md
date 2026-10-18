# 🎬 Anime & Drama Scraper Suite

[![GitHub Topics](https://img.shields.io/badge/topics-anime--scraper%20%7C%20anime--api%20%7C%20dracinema-blue.svg)](https://github.com/Aevryns/anime-scraper)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24%2B-green?logo=node.js)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/SQLite-node%3Asqlite-lightgrey?logo=sqlite)](https://nodejs.org/api/sqlite.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/website-zeltoria.web.id-007acc?logo=googlechrome&logoColor=white)](https://zeltoria.web.id)

> **High-performance, complete web scraper and structured data extractor for [anime-indo.lol](https://anime-indo.lol/) and [dracinema.com](https://www.dracinema.com/).**  
> Mengambil seluruh katalog anime, drama Asia/China, detail lengkap (sinopsis, poster, genre tags), link episode, katalog film, kategori genre, update rilis episode terbaru, direct `.m3u8` HD 720p streams, subtitle `.srt`, dan link direct download.

---

### 🏷️ Tags & Topics
`#anime-scraper` `#anime-api` `#dracinema` `#drama-china` `#anime` `#scraper` `#crawler` `#typescript` `#nodejs` `#cheerio` `#animeindo` `#sqlite` `#api`

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
| **Video Streams (.m3u8 HD & Subtitle)** | **Tersedia via API** | JSON | Resolusi HD 720p `.m3u8` direct URL dan file subtitle `.srt` |

---

## ✨ Fitur Utama

- ⚡ **Super Fast & Lightweight**: Menggunakan parser **Cheerio** dan native `fetch` dengan concurrency worker pool.
- 📦 **Zero External DB Dependency**: Menggunakan database bawaan **`node:sqlite`** (SQLite sync engine bawaan Node.js v22/v24).
- 🔄 **Auto-Resume & Checkpoint**: Menyimpan progres ke SQLite, aman dari interupsi jaringan.
- 🛡️ **Built-in Validator**: Memvalidasi integritas URL, slug unik, judul, dan sanitasi metadata.
- 🎥 **Video Stream Extractor**:
  - **Anime-Indo**: Ekstraksi server embed (B-TUBE, GDRIVE, MP4Upload, YourUpload) dan link download (GDrive, MP4).
  - **Dracinema**: Ekstraksi token playback untuk mendapatkan direct stream link `.m3u8` (720p HD) dan direct link subtitle `.srt`.
- 🔍 **Search Engine**: Pencarian instan berdasarkan kata kunci ke katalog anime & drama.
- 🚀 **100% Pure TypeScript**: Type safety penuh dan kompatibilitas ES Modules modern.

---

## 📁 Struktur Direktori

```
.
├── src/
│   ├── models.ts            # Tipe data & interface Anime-Indo
│   ├── validator.ts         # Validasi URL & sanitasi Anime-Indo
│   ├── storage.ts           # SQLite & exporter Anime-Indo
│   ├── scraper.ts           # Crawler AnimeIndoScraper (Cheerio + fetch)
│   ├── cli.ts               # Antarmuka CLI Anime-Indo
│   ├── dracinema/
│   │   ├── models.ts        # Tipe data & interface Dracinema
│   │   ├── storage.ts       # SQLite & exporter Dracinema
│   │   ├── scraper.ts       # Crawler DracinemaScraper (Sitemap + Playback API)
│   │   ├── cli.ts           # Antarmuka CLI Dracinema
│   │   └── index.ts         # Module exports Dracinema
│   └── index.ts             # Main entry point exports
├── data/
│   ├── anime_indo.db        # Database SQLite Anime-Indo (4.635 anime + 56.593 episode)
│   ├── anime_list.json / .csv
│   ├── anime_details.json / .csv
│   ├── movies.json / .csv
│   ├── genres.json
│   ├── latest_updates.json
│   └── dracinema/           # Dataset Dracinema
│       ├── dracinema.db     # Database SQLite Dracinema (10.000 drama)
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
git clone https://github.com/Aevryns/anime-scraper.git
cd anime-scraper
npm install
npm run build
```

---

## 💻 Menjalankan Scraper via CLI

### A. Scraper Anime-Indo (`anime-indo.lol`)

```bash
# 1. Menampilkan ringkasan statistik database
npm run summary

# 2. Scraping penuh (Katalog, Genre, 41 Halaman Movie, 10 Halaman Update)
npm run scrape:all

# 3. Crawl seluruh detail lengkap anime (sinopsis, poster, seluruh episode)
npm run scrape:details

# 4. Mencari anime berdasarkan kata kunci
node dist/cli.js --search "One Piece"

# 5. Mengambil link streaming embed & direct download dari suatu episode
node dist/cli.js --episode "/one-piece-episode-001/"
```

### B. Scraper Dracinema (`dracinema.com`)

```bash
# 1. Menampilkan ringkasan statistik database Dracinema
npm run dracinema:summary

# 2. Scraping penuh (10.000 Drama Movie, 151 Genre, 28 Halaman Koleksi)
npm run dracinema:all

# 3. Ekstraksi detail drama lengkap (sinopsis, genre tags, daftar episode)
npx tsx src/dracinema/cli.ts --detail 1-hp-summon-tanpa-batas-dw_o6OsDcj9f2

# 4. Ekstraksi direct .m3u8 video stream (720p HD) & direct .srt subtitle
npx tsx src/dracinema/cli.ts --playback 1-hp-summon-tanpa-batas-dw_o6OsDcj9f2 --episode 1
```

---

## 🧩 Penggunaan sebagai Library TypeScript

### Anime-Indo:
```typescript
import { AnimeIndoScraper } from "./src/index.js";

const scraper = new AnimeIndoScraper();
const anime = await scraper.getAnimeDetail("one-piece");
console.log(`Judul: ${anime?.title}, Total Episode: ${anime?.episodesCount}`);
```

### Dracinema:
```typescript
import { Dracinema } from "./src/index.js";

const scraper = new Dracinema.DracinemaScraper();

// 1. Ambil detail drama
const detail = await scraper.getMovieDetail("1-hp-summon-tanpa-batas-dw_o6OsDcj9f2");
console.log(`Judul: ${detail?.title}, Total Episode: ${detail?.totalEpisodes}`);

// 2. Ambil direct link .m3u8 HD video stream dan subtitle .srt
const playback = await scraper.getPlaybackStream("1-hp-summon-tanpa-batas-dw_o6OsDcj9f2", 1);
console.log("Stream M3U8 URL:", playback?.videoUrls[0]?.url);
console.log("Subtitle SRT URL:", playback?.subtitleCdnUrl);
```
---

## 📄 Lisensi
[MIT License](LICENSE) © 2026 [Zeltoria Aevryns](https://zeltoria.web.id)
