/**
 * @file config.ts
 * @description Centralised runtime configuration for StreetBiz.
 *              Values can be overridden via environment variables or
 *              Expo Constants; defaults are sensible for local development.
 * @module lib/config
 */

// NOTE: In a bare React Native / Expo project we cannot reliably use
// process.env at runtime.  We keep a plain config object here so that
// every module imports from one place.  Swap values for production or
// per-device needs before building.

export const CONFIG = {
  /** Full base URL of the Ollama HTTP API (no trailing slash). */
  OLLAMA_BASE_URL: 'http://localhost:11434',

  /** Ollama model tag to use for all chat / vision requests. */
  OLLAMA_MODEL: 'gemma4:e2b',

  /** Default currency code when none is specified by the vendor. */
  DEFAULT_CURRENCY: 'NGN',
} as const;
