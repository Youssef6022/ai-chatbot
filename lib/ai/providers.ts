import {
  customProvider,
} from 'ai';
import { google } from '@ai-sdk/google';
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
        'chat-model-small': google('gemini-1.5-flash'),
        'chat-model-medium': google('gemini-1.5-flash'),
        'chat-model-large': google('gemini-1.5-pro'),
        'title-model': google('gemini-1.5-flash'),
        'artifact-model': google('gemini-1.5-flash'),
      },
    });
