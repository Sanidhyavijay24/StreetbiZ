/**
 * @file ollama.ts
 * @description Client for the local Ollama HTTP API.  Provides typed
 *              helpers for chat, multimodal inventory scanning, and
 *              voice-to-sale transcript parsing via Gemma 4.
 * @module lib/ollama
 */

import { CONFIG } from './config';
import { getDB } from './db';
import { TOOLS, dispatchTool } from './tools';
import type { OllamaMessage, OllamaToolCall } from './types';

const CHAT_ENDPOINT = `${CONFIG.OLLAMA_BASE_URL}/api/chat`;

/**
 * Send a chat completion request to the local Ollama server.
 *
 * @param messages - Conversation history in Ollama message format.
 * @param tools    - Tool schemas to enable function calling (defaults
 *                   to the full TOOLS array).
 * @returns The assistant message (may contain tool_calls).
 */
export async function chat(
  messages: OllamaMessage[],
  tools = TOOLS,
): Promise<OllamaMessage> {
  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.OLLAMA_MODEL,
        messages,
        tools,
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama responded with HTTP ${res.status}`);
    }

    const json = await res.json();
    return json.message;
  } catch (err) {
    console.error('[ollama] chat error:', err);
    throw err;
  }
}

/**
 * Send a photo (base64 JPEG) to the multimodal model and dispatch
 * any `add_inventory_item` tool calls that come back.
 *
 * @param base64 - Raw base64-encoded JPEG image data.
 * @returns Array of tool dispatch results.
 */
export async function scanPhoto(base64: string) {
  const db = getDB();

  const msg = await chat([
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${base64}` },
        },
        {
          type: 'text',
          text: `You are helping a street vendor track inventory.
Identify every visible product in this photo.
For each distinct item, call add_inventory_item once.
Estimate quantity and unit from what you see.`,
        },
      ],
    },
  ]);

  const results = [];
  if (msg?.tool_calls) {
    for (const call of msg.tool_calls) {
      const r = await dispatchTool(
        call.function.name,
        JSON.parse(call.function.arguments),
        db,
      );
      results.push(r);
    }
  }
  return results;
}

/**
 * Parse a voice transcript and dispatch the resulting `log_sale`
 * tool call(s).
 *
 * @param transcript - Plain-text transcription of the vendor's speech.
 * @returns The model's confirmation message content.
 */
export async function voiceSale(transcript: string): Promise<string> {
  const db = getDB();

  const msg = await chat([
    {
      role: 'system',
      content:
        'You are a bookkeeper for a street vendor. Extract sale details from voice input and call log_sale.',
    },
    { role: 'user', content: transcript },
  ]);

  if (msg?.tool_calls) {
    for (const call of msg.tool_calls) {
      await dispatchTool(
        call.function.name,
        JSON.parse(call.function.arguments),
        db,
      );
    }
  }

  return (msg?.content as string) ?? 'Recorded successfully.';
}
