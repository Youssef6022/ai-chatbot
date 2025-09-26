'use client';

import { useRouter } from 'next/navigation';
import { memo } from 'react';
import { type VisibilityType, VisibilitySelector } from './visibility-selector';
import type { AuthSession } from '@/lib/auth/types';

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
  session,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  session?: AuthSession;
}) {

  return (
    <header className='sticky top-0 flex items-center justify-end gap-2 bg-background px-2 py-1.5 md:px-2'>
      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
        />
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});