import fs from 'fs';
import os from 'os';
import path from 'path';
import type { ActivityLog, ArticleDocument, ReferenceItem } from '../src/types/journal.ts';

export interface WorkspaceData {
  articles: ArticleDocument[];
  references: ReferenceItem[];
  activities: ActivityLog[];
}

const IS_VERCEL = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
const DATA_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), 'journal-ai-writer')
  : path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'workspace.json');

function ensureStorage(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const initial: WorkspaceData = {
      articles: [],
      references: [],
      activities: [],
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

export function readWorkspace(): WorkspaceData {
  ensureStorage();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<WorkspaceData>;
    return {
      articles: Array.isArray(parsed.articles) ? parsed.articles : [],
      references: Array.isArray(parsed.references) ? parsed.references : [],
      activities: Array.isArray(parsed.activities) ? parsed.activities : [],
    };
  } catch {
    return { articles: [], references: [], activities: [] };
  }
}

export function writeWorkspace(data: WorkspaceData): void {
  ensureStorage();
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, DATA_FILE);
}

export function appendActivity(
  data: WorkspaceData,
  activity: Omit<ActivityLog, 'id' | 'timestamp'>
): ActivityLog {
  const entry: ActivityLog = {
    ...activity,
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  data.activities = [entry, ...data.activities].slice(0, 60);
  return entry;
}
