import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export abstract class BaseStorage {
  public readonly dataDir: string;
  public readonly dbPath: string;
  protected db: DatabaseSync;

  constructor(dataDir: string, dbName: string) {
    this.dataDir = dataDir;
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.dbPath = path.join(this.dataDir, dbName);
    this.db = new DatabaseSync(this.dbPath);
    this.initDb();
  }

  protected abstract initDb(): void;

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
