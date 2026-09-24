// NovaSolar AI backend — SQLite database setup.
// File-based SQLite is intentional: zero external services to run locally,
// and the schema/queries here translate directly to Postgres later if the
// app is moved onto real hosting.

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR lets hosting providers point this at a persistent disk mount
// (e.g. Render) without the code needing to know their internal layout.
const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "novasolar.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    fullName TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    preferredTime TEXT,
    notes TEXT,
    address TEXT,
    systemKWp REAL,
    yearlyKWh REAL,
    savedPerYear REAL,
    systemCost REAL,
    paybackYears REAL,
    installerId TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS installers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rating REAL NOT NULL DEFAULT 4.5,
    reviewCount INTEGER NOT NULL DEFAULT 0,
    latitude REAL,
    longitude REAL,
    serviceRadiusKm REAL NOT NULL DEFAULT 50,
    pricePerKWp REAL NOT NULL DEFAULT 1750,
    note TEXT,
    badges TEXT NOT NULL DEFAULT '[]',
    icon TEXT NOT NULL DEFAULT 'sun.max.fill',
    iconColor TEXT NOT NULL DEFAULT '#F5A623',
    isDemo INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    appleUserID TEXT UNIQUE,
    name TEXT,
    email TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
