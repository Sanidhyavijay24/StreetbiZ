/**
 * @file seed.ts
 * @description Data seeder script to populate 30 days of realistic vendor inventory
 *              and transaction history for development and testing.
 * @module lib/seed
 */

import { getDB } from './db';
import { CONFIG } from './config';

interface SeedProduct {
  name: string;
  initialStock: number;
  unit: string;
  unitPrice: number;
}

const SEED_PRODUCTS: SeedProduct[] = [
  { name: 'Apples', initialStock: 120, unit: 'kg', unitPrice: 2.50 },
  { name: 'Bananas', initialStock: 180, unit: 'bunch', unitPrice: 1.20 },
  { name: 'Bread', initialStock: 60, unit: 'loaves', unitPrice: 2.00 },
  { name: 'Milk', initialStock: 50, unit: 'liters', unitPrice: 1.50 },
  { name: 'Rice', initialStock: 90, unit: 'bags', unitPrice: 14.00 },
  { name: 'Tomatoes', initialStock: 250, unit: 'pieces', unitPrice: 0.50 },
  { name: 'Potatoes', initialStock: 140, unit: 'kg', unitPrice: 1.80 },
];

/**
 * Seeds the database with realistic inventory items and 30 days of sales history.
 * Safely clears out existing inventory and sales tables before executing.
 */
export async function seedDemoData(): Promise<void> {
  const db = getDB();

  // 1. Clear existing database values for inventory and sales tables
  await db.runAsync('DELETE FROM inventory');
  await db.runAsync('DELETE FROM sales');

  // Keep track of active inventory levels during simulated history
  const inventoryLevels: Record<string, number> = {};

  // 2. Insert initial inventory items
  for (const product of SEED_PRODUCTS) {
    await db.runAsync(
      `INSERT INTO inventory (name, quantity, unit, unit_price)
       VALUES (?, ?, ?, ?)`,
      [product.name, product.initialStock, product.unit, product.unitPrice]
    );
    inventoryLevels[product.name] = product.initialStock;
  }

  // 3. Generate 30 days of sales history back from today
  const now = new Date();
  const currency = CONFIG.DEFAULT_CURRENCY;

  for (let d = 30; d >= 0; d--) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - d);

    // Random number of transactions per day: 1 to 4
    const numTransactions = Math.floor(Math.random() * 4) + 1;

    for (let t = 0; t < numTransactions; t++) {
      // Pick a random product
      const product = SEED_PRODUCTS[Math.floor(Math.random() * SEED_PRODUCTS.length)];

      // Pick a random quantity: 1 to 5 units
      const qtySold = Math.floor(Math.random() * 5) + 1;

      // Ensure we have enough stock, otherwise skip or clamp
      if (inventoryLevels[product.name] < qtySold) {
        continue;
      }

      // Calculate total price
      const totalPrice = qtySold * product.unitPrice;

      // Generate a random hour for the timestamp (e.g. between 8:00 AM and 6:00 PM)
      const randomHour = Math.floor(Math.random() * 11) + 8;
      const randomMinute = Math.floor(Math.random() * 60);
      const randomSecond = Math.floor(Math.random() * 60);

      const timestamp = new Date(targetDate);
      timestamp.setHours(randomHour, randomMinute, randomSecond);
      const formattedTimestamp = timestamp.toISOString();

      // Log the sale with custom timestamp
      await db.runAsync(
        `INSERT INTO sales (item_name, quantity, unit_price, total_price, currency, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [product.name, qtySold, product.unitPrice, totalPrice, currency, formattedTimestamp]
      );

      // Deduct stock from local tracking
      inventoryLevels[product.name] -= qtySold;

      // Update SQLite inventory database to reflect new lower quantity
      await db.runAsync(
        `UPDATE inventory SET quantity = ? WHERE name = ?`,
        [inventoryLevels[product.name], product.name]
      );
    }
  }

  console.log('[seeder] database pre-seeded with 30 days of transactions successfully.');
}
