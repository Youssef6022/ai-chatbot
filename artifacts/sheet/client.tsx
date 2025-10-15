import { Artifact } from '@/components/create-artifact';
import {
  CopyIcon,
  RedoIcon,
  UndoIcon,
  ChevronDownIcon,
  PenIcon,
  DownloadIcon,
} from '@/components/icons';
import { SpreadsheetEditor } from '@/components/sheet-editor';
import { parse, unparse } from 'papaparse';
import { toast } from 'sonner';

type Metadata = any;

export const sheetArtifact = new Artifact<'sheet', Metadata>({
  kind: 'sheet',
  description: 'Useful for working with spreadsheets',
  initialize: async () => {},
  onStreamPart: ({ setArtifact, streamPart }) => {
    if (streamPart.type === 'data-sheetDelta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible: true,
        status: 'streaming',
      }));
    }
  },
  content: ({
    content,
    currentVersionIndex,
    isCurrentVersion,
    onSaveContent,
    status,
  }) => {
    return (
      <>
        {isCurrentVersion && (
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/80 px-4 py-2 text-muted-foreground text-xs backdrop-blur-sm">
            <PenIcon size={12} />
            Édition directe activée - Cliquez dans les cellules pour modifier
          </div>
        )}
        <SpreadsheetEditor
          content={content}
          currentVersionIndex={currentVersionIndex}
          isCurrentVersion={isCurrentVersion}
          saveContent={onSaveContent}
          status={status}
        />
      </>
    );
  },
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <div className="flex items-center gap-1"><CopyIcon size={16} /><ChevronDownIcon size={12} /></div>,
      description: 'Copy options',
      onClick: async ({ content }) => {
        // Find the button element to position the dropdown
        const buttonElement = document.activeElement as HTMLElement;
        const rect = buttonElement?.getBoundingClientRect();
        
        // Calculate position to avoid going off screen
        const dropdownWidth = 160;
        const dropdownHeight = 80; // Approximate height
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = rect?.left || 0;
        let top = (rect?.bottom || 0) + 5;
        
        // Adjust if dropdown would go off right edge
        if (left + dropdownWidth > viewportWidth) {
          left = viewportWidth - dropdownWidth - 10;
        }
        
        // Adjust if dropdown would go off bottom edge
        if (top + dropdownHeight > viewportHeight) {
          top = (rect?.top || 0) - dropdownHeight - 5;
        }
        
        // Create dropdown menu
        const dropdown = document.createElement('div');
        // Detect dark mode
        const isDarkMode = document.documentElement.classList.contains('dark') || 
                          window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        const bgColor = isDarkMode ? '#1f2937' : 'white';
        const borderColor = isDarkMode ? '#374151' : '#e5e7eb';
        const textColor = isDarkMode ? 'white' : 'black';
        const hoverColor = isDarkMode ? '#374151' : '#f9fafb';
        const separatorColor = isDarkMode ? '#4b5563' : '#f3f4f6';

        dropdown.style.cssText = `
          position: fixed;
          top: ${top}px;
          left: ${left}px;
          background: ${bgColor};
          border: 1px solid ${borderColor};
          border-radius: 6px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
          z-index: 10000;
          min-width: ${dropdownWidth}px;
          overflow: hidden;
        `;
        
        dropdown.innerHTML = `
          <button id="copy-csv" style="
            display: block;
            width: 100%;
            padding: 8px 12px;
            background: ${bgColor};
            border: none;
            text-align: left;
            cursor: pointer;
            font-size: 14px;
            color: ${textColor};
            border-bottom: 1px solid ${separatorColor};
          " onmouseover="this.style.background='${hoverColor}'" onmouseout="this.style.background='${bgColor}'">
            Copy CSV
          </button>
          <button id="copy-googlesheets" style="
            display: block;
            width: 100%;
            padding: 8px 12px;
            background: ${bgColor};
            border: none;
            text-align: left;
            cursor: pointer;
            font-size: 14px;
            color: ${textColor};
          " onmouseover="this.style.background='${hoverColor}'" onmouseout="this.style.background='${bgColor}'">
            Copy for Google Sheets
          </button>
        `;

        document.body.appendChild(dropdown);

        // Handle clicks outside to close
        const handleOutsideClick = (e: MouseEvent) => {
          if (!dropdown.contains(e.target as Node)) {
            document.body.removeChild(dropdown);
            document.removeEventListener('click', handleOutsideClick);
          }
        };

        setTimeout(() => {
          document.addEventListener('click', handleOutsideClick);
        }, 100);

        // Handle CSV copy
        dropdown.querySelector('#copy-csv')?.addEventListener('click', async () => {
          try {
            const parsed = parse<string[]>(content, { skipEmptyLines: true });
            const nonEmptyRows = parsed.data.filter((row) =>
              row.some((cell) => cell.trim() !== ''),
            );
            const cleanedCsv = unparse(nonEmptyRows);
            
            await navigator.clipboard.writeText(cleanedCsv);
            toast.success('CSV copied to clipboard!');
          } catch {
            toast.error('Failed to copy CSV');
          }
          document.body.removeChild(dropdown);
          document.removeEventListener('click', handleOutsideClick);
        });

        // Handle Google Sheets copy
        dropdown.querySelector('#copy-googlesheets')?.addEventListener('click', async () => {
          try {
            const parsed = parse<string[]>(content, { skipEmptyLines: true });
            const nonEmptyRows = parsed.data.filter((row) =>
              row.some((cell) => cell.trim() !== ''),
            );
            const cleanedCsv = unparse(nonEmptyRows);

            // Create HTML table with consistent formatting for Google Sheets
            let htmlTable = '<table style="border-collapse: collapse;">';
            for (const row of parsed.data) {
              if (row.some((cell) => cell.trim() !== '')) {
                htmlTable += '<tr>';
                for (const cell of row) {
                  // Consistent left alignment and padding for all cells
                  htmlTable += `<td style="text-align: left; vertical-align: top; padding: 4px; border: 1px solid #ccc;">${cell || ''}</td>`;
                }
                htmlTable += '</tr>';
              }
            }
            htmlTable += '</table>';

            // Copy with both HTML and CSV format
            await navigator.clipboard.write([
              new ClipboardItem({
                'text/html': new Blob([htmlTable], { type: 'text/html' }),
                'text/plain': new Blob([cleanedCsv], { type: 'text/plain' })
              })
            ]);

            toast.success('Ready to paste in Google Sheets');
          } catch {
            toast.error('Failed to copy for Google Sheets');
          }
          document.body.removeChild(dropdown);
          document.removeEventListener('click', handleOutsideClick);
        });
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download CSV',
      onClick: ({ content }) => {
        try {
          const parsed = parse<string[]>(content, { skipEmptyLines: true });
          const nonEmptyRows = parsed.data.filter((row) =>
            row.some((cell) => cell.trim() !== ''),
          );
          const cleanedCsv = unparse(nonEmptyRows);

          // Create blob and download link
          const blob = new Blob([cleanedCsv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          
          // Create download link
          const link = document.createElement('a');
          link.href = url;
          link.download = 'spreadsheet.csv';
          
          // Trigger download
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up
          URL.revokeObjectURL(url);

          toast.success('CSV file downloaded!');
        } catch (error) {
          toast.error('Failed to download CSV');
        }
      },
    },
  ],
  toolbar: [],
});
