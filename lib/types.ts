/**
 * @file types.ts
 * @description Shared TypeScript interfaces for database records,
 *              Ollama messages, and function-calling tool arguments.
 * @module lib/types
 */

/* ---------- Database row types ---------- */

export interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  updated_at: string;
}

export interface SaleRecord {
  id: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  created_at: string;
}

export interface SettingRow {
  key: string;
  value: string;
}

/* ---------- Ollama API types ---------- */

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | OllamaContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: OllamaToolCall[];
}

export interface OllamaContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: string;
  };
}

/* ---------- Tool argument types ---------- */

export interface AddInventoryItemArgs {
  name: string;
  quantity: number;
  unit?: string;
  estimated_unit_price?: number;
}

export interface LogSaleArgs {
  item_name: string;
  quantity: number;
  total_price: number;
  currency?: string;
}

export interface GetPnlSummaryArgs {
  period: 'today' | 'week' | 'month';
}

export interface ExplainTaxThresholdArgs {
  country: string;
  monthly_revenue: number;
}

export interface GenerateCreditReportArgs {
  period_months?: number;
}

/* ---------- Tool dispatch result ---------- */

export interface ToolResult {
  ok?: boolean;
  error?: string;
  [key: string]: unknown;
}

/* ---------- P&L aggregate ---------- */

export interface PnlSummary {
  revenue: number;
  transactions: number;
}
