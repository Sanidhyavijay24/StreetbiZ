/**
 * @file db.ts
 * @description SQLite database initialisation, schema creation, and
 *              typed query helpers for inventory, sales, and settings.
 *              Includes an in-memory & localStorage emulator for Web platform
 *              to prevent Sync operation timeouts and provide full web testing.
 * @module lib/db
 */

import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import type { InventoryItem, PnlSummary, SaleRecord } from './types';

// Web mock database engine to emulate SQLite on Web browsers without SharedArrayBuffer constraints.
class WebMockDatabase {
  private inventory: any[] = [];
  private sales: any[] = [];
  private settings: Record<string, string> = {
    vendor_name: 'StreetBiz Vendor',
    business_type: 'General Retail',
    country: 'United States',
    language: 'en-US',
  };

  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedInventory = window.localStorage.getItem('streetbiz_mock_inventory');
        const savedSales = window.localStorage.getItem('streetbiz_mock_sales');
        const savedSettings = window.localStorage.getItem('streetbiz_mock_settings');

        if (savedInventory) this.inventory = JSON.parse(savedInventory);
        if (savedSales) this.sales = JSON.parse(savedSales);
        if (savedSettings) this.settings = JSON.parse(savedSettings);
      } catch (e) {
        console.error('[web-db] failed to load from localStorage:', e);
      }
    }
  }

  private save() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('streetbiz_mock_inventory', JSON.stringify(this.inventory));
        window.localStorage.setItem('streetbiz_mock_sales', JSON.stringify(this.sales));
        window.localStorage.setItem('streetbiz_mock_settings', JSON.stringify(this.settings));
      } catch (e) {
        console.error('[web-db] failed to save to localStorage:', e);
      }
    }
  }

  async execAsync(sql: string): Promise<void> {
    console.log('[web-db] execAsync table setup');
  }

  async runAsync(sql: string, params: any[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
    console.log('[web-db] runAsync executing:', sql, params);
    const sqlLower = sql.toLowerCase();

    if (sqlLower.includes('delete from inventory')) {
      this.inventory = [];
      this.save();
    } else if (sqlLower.includes('delete from sales')) {
      this.sales = [];
      this.save();
    } else if (sqlLower.includes('insert into inventory')) {
      const [name, quantity, unit, unitPrice] = params;
      const idx = this.inventory.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
      if (idx >= 0) {
        this.inventory[idx].quantity += quantity;
        this.inventory[idx].updated_at = new Date().toISOString();
      } else {
        this.inventory.push({
          id: this.inventory.length + 1,
          name,
          quantity,
          unit: unit || 'unit',
          unit_price: unitPrice || 0,
          updated_at: new Date().toISOString()
        });
      }
      this.save();
    } else if (sqlLower.includes('insert into sales')) {
      if (params.length === 6) {
        const [itemName, quantity, unitPrice, totalPrice, currency, createdAt] = params;
        this.sales.push({
          id: this.sales.length + 1,
          item_name: itemName,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          currency: currency || 'USD',
          created_at: createdAt
        });
      } else {
        const [itemName, quantity, unitPrice, totalPrice, currency] = params;
        this.sales.push({
          id: this.sales.length + 1,
          item_name: itemName,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          currency: currency || 'USD',
          created_at: new Date().toISOString()
        });
      }
      this.save();
    } else if (sqlLower.includes('update inventory')) {
      const [qtyVal, name] = params;
      const idx = this.inventory.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
      if (idx >= 0) {
        if (sqlLower.includes('quantity -')) {
          this.inventory[idx].quantity = Math.max(0, this.inventory[idx].quantity - qtyVal);
        } else {
          this.inventory[idx].quantity = qtyVal;
        }
        this.inventory[idx].updated_at = new Date().toISOString();
      }
      this.save();
    } else if (sqlLower.includes('settings')) {
      let key = '';
      if (sqlLower.includes("'vendor_name'") || sqlLower.includes('"vendor_name"')) key = 'vendor_name';
      else if (sqlLower.includes("'business_type'") || sqlLower.includes('"business_type"')) key = 'business_type';
      else if (sqlLower.includes("'country'") || sqlLower.includes('"country"')) key = 'country';
      else if (sqlLower.includes("'language'") || sqlLower.includes('"language"')) key = 'language';

      if (key) {
        this.settings[key] = params[0];
      } else if (params.length === 2) {
        this.settings[params[0]] = params[1];
      }
      this.save();
    }

    return { lastInsertRowId: 1, changes: 1 };
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    console.log('[web-db] getAllAsync executing:', sql, params);
    const sqlLower = sql.toLowerCase();

    if (sqlLower.includes('from inventory')) {
      return [...this.inventory].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) as unknown as T[];
    } else if (sqlLower.includes('from sales')) {
      // Handles both simple history and monthly breakdown
      if (sqlLower.includes('group by month') || sqlLower.includes("strftime('%y-%m'")) {
        const groups: Record<string, { month: string; revenue: number; transactions: number }> = {};
        this.sales.forEach(s => {
          const monthStr = s.created_at.substring(0, 7); // 'YYYY-MM'
          if (!groups[monthStr]) {
            groups[monthStr] = { month: monthStr, revenue: 0, transactions: 0 };
          }
          groups[monthStr].revenue += s.total_price;
          groups[monthStr].transactions += 1;
        });
        return Object.values(groups).sort((a, b) => b.month.localeCompare(a.month)) as unknown as T[];
      }
      return [...this.sales].sort((a, b) => b.created_at.localeCompare(a.created_at)) as unknown as T[];
    }
    return [] as T[];
  }

  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    console.log('[web-db] getFirstAsync executing:', sql, params);
    const sqlLower = sql.toLowerCase();

    if (sqlLower.includes("settings where key = 'vendor_name'")) {
      return { value: this.settings['vendor_name'] } as unknown as T;
    } else if (sqlLower.includes("settings where key = 'business_type'")) {
      return { value: this.settings['business_type'] } as unknown as T;
    } else if (sqlLower.includes("settings where key = 'country'")) {
      return { value: this.settings['country'] } as unknown as T;
    } else if (sqlLower.includes("settings where key = 'language'")) {
      return { value: this.settings['language'] || 'en-US' } as unknown as T;
    } else if (sqlLower.includes('coalesce(sum(total_price)')) {
      const daysOffset = params[0] || 'start of day';
      let days = 0;
      if (daysOffset.includes('7 days')) days = 7;
      else if (daysOffset.includes('30 days')) days = 30;
      else if (daysOffset.includes('90 days')) days = 90;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (daysOffset === 'start of day') {
        cutoff.setHours(0, 0, 0, 0);
      }

      const filtered = this.sales.filter(s => new Date(s.created_at) >= cutoff);
      const revenue = filtered.reduce((sum, s) => sum + s.total_price, 0);
      return { revenue, transactions: filtered.length } as unknown as T;
    } else if (sqlLower.includes('item_name, sum(total_price)')) {
      if (this.sales.length === 0) return null;
      const totals: Record<string, number> = {};
      this.sales.forEach(s => {
        totals[s.item_name] = (totals[s.item_name] || 0) + s.total_price;
      });
      let topItem = '';
      let topTotal = 0;
      Object.entries(totals).forEach(([name, tot]) => {
        if (tot > topTotal) {
          topTotal = tot;
          topItem = name;
        }
      });
      if (!topItem) return null;
      return { item_name: topItem, total: topTotal } as unknown as T;
    }

    return null;
  }
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the database handle, opening it lazily. Fallbacks to WebMockDatabase on Web.
 */
export function getDB(): SQLite.SQLiteDatabase {
  if (Platform.OS === 'web') {
    if (!dbInstance) {
      dbInstance = new WebMockDatabase() as unknown as SQLite.SQLiteDatabase;
    }
    return dbInstance;
  }

  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('streetbiz.db');
  }
  return dbInstance;
}

/**
 * Creates the three core tables if they do not already exist.
 * **Must** be called once during app bootstrap (see _layout.tsx).
 */
export async function initDB() {
  const db = getDB();
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
      currency    TEXT DEFAULT 'USD',
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
  const db = getDB();
  return db.getAllAsync<InventoryItem>(
    'SELECT * FROM inventory ORDER BY updated_at DESC',
  );
}

/**
 * Fetch all sales rows ordered by most-recent first.
 */
export async function getAllSales(): Promise<SaleRecord[]> {
  const db = getDB();
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

  const db = getDB();
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
  const db = getDB();
  return db.getFirstAsync<{ item_name: string; total: number }>(
    `SELECT item_name, SUM(total_price) as total
     FROM sales
     WHERE created_at >= date('now', '-7 days')
     GROUP BY item_name
     ORDER BY total DESC
     LIMIT 1`,
  );
}
