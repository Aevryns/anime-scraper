import os
import sqlite3
import json
import csv
from typing import List, Set, Dict, Any, Optional
from models import AnimeItem, AnimeDetail, MovieItem, GenreItem, UpdateItem

DEFAULT_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

class Storage:
    def __init__(self, data_dir: str = DEFAULT_DATA_DIR, db_name: str = "anime_indo.db"):
        self.data_dir = data_dir
        os.makedirs(self.data_dir, exist_ok=True)
        self.db_path = os.path.join(self.data_dir, db_name)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS anime (
                slug TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                letter TEXT,
                url TEXT NOT NULL
            )
            """)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS genres (
                slug TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL
            )
            """)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS movies (
                slug TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                image_url TEXT,
                labels TEXT,
                description TEXT
            )
            """)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS latest_updates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                episode TEXT,
                url TEXT NOT NULL,
                image_url TEXT,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS anime_details (
                slug TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                alt_title TEXT,
                url TEXT NOT NULL,
                image_url TEXT,
                genres TEXT,
                synopsis TEXT,
                episodes_count INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                anime_slug TEXT NOT NULL,
                episode_number TEXT,
                episode_url TEXT NOT NULL,
                UNIQUE(anime_slug, episode_url),
                FOREIGN KEY (anime_slug) REFERENCES anime_details(slug)
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_anime_letter ON anime(letter);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_episodes_slug ON episodes(anime_slug);")
            conn.commit()

    def save_anime_list(self, items: List[AnimeItem]) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            data = [(it.slug, it.title, it.letter, it.url) for it in items]
            cursor.executemany("""
            INSERT OR REPLACE INTO anime (slug, title, letter, url)
            VALUES (?, ?, ?, ?)
            """, data)
            conn.commit()
            return len(data)

    def save_genres(self, items: List[GenreItem]) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            data = [(it.slug, it.name, it.url) for it in items]
            cursor.executemany("""
            INSERT OR REPLACE INTO genres (slug, name, url)
            VALUES (?, ?, ?)
            """, data)
            conn.commit()
            return len(data)

    def save_movies(self, items: List[MovieItem]) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            data = [(it.slug, it.title, it.url, it.image_url, json.dumps(it.labels), it.description) for it in items]
            cursor.executemany("""
            INSERT OR REPLACE INTO movies (slug, title, url, image_url, labels, description)
            VALUES (?, ?, ?, ?, ?, ?)
            """, data)
            conn.commit()
            return len(data)

    def save_latest_updates(self, items: List[UpdateItem]) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM latest_updates")
            data = [(it.title, it.episode, it.url, it.image_url) for it in items]
            cursor.executemany("""
            INSERT INTO latest_updates (title, episode, url, image_url)
            VALUES (?, ?, ?, ?)
            """, data)
            conn.commit()
            return len(data)

    def save_anime_detail(self, detail: AnimeDetail):
        self.save_anime_details_batch([detail])

    def save_anime_details_batch(self, details: List[AnimeDetail]) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            detail_data = [
                (d.slug, d.title, d.alt_title, d.url, d.image_url, json.dumps(d.genres), d.synopsis, d.episodes_count)
                for d in details
            ]
            cursor.executemany("""
            INSERT OR REPLACE INTO anime_details (slug, title, alt_title, url, image_url, genres, synopsis, episodes_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, detail_data)

            ep_data = []
            for d in details:
                for ep in d.episodes:
                    ep_data.append((d.slug, ep.get("episode", ""), ep.get("url", "")))
            if ep_data:
                cursor.executemany("""
                INSERT OR IGNORE INTO episodes (anime_slug, episode_number, episode_url)
                VALUES (?, ?, ?)
                """, ep_data)
            conn.commit()
            return len(detail_data)

    def get_crawled_detail_slugs(self) -> Set[str]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT slug FROM anime_details")
            return set(row[0] for row in cursor.fetchall())

    def get_all_anime_items(self) -> List[AnimeItem]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT slug, title, letter, url FROM anime ORDER BY title ASC")
            return [AnimeItem(title=r[1], slug=r[0], letter=r[2], url=r[3]) for r in cursor.fetchall()]

    def get_stats(self) -> Dict[str, int]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            stats = {}
            for table in ["anime", "genres", "movies", "latest_updates", "anime_details", "episodes"]:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                stats[table] = cursor.fetchone()[0]
            return stats

    def export_json(self, filename: str, data: Any):
        file_path = os.path.join(self.data_dir, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return file_path

    def export_csv(self, filename: str, data: List[Dict[str, Any]], fieldnames: List[str]):
        file_path = os.path.join(self.data_dir, filename)
        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in data:
                clean_row = {}
                for k in fieldnames:
                    val = row.get(k, "")
                    if isinstance(val, (list, dict)):
                        clean_row[k] = json.dumps(val, ensure_ascii=False)
                    else:
                        clean_row[k] = val
                writer.writerow(clean_row)
        return file_path
