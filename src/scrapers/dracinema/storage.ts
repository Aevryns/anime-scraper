import path from "node:path";
import { fileURLToPath } from "node:url";
import { BaseStorage } from "../../core/index.js";
import {
  DracinemaMovie,
  DracinemaGenre,
  DracinemaDetail,
  DracinemaSearchResult,
} from "./models.js";
import { validateDracinemaMovie, validateDracinemaGenre, validateDracinemaDetail } from "./validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DATA_DIR = path.resolve(__dirname, "../../../data/dracinema");

export class DracinemaStorage extends BaseStorage {
  constructor(dataDir: string = DEFAULT_DATA_DIR, dbName: string = "dracinema.db") {
    super(dataDir, dbName);
  }

  protected initDb(): void {
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
      CREATE INDEX IF NOT EXISTS idx_dracinema_movies_title ON movies(title);
    `);
  }

  public saveMovies(items: DracinemaMovie[]): number {
    this.db.exec("BEGIN TRANSACTION");
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO movies (slug, title, url, thumbnail, description, player_url, lastmod)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      let saved = 0;
      for (const raw of items) {
        const item = validateDracinemaMovie(raw);
        if (!item) continue;
        stmt.run(
          item.slug,
          item.title,
          item.url,
          item.thumbnail,
          item.description,
          item.playerUrl,
          item.lastmod || ""
        );
        saved++;
      }
      this.db.exec("COMMIT");
      return saved;
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
      let saved = 0;
      for (const raw of items) {
        const item = validateDracinemaGenre(raw);
        if (!item) continue;
        stmt.run(item.slug, item.name, item.url);
        saved++;
      }
      this.db.exec("COMMIT");
      return saved;
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

      let saved = 0;
      for (const raw of details) {
        const d = validateDracinemaDetail(raw);
        if (!d) continue;
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
        saved++;
      }
      this.db.exec("COMMIT");
      return saved;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public findMovieBySlug(slug: string): DracinemaMovie | null {
    const stmt = this.db.prepare("SELECT slug, title, url, thumbnail, description, player_url, lastmod FROM movies WHERE slug = ?");
    const row = stmt.get(slug) as any;
    if (!row) return null;
    return {
      slug: row.slug,
      title: row.title,
      url: row.url,
      thumbnail: row.thumbnail,
      description: row.description,
      playerUrl: row.player_url,
      lastmod: row.lastmod,
    };
  }

  public findMovieByBookId(bookId: string): DracinemaMovie | null {
    const stmt = this.db.prepare("SELECT slug, title, url, thumbnail, description, player_url, lastmod FROM movies WHERE slug LIKE ? LIMIT 1");
    const row = stmt.get(`%${bookId}%`) as any;
    if (!row) return null;
    return {
      slug: row.slug,
      title: row.title,
      url: row.url,
      thumbnail: row.thumbnail,
      description: row.description,
      playerUrl: row.player_url,
      lastmod: row.lastmod,
    };
  }

  public searchLocal(query: string, limit: number = 20): DracinemaSearchResult[] {
    const stmt = this.db.prepare(`
      SELECT slug, title, url, thumbnail, description, player_url
      FROM movies
      WHERE title LIKE ? OR description LIKE ?
      LIMIT ?
    `);
    const term = `%${query}%`;
    const rows = stmt.all(term, term, limit) as any[];

    return rows.map((r) => {
      const parts = r.slug.split("-");
      const bookId = parts[parts.length - 1] || r.slug;
      return {
        bookId,
        title: r.title,
        slug: r.slug,
        cover: r.thumbnail,
        synopsis: r.description,
        chapterCount: 0,
        movieUrl: r.url,
        playUrl: r.player_url || `https://www.dracinema.com/play/${r.slug}`,
      };
    });
  }

  public getAllMovies(): DracinemaMovie[] {
    const stmt = this.db.prepare("SELECT slug, title, url, thumbnail, description, player_url, lastmod FROM movies ORDER BY title ASC");
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      url: r.url,
      thumbnail: r.thumbnail,
      description: r.description,
      playerUrl: r.player_url,
      lastmod: r.lastmod,
    }));
  }

  public getCrawledDetailSlugs(): Set<string> {
    const stmt = this.db.prepare("SELECT slug FROM details");
    const rows = stmt.all() as Array<{ slug: string }>;
    return new Set(rows.map((r) => r.slug));
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
}
