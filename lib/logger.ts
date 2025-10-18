import { writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'api-debug.log');

async function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    await mkdir(LOG_DIR, { recursive: true });
  }
}

function formatTimestamp() {
  return new Date().toISOString();
}

export async function logToFile(message: string, data?: any) {
  try {
    await ensureLogDir();

    const timestamp = formatTimestamp();
    let logLine = `[${timestamp}] ${message}`;

    if (data !== undefined) {
      logLine += '\n' + JSON.stringify(data, null, 2);
    }

    logLine += '\n' + '━'.repeat(80) + '\n';

    await appendFile(LOG_FILE, logLine);

    // Also log to console
    console.log(message);
    if (data !== undefined) {
      console.log(data);
    }
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

export async function clearLogFile() {
  try {
    await ensureLogDir();
    await writeFile(LOG_FILE, `=== API Debug Log Started at ${formatTimestamp()} ===\n\n`);
  } catch (error) {
    console.error('Failed to clear log file:', error);
  }
}

export { LOG_FILE };
