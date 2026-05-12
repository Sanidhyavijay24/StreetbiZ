import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('streetbiz.db');

export async function initDB() {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS inventory (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      quantity   REAL DEFAULT 0,
      unit       TEXT DEFAULT 'unit',
      unit_price REAL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sales (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name   TEXT NOT NULL,
      quantity    REAL NOT NULL,
      unit_price  REAL NOT NULL,
      total_price REAL NOT NULL,
      currency    TEXT DEFAULT 'NGN',
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

export async function getPnL(period: 'today' | 'week' | 'month') {
  const offset = { today: '0 days', week: '-7 days', month: '-30 days' }[period];
  return db.getFirstAsync<{ revenue: number; transactions: number }>(
    `SELECT COALESCE(SUM(total_price), 0) as revenue,
            COUNT(*) as transactions
     FROM sales WHERE created_at >= date('now', ?)`,
    [offset]
  );
}
