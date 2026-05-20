/**
 * @file tools.ts
 * @description Ollama function-calling tool schemas and the dispatcher
 *              that routes each tool_call to the correct database or
 *              business-logic handler.  All 5 tools are implemented.
 * @module lib/tools
 */

import { CONFIG } from './config';
import { getPnL } from './db';
import type {
  AddInventoryItemArgs,
  ExplainTaxThresholdArgs,
  GenerateCreditReportArgs,
  GetPnlSummaryArgs,
  LogSaleArgs,
  ToolResult,
} from './types';

/* ------------------------------------------------------------------ */
/*  Tool schemas — sent to Ollama so the model knows what it can call  */
/* ------------------------------------------------------------------ */

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_inventory_item',
      description:
        'Add or update an item in the vendor inventory from a photo scan',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit: {
            type: 'string',
            description: 'pieces, kg, bunch, crate…',
          },
          estimated_unit_price: { type: 'number' },
        },
        required: ['name', 'quantity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_sale',
      description:
        'Record a sale from voice input, e.g. "sold 5 tomatoes for 200 naira"',
      parameters: {
        type: 'object',
        properties: {
          item_name: { type: 'string' },
          quantity: { type: 'number' },
          total_price: { type: 'number' },
          currency: { type: 'string' },
        },
        required: ['item_name', 'quantity', 'total_price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pnl_summary',
      description: 'Revenue summary for a time period',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'week', 'month'],
          },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'explain_tax_threshold',
      description:
        'Explain if the vendor needs to pay tax given their revenue',
      parameters: {
        type: 'object',
        properties: {
          country: { type: 'string' },
          monthly_revenue: { type: 'number' },
        },
        required: ['country', 'monthly_revenue'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_credit_report',
      description:
        'Build a 3-month credit evidence report for microfinance applications',
      parameters: {
        type: 'object',
        properties: {
          period_months: { type: 'number' },
        },
      },
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Dispatcher — routes a tool_call name + args to the right handler   */
/* ------------------------------------------------------------------ */

// NOTE: The `db` parameter uses `any` intentionally here because the
// SQLite database handle type from expo-sqlite is complex and this
// function is called from multiple contexts.  The typed helpers in
// db.ts handle the real type safety.

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  db: any,
): Promise<ToolResult> {
  switch (name) {
    /* ---- Tool 1: add_inventory_item ---- */
    case 'add_inventory_item': {
      const a = args as unknown as AddInventoryItemArgs;
      await db.runAsync(
        `INSERT INTO inventory (name, quantity, unit, unit_price)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           quantity = quantity + excluded.quantity,
           updated_at = CURRENT_TIMESTAMP`,
        [a.name, a.quantity, a.unit ?? 'unit', a.estimated_unit_price ?? 0],
      );
      return { ok: true, added: a.name, quantity: a.quantity };
    }

    /* ---- Tool 2: log_sale ---- */
    case 'log_sale': {
      const a = args as unknown as LogSaleArgs;
      const currency = a.currency ?? CONFIG.DEFAULT_CURRENCY;
      const unitPrice = a.quantity > 0 ? a.total_price / a.quantity : 0;

      await db.runAsync(
        `INSERT INTO sales (item_name, quantity, unit_price, total_price, currency)
         VALUES (?, ?, ?, ?, ?)`,
        [a.item_name, a.quantity, unitPrice, a.total_price, currency],
      );

      // Deduct stock — use exact name match to avoid wildcard surprises.
      await db.runAsync(
        `UPDATE inventory SET quantity = MAX(0, quantity - ?)
         WHERE LOWER(name) = LOWER(?)`,
        [a.quantity, a.item_name],
      );

      return { ok: true, item: a.item_name, revenue: a.total_price, currency };
    }

    /* ---- Tool 3: get_pnl_summary ---- */
    case 'get_pnl_summary': {
      const a = args as unknown as GetPnlSummaryArgs;
      const summary = await getPnL(a.period);
      return {
        ok: true,
        period: a.period,
        revenue: summary.revenue,
        transactions: summary.transactions,
      };
    }

    /* ---- Tool 4: explain_tax_threshold ---- */
    case 'explain_tax_threshold': {
      const a = args as unknown as ExplainTaxThresholdArgs;
      // We return structured data so the model can craft a
      // plain-language explanation using the vendor's real numbers.
      return {
        ok: true,
        country: a.country,
        monthly_revenue: a.monthly_revenue,
        annual_estimate: a.monthly_revenue * 12,
        // NOTE: Actual thresholds vary by country; the model uses its
        // training knowledge to provide the right context.
        hint: `Provide a simple, plain-language explanation of whether a vendor earning ${a.monthly_revenue} per month in ${a.country} needs to register for or pay taxes.  Include the relevant threshold if known.`,
      };
    }

    /* ---- Tool 5: generate_credit_report ---- */
    case 'generate_credit_report': {
      const a = args as unknown as GenerateCreditReportArgs;
      const months = a.period_months ?? 3;
      const days = months * 30;

      const monthlyData = await db.getAllAsync(
        `SELECT strftime('%Y-%m', created_at) as month,
                SUM(total_price) as revenue,
                COUNT(*) as transactions
         FROM sales
         WHERE created_at >= date('now', ?)
         GROUP BY month ORDER BY month`,
        [`-${days} days`],
      );

      // TODO: Wire to lib/pdf.ts once implemented to produce the
      // actual PDF file.  For now return the data so the model can
      // summarise it in chat.
      return {
        ok: true,
        period_months: months,
        monthly_data: monthlyData,
        note: 'PDF generation is not yet wired — data returned for chat summary.',
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
