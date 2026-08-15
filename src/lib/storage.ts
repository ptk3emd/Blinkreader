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
}

export interface WpmHistory {
  timestamp: number;
  wpm: number;
}

const db = localforage.createInstance({
  name: 'BlinkReader',
});

export const storage = {
  async getDocuments(): Promise<DocumentMeta[]> {
    const docs = await db.getItem<DocumentMeta[]>('documents');
    return docs || [];
  },

  async addDocument(meta: DocumentMeta, words: string[]): Promise<void> {
    const docs = await this.getDocuments();
    docs.push(meta);
    await db.setItem('documents', docs);
    await db.setItem(`doc_words_${meta.id}`, words);
    await db.setItem(`doc_progress_${meta.id}`, { currentWordIndex: 0, wpm: 300 });
  },

  async deleteDocument(id: string): Promise<void> {
    const docs = await this.getDocuments();
    await db.setItem('documents', docs.filter(d => d.id !== id));
    await db.removeItem(`doc_words_${id}`);
    await db.removeItem(`doc_progress_${id}`);
  },

  async getDocumentWords(id: string): Promise<string[] | null> {
    return db.getItem<string[]>(`doc_words_${id}`);
  },

  async getDocumentProgress(id: string): Promise<DocumentProgress> {
    const progress = await db.getItem<DocumentProgress>(`doc_progress_${id}`);
    return progress || { currentWordIndex: 0, wpm: 300 };
  },

  async updateDocumentProgress(id: string, progress: Partial<DocumentProgress>): Promise<void> {
    const current = await this.getDocumentProgress(id);
    await db.setItem(`doc_progress_${id}`, { ...current, ...progress });
  },

  async getWpmHistory(): Promise<WpmHistory[]> {
    const history = await db.getItem<WpmHistory[]>('wpm_history');
    return history || [];
  },

  async addWpmHistory(wpm: number): Promise<void> {
    const history = await this.getWpmHistory();
    history.push({ timestamp: Date.now(), wpm });
    await db.setItem('wpm_history', history);
  },

  async getSettings(): Promise<UserSettings> {
    const settings = await db.getItem<UserSettings>('user_settings');
    return settings || { theme: 'dark' };
  },

  async updateSettings(settings: Partial<UserSettings>): Promise<void> {
    const current = await this.getSettings();
    await db.setItem('user_settings', { ...current, ...settings });
  }
};
