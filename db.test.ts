/**
 * @file db.test.ts
 * @description Unit tests for SQLite database helpers and demo data seeder.
 * @module db.test
 */

import { describe, expect, it, mock, beforeAll } from 'bun:test';

// Mock localStorage on global window since it's used in the WebMockDatabase constructor
const mockStorage: Record<string, string> = {};
global.window = {
  // @ts-ignore
  localStorage: {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      for (const k in mockStorage) {
        delete mockStorage[k];
      }
    },
  },
} as any;

// Now import the actual modules from lib/
import { getDB, initDB, getPnL, getTopSellingItem, getAllInventory, getAllSales } from './lib/db';
import { seedDemoData } from './lib/seed';
import { CONFIG } from './lib/config';

describe('Database & Seeder Unit Tests', () => {
  beforeAll(async () => {
    // Initialise the DB (no-op on web but ensures it runs without error)
    await initDB();
  });

  it('should return mock database instance on web', () => {
    const db = getDB();
    expect(db).toBeDefined();
    // Validate it acts like a WebMockDatabase
    expect(typeof db.runAsync).toBe('function');
    expect(typeof db.getAllAsync).toBe('function');
  });

  it('should support settings saving and loading', async () => {
    const db = getDB();
    
    // Save settings
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('vendor_name', ?)", ['Test Vendor']);
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('country', ?)", ['United States']);
    
    // Retrieve settings
    const nameRow = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'vendor_name'");
    const countryRow = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'country'");
    
    expect(nameRow?.value).toBe('Test Vendor');
    expect(countryRow?.value).toBe('United States');
  });

  it('should perform seeding, insert products, and generate realistic historical sales', async () => {
    const db = getDB();
    
    // Run seed operation
    await seedDemoData();
    
    // Verify inventory seeded
    const inventory = await getAllInventory();
    expect(inventory.length).toBeGreaterThan(0);
    
    // Check that one of the seeded products exists and has correct unit/price
    const apples = inventory.find(item => item.name === 'Apples');
    expect(apples).toBeDefined();
    expect(apples?.unit).toBe('kg');
    expect(apples?.unit_price).toBe(2.50);
    // Quantity should be seeded and updated based on transaction deductions
    expect(apples?.quantity).toBeGreaterThanOrEqual(0);
    
    // Verify sales generated
    const sales = await getAllSales();
    expect(sales.length).toBeGreaterThan(0);
    
    // Check that sales have appropriate keys and format
    const sampleSale = sales[0];
    expect(sampleSale.item_name).toBeDefined();
    expect(sampleSale.total_price).toBe(sampleSale.quantity * sampleSale.unit_price);
    expect(sampleSale.currency).toBe(CONFIG.DEFAULT_CURRENCY);
    expect(sampleSale.created_at).toBeDefined();
  });

  it('should correctly aggregate P&L summaries', async () => {
    const db = getDB();
    
    // Clear sales and add controlled records to test aggregations
    await db.runAsync('DELETE FROM sales');
    
    const todayStr = new Date().toISOString();
    
    // Log two controlled sales
    await db.runAsync(
      `INSERT INTO sales (item_name, quantity, unit_price, total_price, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Bread', 2, 2.00, 4.00, 'USD', todayStr]
    );
    await db.runAsync(
      `INSERT INTO sales (item_name, quantity, unit_price, total_price, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Milk', 1, 1.50, 1.50, 'USD', todayStr]
    );

    // Fetch today's P&L
    const pnlToday = await getPnL('today');
    expect(pnlToday.revenue).toBe(5.50);
    expect(pnlToday.transactions).toBe(2);
  });

  it('should calculate the top-selling item in the last 7 days', async () => {
    const db = getDB();
    
    // Clear sales
    await db.runAsync('DELETE FROM sales');
    
    const todayStr = new Date().toISOString();
    
    // Item A sales total = 10.00
    await db.runAsync(
      `INSERT INTO sales (item_name, quantity, unit_price, total_price, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Apples', 4, 2.50, 10.00, 'USD', todayStr]
    );
    
    // Item B sales total = 15.00
    await db.runAsync(
      `INSERT INTO sales (item_name, quantity, unit_price, total_price, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Bananas', 10, 1.50, 15.00, 'USD', todayStr]
    );

    const topItem = await getTopSellingItem();
    expect(topItem).toBeDefined();
    expect(topItem?.item_name).toBe('Bananas');
    expect(topItem?.total).toBe(15.00);
  });
});
