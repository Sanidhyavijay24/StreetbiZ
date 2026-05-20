/**
 * @file db.ts
 * @description SQLite database initialisation, schema creation, and
 *              typed query helpers for inventory, sales, and settings.
 * @module lib/db
 */

import * as SQLite from 'expo-sqlite';

import type { InventoryItem, PnlSummary, SaleRecord } from './types';

const db = SQLite.openDatabaseSync('streetbiz.db');

/**
 * Returns the singleton database handle.
 * Prefer the typed query helpers below; use this only when you need
 * direct access (e.g. inside tool dispatchers).
 */
export function getDB() {
  return db;
}

/**
 * Creates the three core tables if they do not already exist.
 * **Must** be called once during app bootstrap (see _layout.tsx).
 */
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

/* ---------- Typed query helpers ---------- */

/**
 * Fetch all inventory rows ordered by most-recently updated.
 */
export async function getAllInventory(): Promise<InventoryItem[]> {
  return db.getAllAsync<InventoryItem>(
    'SELECT * FROM inventory ORDER BY updated_at DESC',
  );
}

/**
 * Fetch all sales rows ordered by most-recent first.
 */
export async function getAllSales(): Promise<SaleRecord[]> {
  return db.getAllAsync<SaleRecord>(
    'SELECT * FROM sales ORDER BY created_at DESC',
  );
}

/**
 * Aggregate revenue and transaction count for a given period.
 *
 * Uses `date('now', 'start of day')` for "today" to avoid the UTC
 * midnight edge-case where evening sales appear as "tomorrow".
 */
export async function getPnL(
  period: 'today' | 'week' | 'month',
): Promise<PnlSummary> {
  const offsetMap: Record<string, string> = {
    today: 'start of day',
    week: '-7 days',
    month: '-30 days',
  };

  const result = await db.getFirstAsync<PnlSummary>(
    `SELECT COALESCE(SUM(total_price), 0) as revenue,
            COUNT(*) as transactions
     FROM sales WHERE created_at >= date('now', ?)`,
    [offsetMap[period]],
  );

  return result ?? { revenue: 0, transactions: 0 };
}

/**
 * Fetch the single top-selling item (by total revenue) in the last 7 days.
 */
export async function getTopSellingItem(): Promise<{
  item_name: string;
  total: number;
} | null> {
  return db.getFirstAsync<{ item_name: string; total: number }>(
    `SELECT item_name, SUM(total_price) as total
     FROM sales
     WHERE created_at >= date('now', '-7 days')
     GROUP BY item_name
     ORDER BY total DESC
     LIMIT 1`,
  );
}
