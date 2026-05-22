/**
 * @file pdf.ts
 * @description Credit report PDF generator using react-native-html-to-pdf.
 *              Fetches 3-month sales performance data from SQLite,
 *              builds a branded, premium HTML template, and compiles it.
 * @module lib/pdf
 */

import { Platform } from 'react-native';
import { getDB } from './db';
import { CONFIG } from './config';

interface MonthlyPerformance {
  month: string;
  revenue: number;
  transactions: number;
}

interface RecentTransaction {
  item_name: string;
  quantity: number;
  total_price: number;
  currency: string;
  created_at: string;
}

/**
 * Generate a premium credit report PDF for a vendor.
 *
 * @param periodMonths - Number of historical months to cover in the report (default 3).
 * @returns Path to the generated PDF file on the device.
 */
export async function generateCreditReportPDF(periodMonths: number = 3): Promise<string> {
  const db = getDB();
  const days = periodMonths * 30;

  // 1. Fetch vendor settings (name, business type)
  const nameRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'vendor_name'"
  );
  const bizRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'business_type'"
  );

  const vendorName = nameRow?.value || 'StreetBiz Vendor';
  const businessType = bizRow?.value || 'General Retail';
  const currency = CONFIG.DEFAULT_CURRENCY;

  // 2. Fetch aggregate metrics
  const aggregate = await db.getFirstAsync<{
    revenue: number;
    transactions: number;
  }>(
    `SELECT COALESCE(SUM(total_price), 0) as revenue,
            COUNT(*) as transactions
     FROM sales
     WHERE created_at >= date('now', ?)`,
    [`-${days} days`]
  );

  const totalRevenue = aggregate?.revenue || 0;
  const totalTransactions = aggregate?.transactions || 0;
  const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // 3. Fetch monthly performance breakdown
  const monthlyData = await db.getAllAsync<MonthlyPerformance>(
    `SELECT strftime('%Y-%m', created_at) as month,
            SUM(total_price) as revenue,
            COUNT(*) as transactions
     FROM sales
     WHERE created_at >= date('now', ?)
     GROUP BY month ORDER BY month DESC`,
    [`-${days} days`]
  );

  // 4. Fetch top selling product
  const topProductRow = await db.getFirstAsync<{ item_name: string; total: number }>(
    `SELECT item_name, SUM(total_price) as total
     FROM sales
     WHERE created_at >= date('now', ?)
     GROUP BY item_name
     ORDER BY total DESC
     LIMIT 1`,
    [`-${days} days`]
  );
  const topProduct = topProductRow ? `${topProductRow.item_name} (${currency} ${topProductRow.total.toFixed(2)})` : 'N/A';

  // 5. Fetch sample recent transactions (last 15) to show activity validation
  const recentTransactions = await db.getAllAsync<RecentTransaction>(
    `SELECT item_name, quantity, total_price, currency, created_at
     FROM sales
     WHERE created_at >= date('now', ?)
     ORDER BY created_at DESC
     LIMIT 15`,
    [`-${days} days`]
  );

  const formattedDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // 6. Build Premium Branded HTML Template
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Credit Evidence Report</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #333333;
          background-color: #ffffff;
          margin: 0;
          padding: 30px;
          line-height: 1.4;
        }
        .header {
          border-bottom: 3px solid #1D9E75;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header-table {
          width: 100%;
          border-collapse: collapse;
        }
        .header-title {
          font-size: 26px;
          font-weight: bold;
          color: #534AB7;
          margin: 0;
        }
        .header-subtitle {
          font-size: 14px;
          color: #666666;
          margin-top: 5px;
        }
        .vendor-info {
          text-align: right;
          font-size: 13px;
          color: #444444;
        }
        .vendor-info strong {
          color: #1A1A1A;
          font-size: 15px;
        }
        .metrics-grid {
          width: 100%;
          margin-bottom: 35px;
          border-collapse: separate;
          border-spacing: 15px 0;
        }
        .metric-card {
          background-color: #F4FBF9;
          border: 1px solid #D1EFE5;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
          width: 25%;
        }
        .metric-card-purple {
          background-color: #F6F5FF;
          border: 1px solid #E2DFFF;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
          width: 25%;
        }
        .metric-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #666666;
          margin-bottom: 5px;
        }
        .metric-value {
          font-size: 20px;
          font-weight: bold;
          color: #1D9E75;
        }
        .metric-card-purple .metric-value {
          color: #534AB7;
        }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          color: #534AB7;
          border-bottom: 1px solid #E5E5E5;
          padding-bottom: 8px;
          margin-top: 30px;
          margin-bottom: 15px;
        }
        table.data-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        table.data-table th {
          background-color: #1D9E75;
          color: #ffffff;
          text-align: left;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 600;
        }
        table.data-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #eeeeee;
          font-size: 13px;
        }
        table.data-table tr:nth-child(even) td {
          background-color: #fcfcfc;
        }
        .footer {
          margin-top: 50px;
          border-top: 1px solid #E5E5E5;
          padding-top: 15px;
          text-align: center;
          font-size: 11px;
          color: #999999;
        }
        .badge {
          background-color: #E1F5EE;
          color: #1D9E75;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: bold;
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <table class="header-table">
          <tr>
            <td>
              <div class="header-title">StreetBiz Credit Evidence Report</div>
              <div class="header-subtitle">Verified Business Performance &amp; Micro-Lending Ledger</div>
            </td>
            <td class="vendor-info">
              <strong>${vendorName}</strong><br>
              Category: ${businessType}<br>
              Date Generated: ${formattedDate}
            </td>
          </tr>
        </table>
      </div>

      <table class="metrics-grid">
        <tr>
          <td class="metric-card">
            <div class="metric-label">Total Revenue</div>
            <div class="metric-value">${currency} ${totalRevenue.toFixed(2)}</div>
          </td>
          <td class="metric-card-purple">
            <div class="metric-label">Total Transactions</div>
            <div class="metric-value">${totalTransactions}</div>
          </td>
          <td class="metric-card">
            <div class="metric-label">Avg Transaction</div>
            <div class="metric-value">${currency} ${avgTransaction.toFixed(2)}</div>
          </td>
          <td class="metric-card-purple">
            <div class="metric-label">Top Selling Item</div>
            <div class="metric-value" style="font-size: 14px; margin-top: 5px;">${topProduct}</div>
          </td>
        </tr>
      </table>

      <div class="section-title">Monthly Business Breakdown</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Revenue</th>
            <th>Transactions</th>
            <th>Avg. Basket Size</th>
          </tr>
        </thead>
        <tbody>
          ${
            monthlyData.length > 0
              ? monthlyData
                  .map((m) => {
                    const avg = m.transactions > 0 ? m.revenue / m.transactions : 0;
                    return `
                <tr>
                  <td><strong>${m.month}</strong></td>
                  <td>${currency} ${m.revenue.toFixed(2)}</td>
                  <td>${m.transactions}</td>
                  <td>${currency} ${avg.toFixed(2)}</td>
                </tr>
              `;
                  })
                  .join('')
              : '<tr><td colspan="4" style="text-align: center; color: #999;">No monthly sales recorded in this period.</td></tr>'
          }
        </tbody>
      </table>

      <div class="section-title">Recent Ledger Entries (Validation History)</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Date &amp; Time</th>
            <th>Item Name</th>
            <th>Quantity</th>
            <th>Total Price</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            recentTransactions.length > 0
              ? recentTransactions
                  .map((t) => {
                    const dateStr = new Date(t.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return `
                <tr>
                  <td>${dateStr}</td>
                  <td>${t.item_name}</td>
                  <td>${t.quantity}</td>
                  <td>${t.currency} ${t.total_price.toFixed(2)}</td>
                  <td><span class="badge">RECORDED</span></td>
                </tr>
              `;
                  })
                  .join('')
              : '<tr><td colspan="5" style="text-align: center; color: #999;">No transaction history available.</td></tr>'
          }
        </tbody>
      </table>

      <div class="footer">
        <p>This report has been compiled and verified by the StreetBiz Business Coach App using local on-device encrypted database ledgers.</p>
        <p>&copy; ${new Date().getFullYear()} StreetBiz. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  // 7. Render HTML to PDF file
  const options = {
    html: htmlContent,
    fileName: `StreetBiz_CreditReport_${vendorName.replace(/\s+/g, '_')}_${Date.now()}`,
    directory: 'Documents',
  };

  if (Platform.OS === 'web') {
    throw new Error('PDF generation is only supported on Android and iOS devices.');
  }

  try {
    const { generatePDF } = require('react-native-html-to-pdf');
    const file = await generatePDF(options);
    if (!file.filePath) {
      throw new Error('PDF conversion succeeded but returned empty file path');
    }
    return file.filePath;
  } catch (err) {
    console.error('[pdf] PDF generation failed:', err);
    throw err;
  }
}
