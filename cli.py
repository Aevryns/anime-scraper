import argparse
import asyncio
import json
import sys
import time
from scraper import AnimeIndoScraper
from storage import Storage

def print_banner():
    print("=" * 60)
    print("      ANIME-INDO.LOL FULL SCRAPER & EXTRACTOR")
    print("=" * 60)

def scrape_anime_list(scraper: AnimeIndoScraper, storage: Storage):
    print("\n[*] Mengambil seluruh daftar anime dari /anime-list/...")
    start = time.time()
    items = scraper.get_anime_list()
    elapsed = time.time() - start

    print(f"[+] Berhasil mendapatkan {len(items)} anime valid dalam {elapsed:.2f}s!")
    count = storage.save_anime_list(items)
    print(f"[+] Disimpan ke database SQLite ({count} baris di tabel 'anime')")

    dict_items = [it.to_dict() for it in items]
    json_path = storage.export_json("anime_list.json", dict_items)
    csv_path = storage.export_csv("anime_list.csv", dict_items, ["letter", "slug", "title", "url"])
    print(f"[+] Export JSON: {json_path}")
    print(f"[+] Export CSV:  {csv_path}")
    return items

def scrape_genres(scraper: AnimeIndoScraper, storage: Storage):
    print("\n[*] Mengambil daftar genre dari /list-genre/...")
    start = time.time()
    genres = scraper.get_genres()
    elapsed = time.time() - start

    print(f"[+] Berhasil mendapatkan {len(genres)} genre valid dalam {elapsed:.2f}s!")
    count = storage.save_genres(genres)
    print(f"[+] Disimpan ke database SQLite ({count} baris di tabel 'genres')")

    dict_genres = [g.to_dict() for g in genres]
    json_path = storage.export_json("genres.json", dict_genres)
    print(f"[+] Export JSON: {json_path}")
    return genres

def scrape_movies(scraper: AnimeIndoScraper, storage: Storage, max_pages: int = None):
    print(f"\n[*] Mengambil seluruh daftar movie dari /movie/...")
    start = time.time()
    def on_progress(page, total):
        if page % 5 == 0 or page == total:
            print(f"    - Memproses movie halaman {page}/{total}...")

    movies = scraper.get_all_movies(max_pages=max_pages, on_progress=on_progress)
    elapsed = time.time() - start

    print(f"[+] Berhasil mendapatkan {len(movies)} movie valid dalam {elapsed:.2f}s!")
    count = storage.save_movies(movies)
    print(f"[+] Disimpan ke database SQLite ({count} baris di tabel 'movies')")

    dict_movies = [m.to_dict() for m in movies]
    json_path = storage.export_json("movies.json", dict_movies)
    csv_path = storage.export_csv("movies.csv", dict_movies, ["slug", "title", "url", "image_url", "labels", "description"])
    print(f"[+] Export JSON: {json_path}")
    print(f"[+] Export CSV:  {csv_path}")
    return movies

def scrape_updates(scraper: AnimeIndoScraper, storage: Storage, pages: int = 10):
    print(f"\n[*] Mengambil update episode terbaru ({pages} halaman)...")
    start = time.time()
    updates = scraper.get_latest_updates(max_pages=pages)
    elapsed = time.time() - start

    print(f"[+] Berhasil mendapatkan {len(updates)} update episode terbaru dalam {elapsed:.2f}s!")
    count = storage.save_latest_updates(updates)
    print(f"[+] Disimpan ke database SQLite ({count} baris di tabel 'latest_updates')")

    dict_updates = [u.to_dict() for u in updates]
    json_path = storage.export_json("latest_updates.json", dict_updates)
    print(f"[+] Export JSON: {json_path}")
    return updates

def scrape_details(scraper: AnimeIndoScraper, storage: Storage, limit: int = None, concurrency: int = 15):
    print("\n[*] Menyiapkan crawling detail anime (sinopsis, genre, poster, daftar episode)...")
    anime_items = storage.get_all_anime_items()
    if not anime_items:
        anime_items = scraper.get_anime_list()
        storage.save_anime_list(anime_items)

    crawled_slugs = storage.get_crawled_detail_slugs()
    to_crawl = [it for it in anime_items if it.slug not in crawled_slugs]
    if limit:
        to_crawl = to_crawl[:limit]

    print(f"[*] Total anime di katalog: {len(anime_items)}")
    print(f"[*] Sudah di-crawl sebelumnya: {len(crawled_slugs)}")
    print(f"[*] Target yang akan di-crawl sekarang: {len(to_crawl)}")

    if not to_crawl:
        print("[+] Semua detail anime sudah lengkap tersimpan di database!")
        return

    start = time.time()
    def on_batch(completed, total, batch_results):
        pct = (completed / total) * 100 if total else 100
        print(f"    -> Progress: {completed}/{total} ({pct:.1f}%) | Batch ini berhasil: {len(batch_results)}")

    asyncio.run(scraper.crawl_anime_details_async(
        to_crawl,
        concurrency=concurrency,
        batch_size=50,
        on_batch_done=on_batch
    ))

    elapsed = time.time() - start
    stats = storage.get_stats()
    print(f"[+] Selesai crawling detail anime dalam {elapsed:.2f}s!")
    print(f"[+] Total anime_details tersimpan: {stats.get('anime_details', 0)}")
    print(f"[+] Total episode tersimpan: {stats.get('episodes', 0)}")

def scrape_episode(scraper: AnimeIndoScraper, url_or_slug: str):
    print(f"\n[*] Mengambil data stream video & download untuk episode: {url_or_slug}")
    stream = scraper.get_episode_stream(url_or_slug)
    if not stream:
        print("[-] Gagal mengambil episode atau halaman tidak valid.")
        return
    print(json.dumps(stream.to_dict(), indent=2, ensure_ascii=False))

def search_anime(scraper: AnimeIndoScraper, query: str):
    print(f"\n[*] Mencari anime dengan kata kunci '{query}'...")
    results = scraper.search(query)
    print(f"[+] Ditemukan {len(results)} hasil:")
    for i, r in enumerate(results, 1):
        print(f"{i}. {r['title']} ({r['slug']})")
        print(f"   URL: {r['url']}")
        if r['labels']:
            print(f"   Labels: {', '.join(r['labels'])}")
        if r['description']:
            print(f"   Desc: {r['description'][:100]}...")

def print_summary(storage: Storage):
    print("\n" + "=" * 60)
    print("               DATABASE & SCRAPER STATS")
    print("=" * 60)
    stats = storage.get_stats()
    for table, count in stats.items():
        print(f" - {table.ljust(18)}: {count:>6} baris")
    print("=" * 60)

def main():
    parser = argparse.ArgumentParser(description="Anime-Indo.lol Scraper")
    parser.add_argument("--all", action="store_true", help="Scrape full catalog (all anime, genres, movies, latest updates)")
    parser.add_argument("--anime-list", action="store_true", help="Scrape full anime catalog list (/anime-list/)")
    parser.add_argument("--genres", action="store_true", help="Scrape all genres (/list-genre/)")
    parser.add_argument("--movies", action="store_true", help="Scrape all movies (/movie/)")
    parser.add_argument("--max-movie-pages", type=int, default=None, help="Limit number of movie pages to scrape")
    parser.add_argument("--updates", action="store_true", help="Scrape latest episode updates from homepage")
    parser.add_argument("--update-pages", type=int, default=10, help="Number of update pages to scrape (default 10)")
    parser.add_argument("--details", action="store_true", help="Scrape anime details (synopsis, genres, episode list)")
    parser.add_argument("--limit-details", type=int, default=None, help="Limit number of anime details to scrape")
    parser.add_argument("--concurrency", type=int, default=15, help="Async concurrency for detail crawling (default 15)")
    parser.add_argument("--episode", type=str, default=None, help="Scrape stream video and download links for episode URL/slug")
    parser.add_argument("--search", type=str, default=None, help="Search anime by query")
    parser.add_argument("--summary", action="store_true", help="Show current database statistics")

    args = parser.parse_args()
    print_banner()

    storage = Storage()
    scraper = AnimeIndoScraper(storage=storage)

    if args.summary:
        print_summary(storage)
        return

    if args.search:
        search_anime(scraper, args.search)
        return

    if args.episode:
        scrape_episode(scraper, args.episode)
        return

    if args.all:
        scrape_anime_list(scraper, storage)
        scrape_genres(scraper, storage)
        scrape_movies(scraper, storage, max_pages=args.max_movie_pages)
        scrape_updates(scraper, storage, pages=args.update_pages)
        print_summary(storage)
        return

    executed = False
    if args.anime_list:
        scrape_anime_list(scraper, storage)
        executed = True
    if args.genres:
        scrape_genres(scraper, storage)
        executed = True
    if args.movies:
        scrape_movies(scraper, storage, max_pages=args.max_movie_pages)
        executed = True
    if args.updates:
        scrape_updates(scraper, storage, pages=args.update_pages)
        executed = True
    if args.details:
        scrape_details(scraper, storage, limit=args.limit_details, concurrency=args.concurrency)
        executed = True

    if not executed:
        # Default behavior if run without arguments: run --all
        print("[!] Tidak ada opsi spesifik yang dipilih. Menjalankan mode --all...")
        scrape_anime_list(scraper, storage)
        scrape_genres(scraper, storage)
        scrape_movies(scraper, storage, max_pages=args.max_movie_pages)
        scrape_updates(scraper, storage, pages=args.update_pages)
        print_summary(storage)

if __name__ == "__main__":
    main()
