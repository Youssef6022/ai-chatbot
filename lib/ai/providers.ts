import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { isTestEnvironment } from '../constants';

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require('./models.mock');
      return customProvider({
        languageModels: {
          'chat-model-small': chatModel,
          'chat-model-medium': chatModel,
          'chat-model-large': reasoningModel,
          'title-model': titleModel,
          'artifact-model': artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        'chat-model-small': gateway.languageModel('google/gemini-2.5-flash-lite'),
        'chat-model-medium': gateway.languageModel('google/gemini-2.5-flash'),
        'chat-model-large': gateway.languageModel('google/gemini-2.5-pro'),
        'title-model': gateway.languageModel('google/gemini-2.0-flash'),
        'artifact-model': gateway.languageModel('google/gemini-2.5-flash'),
      },
    });
