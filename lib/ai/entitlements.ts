import type { UserType } from '@/lib/auth/types';
import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 1000,
    availableChatModelIds: ['chat-model-small', 'chat-model-medium'],
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 10000,
    availableChatModelIds: ['chat-model-small', 'chat-model-medium', 'chat-model-large'],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};