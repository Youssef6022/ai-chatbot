/**
 * Application configuration
 */

export const config = {
  /**
   * Use Google GenAI SDK (@google/genai) instead of Vercel AI SDK
   * When true, enables Google Maps and native Google Search support
   */
  useGenAISdk: process.env.NEXT_PUBLIC_USE_GENAI_SDK === 'true',
} as const;
