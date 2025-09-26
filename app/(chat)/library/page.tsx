import { LibraryPanel } from '@/components/library/library-panel';

export default function LibraryPage() {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-hidden">
        <LibraryPanel />
      </div>
    </div>
  );
}