# 🎬 Anime Scraper & API (anime-indo.lol)

[![GitHub Topics](https://img.shields.io/badge/topics-anime--scraper%20%7C%20anime--api-blue.svg)](https://github.com/Aevryns/anime-scraper)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24%2B-green?logo=node.js)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/SQLite-node%3Asqlite-lightgrey?logo=sqlite)](https://nodejs.org/api/sqlite.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/website-zeltoria.web.id-007acc?logo=googlechrome&logoColor=white)](https://zeltoria.web.id)

> **High-performance, complete web scraper and structured data extractor for [anime-indo.lol](https://anime-indo.lol/).**  
> Mengambil seluruh katalog anime (4.635+ judul), detail lengkap (sinopsis, poster resolusi penuh, genre tags), 56.500+ link episode, 605 movie (41 halaman), 93 genre, episode rilis terkini, serta tautan video stream (embed player) dan direct download link.

---

### 🏷️ Tags & Topics
`#anime-scraper` `#anime-api` `#anime` `#scraper` `#crawler` `#typescript` `#nodejs` `#cheerio` `#animeindo` `#sqlite` `#api`

---

## 📊 Dataset Statistics

Data yang telah terekstrak secara lengkap dan tersimpan di dalam folder [`data/`](./data):

| Kategori Data | Jumlah Data Valid | Format Ekspor | Keterangan |
| :--- | :---: | :---: | :--- |
| **Katalog Anime (`anime`)** | **4.635** | SQLite, JSON, CSV | Seluruh direktori alfabetis (`/anime-list/`) |
| **Detail Lengkap (`anime_details`)** | **4.635** | SQLite, JSON, CSV | Sinopsis, poster URL, judul alternatif, tag genre |
| **Daftar Episode (`episodes`)** | **56.593** | SQLite | Terhubung relasional dengan anime slug |
| **Katalog Movie (`movies`)** | **605** | SQLite, JSON, CSV | 41 halaman film (`/movie/`) beserta durasi & tahun |
| **Kategori Genre (`genres`)** | **93** | SQLite, JSON | Seluruh kategori genre dari (`/list-genre/`) |
| **Update Terbaru (`latest_updates`)** | **159** | SQLite, JSON | Rilis episode terkini dari 10 halaman beranda |

---

## ✨ Fitur Utama

- ⚡ **Super Fast & Lightweight**: Menggunakan parser **Cheerio** dan native `fetch` dengan concurrency worker pool.
- 📦 **Zero External DB Dependency**: Menggunakan database bawaan **`node:sqlite`** (SQLite sync engine bawaan Node.js v22/v24).
- 🔄 **Auto-Resume & Checkpoint**: Menyimpan progres setiap batch 50 item, aman dari interupsi jaringan.
- 🛡️ **Built-in Validator**: Memvalidasi integritas URL, slug unik, judul, dan sanitasi metadata.
- 🎥 **Video Stream Extractor**: Mendukung ekstraksi server video embed (B-TUBE, GDRIVE, MP4Upload, YourUpload) dan link download (GDrive, MP4).
- 🔍 **Search Engine**: Pencarian instan berdasarkan kata kunci langsung ke katalog anime.
- 🚀 **Modern TypeScript**: Dibangun sepenuhnya menggunakan TypeScript dengan type safety penuh dan kompatibilitas ES Modules modern.

---

## 📁 Struktur Direktori

```
.
├── src/
│   ├── models.ts        # TypeScript interfaces & types (AnimeItem, MovieItem, dll)
│   ├── validator.ts     # Validasi URL, slug, judul, sanitasi whitespace
│   ├── storage.ts       # Database SQLite (node:sqlite) & JSON/CSV Exporters
│   ├── scraper.ts       # Logika crawler (AnimeIndoScraper) berbasis Cheerio + fetch
│   ├── cli.ts           # Antarmuka CLI utama
│   └── index.ts         # Module entrypoint & exports
├── data/                # Dataset hasil ekstraksi
│   ├── anime_indo.db        # Database SQLite (18 MB, 4.635 anime + 56.593 episode)
│   ├── anime_list.json      # 4.635 anime (JSON)
│   ├── anime_list.csv       # 4.635 anime (CSV)
│   ├── anime_details.json   # 4.635 detail lengkap anime (JSON)
│   ├── anime_details.csv    # 4.635 detail lengkap anime (CSV)
│   ├── movies.json          # 605 movie (JSON)
│   ├── movies.csv           # 605 movie (CSV)
│   ├── genres.json          # 93 genre (JSON)
│   └── latest_updates.json  # 159 update episode terbaru (JSON)
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 Panduan Instalasi & Penggunaan

### 1. Prasyarat
- **Node.js v22+** atau **v24+** (untuk dukungan `node:sqlite` dan native `fetch`).
- **npm** atau **pnpm** / **yarn**.

### 2. Instalasi Dependensi
```bash
git clone https://github.com/Aevryns/anime-scraper.git
cd anime-scraper
npm install
```

### 3. Build TypeScript
```bash
npm run build
```

---

## 💻 Penggunaan via CLI (Command Line)

```bash
# 1. Menampilkan ringkasan statistik database
npm run summary
# atau: node dist/cli.js --summary

# 2. Menjalankan scraping penuh (Katalog, Genre, 41 Halaman Movie, 10 Halaman Update)
npm run scrape:all

# 3. Crawl seluruh detail lengkap anime (sinopsis, poster, seluruh link episode)
npm run scrape:details
# Atau dengan batas limit dan concurrency khusus:
npx tsx src/cli.ts --details --limit-details 100 --concurrency 25

# 4. Mencari anime berdasarkan kata kunci
node dist/cli.js --search "One Piece"

# 5. Mengambil link streaming embed & direct download dari suatu episode
node dist/cli.js --episode "/one-piece-episode-001/"
```

---

## 🧩 Penggunaan sebagai Library (TypeScript / JavaScript)

```typescript
import { AnimeIndoScraper } from "./src/index.js";

const scraper = new AnimeIndoScraper();

// 1. Ambil detail anime beserta daftar episode
const anime = await scraper.getAnimeDetail("one-piece");
console.log(`Judul: ${anime?.title}`);
console.log(`Sinopsis: ${anime?.synopsis}`);
console.log(`Total Episode: ${anime?.episodesCount}`);

// 2. Ambil mirror server streaming (B-TUBE, GDRIVE, MP4, YUP) & link download
const stream = await scraper.getEpisodeStream("/one-piece-episode-001/");
console.log("Main Video Embed:", stream?.mainVideo);

stream?.servers.forEach((server) => {
  console.log(`Server [${server.name}]: ${server.videoUrl}`);
});

stream?.downloads.forEach((dl) => {
  console.log(`Download [${dl.name}]: ${dl.url}`);
});
```

---

## 🗄️ Skema Database SQLite

Database disimpan di [`data/anime_indo.db`](./data/anime_indo.db) dengan tabel-tabel berikut:

- `anime` (`slug` PK, `title`, `letter`, `url`)
- `anime_details` (`slug` PK, `title`, `alt_title`, `url`, `image_url`, `genres`, `synopsis`, `episodes_count`, `updated_at`)
- `episodes` (`id` PK, `anime_slug` FK, `episode_number`, `episode_url`)
- `movies` (`slug` PK, `title`, `url`, `image_url`, `labels`, `description`)
- `genres` (`slug` PK, `name`, `url`)
- `latest_updates` (`id` PK, `title`, `episode`, `url`, `image_url`, `scraped_at`)

---

## 🌐 Website Resmi
Website: [https://zeltoria.web.id](https://zeltoria.web.id)

---

## 📄 Lisensi
[MIT License](LICENSE) © 2026 [Zeltoria Aevryns](https://zeltoria.web.id)
