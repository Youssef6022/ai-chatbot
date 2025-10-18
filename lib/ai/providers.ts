import { GoogleGenAI } from '@google/genai';
import { isTestEnvironment } from '../constants';

// Model ID mapping
export const MODEL_IDS = {
  'chat-model-small': 'gemini-2.5-flash-lite',  // Use 2.5 for Google Maps support
  'chat-model-medium': 'gemini-2.5-flash',  // Explicitly use 2.5 for Maps support
  'chat-model-large': 'gemini-2.5-pro',
  'title-model': 'gemini-2.5-flash-lite',
  'artifact-model': 'gemini-2.5-flash',
} as const;

export type ChatModelId = keyof typeof MODEL_IDS;

// Initialize Google GenAI client
export const genaiClient = isTestEnvironment
  ? null // Mock client for tests
  : new GoogleGenAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
    });

// Helper to get actual model name from our model IDs
export function getModelName(modelId: ChatModelId): string {
  return MODEL_IDS[modelId];
}

// Temporary compatibility layer for artifacts and tools not yet migrated
// TODO: Remove this once all artifacts/tools are migrated to GenAI SDK
export const myProvider = {
  languageModel: (modelId: string) => {
    // Return a mock object that will cause artifacts to fail gracefully
    console.warn(`[DEPRECATED] myProvider.languageModel('${modelId}') is deprecated. Artifacts not yet supported with GenAI SDK.`);
    return {
      modelId: getModelName(modelId as ChatModelId),
      // This will cause errors in artifacts, which is expected for now
    };
  },
};
