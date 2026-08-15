import localforage from 'localforage';

export interface DocumentMeta {
  id: string;
  title: string;
  type: 'txt' | 'pdf' | 'epub' | 'mobi' | 'azw3';
  addedAt: number;
  totalWords: number;
}

export interface DocumentProgress {
  currentWordIndex: number;
  wpm: number;
}

export type Theme = 'dark' | 'sepia' | 'solarized' | 'oled';

export interface UserSettings {
  theme: Theme;
  fontSize: number; // Percentage, e.g., 100 for normal, 120 for 120%
  showContextWords?: boolean;
  autoSpeedAdjustment?: boolean; // Dynamically adjusts WPM based on focus streak and rewind/pause frequency
}

export interface Bookmark {
  id: string;
  wordIndex: number;
  snippet: string;
  timestamp: number;
  note?: string;
}

export interface WpmHistory {
  timestamp: number;
  wpm: number;
}

// In-memory fallback in case IndexedDB/localStorage is blocked
const memoryStore = new Map<string, any>();

const db = localforage.createInstance({
  name: 'BlinkReader',
  driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
});

async function safeGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const res = await db.getItem<T>(key);
    if (res !== null && res !== undefined) return res;
    if (memoryStore.has(key)) return memoryStore.get(key);
    return fallback;
  } catch (err) {
    console.warn(`Storage get error for key "${key}", falling back:`, err);
    return memoryStore.has(key) ? memoryStore.get(key) : fallback;
  }
}

async function safeSet<T>(key: string, value: T): Promise<void> {
  memoryStore.set(key, value);
  try {
    await db.setItem(key, value);
  } catch (err) {
    console.warn(`Storage set error for key "${key}":`, err);
  }
}

async function safeRemove(key: string): Promise<void> {
  memoryStore.delete(key);
  try {
    await db.removeItem(key);
  } catch (err) {
    console.warn(`Storage remove error for key "${key}":`, err);
  }
}

export const storage = {
  async getDocuments(): Promise<DocumentMeta[]> {
    return safeGet<DocumentMeta[]>('documents', []);
  },

  async addDocument(meta: DocumentMeta, words: string[]): Promise<void> {
    const docs = await this.getDocuments();
    docs.push(meta);
    await safeSet('documents', docs);
    await safeSet(`doc_words_${meta.id}`, words);
    await safeSet(`doc_progress_${meta.id}`, { currentWordIndex: 0, wpm: 300 });
  },

  async deleteDocument(id: string): Promise<void> {
    const docs = await this.getDocuments();
    await safeSet('documents', docs.filter(d => d.id !== id));
    await safeRemove(`doc_words_${id}`);
    await safeRemove(`doc_progress_${id}`);
    await safeRemove(`doc_bookmarks_${id}`);
  },

  async getBookmarks(docId: string): Promise<Bookmark[]> {
    return safeGet<Bookmark[]>(`doc_bookmarks_${docId}`, []);
  },

  async addBookmark(docId: string, bookmark: Bookmark): Promise<void> {
    const bookmarks = await this.getBookmarks(docId);
    // Prevent exact duplicate index bookmarks or replace
    const filtered = bookmarks.filter(b => b.wordIndex !== bookmark.wordIndex);
    filtered.push(bookmark);
    // Sort by wordIndex ascending
    filtered.sort((a, b) => a.wordIndex - b.wordIndex);
    await safeSet(`doc_bookmarks_${docId}`, filtered);
  },

  async removeBookmark(docId: string, bookmarkId: string): Promise<void> {
    const bookmarks = await this.getBookmarks(docId);
    const updated = bookmarks.filter(b => b.id !== bookmarkId);
    await safeSet(`doc_bookmarks_${docId}`, updated);
  },

  async removeBookmarkByIndex(docId: string, wordIndex: number): Promise<void> {
    const bookmarks = await this.getBookmarks(docId);
    const updated = bookmarks.filter(b => b.wordIndex !== wordIndex);
    await safeSet(`doc_bookmarks_${docId}`, updated);
  },

  async getDocumentWords(id: string): Promise<string[] | null> {
    return safeGet<string[] | null>(`doc_words_${id}`, null);
  },

  async getDocumentProgress(id: string): Promise<DocumentProgress> {
    return safeGet<DocumentProgress>(`doc_progress_${id}`, { currentWordIndex: 0, wpm: 300 });
  },

  async updateDocumentProgress(id: string, progress: Partial<DocumentProgress>): Promise<void> {
    const current = await this.getDocumentProgress(id);
    await safeSet(`doc_progress_${id}`, { ...current, ...progress });
  },

  async getWpmHistory(): Promise<WpmHistory[]> {
    return safeGet<WpmHistory[]>('wpm_history', []);
  },

  async addWpmHistory(wpm: number): Promise<void> {
    const history = await this.getWpmHistory();
    history.push({ timestamp: Date.now(), wpm });
    await safeSet('wpm_history', history);
  },

  async getSettings(): Promise<UserSettings> {
    const settings = await safeGet<Partial<UserSettings>>('user_settings', {});
    return {
      theme: 'dark',
      fontSize: 100,
      showContextWords: true,
      autoSpeedAdjustment: true,
      ...settings,
    };
  },

  async updateSettings(settings: Partial<UserSettings>): Promise<void> {
    const current = await this.getSettings();
    await safeSet('user_settings', { ...current, ...settings });
  },
};
