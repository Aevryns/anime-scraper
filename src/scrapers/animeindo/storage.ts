import path from "node:path";
import { fileURLToPath } from "node:url";
import { BaseStorage } from "../../core/index.js";
import { AnimeItem, AnimeDetail, MovieItem, GenreItem, UpdateItem } from "./models.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DATA_DIR = path.resolve(__dirname, "../../../data");

export class AnimeIndoStorage extends BaseStorage {
  constructor(dataDir: string = DEFAULT_DATA_DIR, dbName: string = "anime_indo.db") {
    super(dataDir, dbName);
  }

  protected initDb(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS anime (
        slug TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        letter TEXT,
        url TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS genres (
        slug TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS movies (
        slug TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        image_url TEXT,
        labels TEXT,
        description TEXT
      );
      CREATE TABLE IF NOT EXISTS latest_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        episode TEXT,
        url TEXT NOT NULL,
        image_url TEXT,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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
      );
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anime_slug TEXT NOT NULL,
        episode_number TEXT,
        episode_url TEXT NOT NULL,
        UNIQUE(anime_slug, episode_url),
        FOREIGN KEY (anime_slug) REFERENCES anime_details(slug)
      );
      CREATE INDEX IF NOT EXISTS idx_anime_letter ON anime(letter);
      CREATE INDEX IF NOT EXISTS idx_episodes_slug ON episodes(anime_slug);
    `);
  }

  public saveAnimeList(items: AnimeItem[]): number {
    this.db.exec("BEGIN TRANSACTION");
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO anime (slug, title, letter, url)
        VALUES (?, ?, ?, ?)
      `);
      for (const item of items) {
        stmt.run(item.slug, item.title, item.letter, item.url);
      }
      this.db.exec("COMMIT");
      return items.length;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public saveGenres(items: GenreItem[]): number {
    this.db.exec("BEGIN TRANSACTION");
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO genres (slug, name, url)
        VALUES (?, ?, ?)
      `);
      for (const item of items) {
        stmt.run(item.slug, item.name, item.url);
      }
      this.db.exec("COMMIT");
      return items.length;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public saveMovies(items: MovieItem[]): number {
    this.db.exec("BEGIN TRANSACTION");
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO movies (slug, title, url, image_url, labels, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        stmt.run(
          item.slug,
          item.title,
          item.url,
          item.imageUrl,
          JSON.stringify(item.labels),
          item.description
        );
      }
      this.db.exec("COMMIT");
      return items.length;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public saveLatestUpdates(items: UpdateItem[]): number {
    this.db.exec("BEGIN TRANSACTION");
    try {
      this.db.exec("DELETE FROM latest_updates");
      const stmt = this.db.prepare(`
        INSERT INTO latest_updates (title, episode, url, image_url)
        VALUES (?, ?, ?, ?)
      `);
      for (const item of items) {
        stmt.run(item.title, item.episode, item.url, item.imageUrl);
      }
      this.db.exec("COMMIT");
      return items.length;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public saveAnimeDetailsBatch(details: AnimeDetail[]): number {
    this.db.exec("BEGIN TRANSACTION");
    try {
      const detailStmt = this.db.prepare(`
        INSERT OR REPLACE INTO anime_details (slug, title, alt_title, url, image_url, genres, synopsis, episodes_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const epStmt = this.db.prepare(`
        INSERT OR IGNORE INTO episodes (anime_slug, episode_number, episode_url)
        VALUES (?, ?, ?)
      `);

      for (const d of details) {
        detailStmt.run(
          d.slug,
          d.title,
          d.altTitle,
          d.url,
          d.imageUrl,
          JSON.stringify(d.genres),
          d.synopsis,
          d.episodesCount
        );
        for (const ep of d.episodes) {
          epStmt.run(d.slug, ep.episode, ep.url);
        }
      }
      this.db.exec("COMMIT");
      return details.length;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public getCrawledDetailSlugs(): Set<string> {
    const stmt = this.db.prepare("SELECT slug FROM anime_details");
    const rows = stmt.all() as Array<{ slug: string }>;
    return new Set(rows.map((r) => r.slug));
  }

  public getAllAnimeItems(): AnimeItem[] {
    const stmt = this.db.prepare("SELECT slug, title, letter, url FROM anime ORDER BY title ASC");
    const rows = stmt.all() as Array<{ slug: string; title: string; letter: string; url: string }>;
    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      letter: r.letter,
      url: r.url,
    }));
  }

  public getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    const tables = ["anime", "genres", "movies", "latest_updates", "anime_details", "episodes"];
    for (const table of tables) {
      const stmt = this.db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`);
      const row = stmt.get() as { cnt: number };
      stats[table] = Number(row.cnt);
    }
    return stats;
  }
}
