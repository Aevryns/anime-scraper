import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DracinemaMovie,
  DracinemaGenre,
  DracinemaDetail,
} from "./models.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DATA_DIR = path.resolve(__dirname, "../../data/dracinema");

export class DracinemaStorage {
  public readonly dataDir: string;
  public readonly dbPath: string;
  private db: DatabaseSync;

  constructor(dataDir: string = DEFAULT_DATA_DIR, dbName: string = "dracinema.db") {
    this.dataDir = dataDir;
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.dbPath = path.join(this.dataDir, dbName);
    this.db = new DatabaseSync(this.dbPath);
    this.initDb();
  }

  private initDb(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS movies (
        slug TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        thumbnail TEXT,
        description TEXT,
        player_url TEXT,
        lastmod TEXT
      );
      CREATE TABLE IF NOT EXISTS genres (
        slug TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS collections (
        slug TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        thumbnail TEXT
      );
      CREATE TABLE IF NOT EXISTS details (
        slug TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        cover TEXT,
        genres TEXT,
        synopsis TEXT,
        total_episodes INTEGER DEFAULT 0,
        released_episodes INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        movie_slug TEXT NOT NULL,
        episode_number INTEGER NOT NULL,
        play_url TEXT NOT NULL,
        UNIQUE(movie_slug, episode_number),
        FOREIGN KEY (movie_slug) REFERENCES details(slug)
      );
      CREATE INDEX IF NOT EXISTS idx_dracinema_episodes ON episodes(movie_slug);
    `);
  }

  public saveMovies(items: DracinemaMovie[]): number {
    this.db.exec("BEGIN TRANSACTION");
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO movies (slug, title, url, thumbnail, description, player_url, lastmod)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        stmt.run(
          item.slug,
          item.title,
          item.url,
          item.thumbnail,
          item.description,
          item.playerUrl,
          item.lastmod || ""
        );
      }
      this.db.exec("COMMIT");
      return items.length;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public saveGenres(items: DracinemaGenre[]): number {
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

  public saveCollections(items: Array<{ slug: string; title: string; url: string; thumbnail: string }>): number {
    this.db.exec("BEGIN TRANSACTION");
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO collections (slug, title, url, thumbnail)
        VALUES (?, ?, ?, ?)
      `);
      for (const item of items) {
        stmt.run(item.slug, item.title, item.url, item.thumbnail);
      }
      this.db.exec("COMMIT");
      return items.length;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public saveDetailsBatch(details: DracinemaDetail[]): number {
    this.db.exec("BEGIN TRANSACTION");
    try {
      const detailStmt = this.db.prepare(`
        INSERT OR REPLACE INTO details (slug, title, url, cover, genres, synopsis, total_episodes, released_episodes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const epStmt = this.db.prepare(`
        INSERT OR REPLACE INTO episodes (movie_slug, episode_number, play_url)
        VALUES (?, ?, ?)
      `);

      for (const d of details) {
        detailStmt.run(
          d.slug,
          d.title,
          d.url,
          d.cover,
          JSON.stringify(d.genres),
          d.synopsis,
          d.totalEpisodes,
          d.releasedEpisodes
        );
        for (const ep of d.episodes) {
          epStmt.run(d.slug, ep.episodeNumber, ep.playUrl);
        }
      }
      this.db.exec("COMMIT");
      return details.length;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    const tables = ["movies", "genres", "collections", "details", "episodes"];
    for (const table of tables) {
      const stmt = this.db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`);
      const row = stmt.get() as { cnt: number };
      stats[table] = Number(row.cnt);
    }
    return stats;
  }

  public exportJson(filename: string, data: unknown): string {
    const filePath = path.join(this.dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return filePath;
  }

  public exportCsv(filename: string, data: Record<string, unknown>[], fields: string[]): string {
    const filePath = path.join(this.dataDir, filename);
    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return "";
      let str = typeof val === "object" ? JSON.stringify(val) : String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        str = '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const header = fields.join(",");
    const rows = data.map((row) => fields.map((f) => escapeCsv(row[f])).join(","));
    const content = [header, ...rows].join("\n");
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
  }
}
