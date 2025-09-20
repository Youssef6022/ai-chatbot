export const DEFAULT_CHAT_MODEL: string = 'chat-model-medium';

// Migration des anciens modèles vers les nouveaux
export function migrateModelId(modelId: string): string {
  const migrations: Record<string, string> = {
    'chat-model': 'chat-model-medium',
    'chat-model-reasoning': 'chat-model-large',
  };
  
  return migrations[modelId] || modelId;
}

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model-small',
    name: 'Gemini Flash Lite',
    description: 'Lightweight and fast model for simple conversations',
  },
  {
    id: 'chat-model-medium',
    name: 'Gemini Flash',
    description: 'Balanced model for everyday conversations',
  },
  {
    id: 'chat-model-large',
    name: 'Gemini Pro',
    description: 'Most advanced model for complex tasks and reasoning',
  },
];
