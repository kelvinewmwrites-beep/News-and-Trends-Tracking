import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "app.db");

declare global {
  var __sgnewsDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      snippet TEXT,
      source TEXT,
      published_at TEXT,
      fetched_at TEXT NOT NULL,
      segments TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
    CREATE INDEX IF NOT EXISTS idx_articles_fetched_at ON articles(fetched_at);

    CREATE TABLE IF NOT EXISTS content_ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      segment TEXT NOT NULL,
      title TEXT NOT NULL,
      format TEXT NOT NULL,
      angle TEXT NOT NULL,
      hook TEXT NOT NULL,
      source_article_ids TEXT NOT NULL,
      generator TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_content_ideas_segment ON content_ideas(segment);

    CREATE TABLE IF NOT EXISTS ingest_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      new_articles INTEGER DEFAULT 0,
      updated_articles INTEGER DEFAULT 0,
      errors TEXT
    );
  `);

  return db;
}

// Reuse a single connection across hot-reloads in dev.
export const db = globalThis.__sgnewsDb ?? createDb();
if (process.env.NODE_ENV !== "production") {
  globalThis.__sgnewsDb = db;
}
