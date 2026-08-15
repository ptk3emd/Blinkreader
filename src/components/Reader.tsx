import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, Play, Pause, List, ChevronLeft, ChevronRight, 
  Minus, Plus, X, Settings, Zap, Bookmark as BookmarkIcon, 
  BookmarkCheck, BookmarkPlus, Trash2, RotateCcw, Columns2 
} from 'lucide-react';
import { storage, DocumentProgress, Theme, Bookmark } from '../lib/storage';
import { formatRSVPWord, RSVPWord } from '../lib/rsvp';
import { computeParagraphs, ParagraphData } from '../lib/paragraph';
import ParagraphSplitView from './ParagraphSplitView';
import { cn } from '../lib/utils';

interface ReaderProps {
  documentId: string;
  onBack: () => void;
}

function formatBookmarkDate(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const themeClasses: Record<Theme, string> = {
  dark: 'bg-[#18181c] text-[#e8e8ec]',
  sepia: 'bg-[#222228] text-[#c2c2c9]',
  solarized: 'bg-[#1e1e24] text-[#D7D7F4]',
  oled: 'bg-[#101014] text-[#e8e8ec]'
};

const themeAccents: Record<Theme, string> = {
  dark: 'text-[#FCFD76]',
  sepia: 'text-[#F8B7A2]',
  solarized: 'text-[#c5c5ef]',
  oled: 'text-[#FCFD76]'
};

const themeBgAccent: Record<Theme, string> = {
  dark: 'bg-[#5fa777]',
  sepia: 'bg-[#F8B7A2]',
  solarized: 'bg-[#c5c5ef]',
  oled: 'bg-[#FCFD76]'
};

const themeBgAlt: Record<Theme, string> = {
  dark: 'bg-[#222228] border-[#33333c]',
  sepia: 'bg-[#2a2a32] border-[#33333c]',
  solarized: 'bg-[#262733] border-[#35325f]',
  oled: 'bg-[#18181c] border-[#33333c]'
};

export default function Reader({ documentId, onBack }: ReaderProps) {
  const [words, setWords] = useState<string[]>([]);
  const [progress, setProgress] = useState<DocumentProgress>({ currentWordIndex: 0, wpm: 300 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNav, setShowNav] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [navPreviewIndex, setNavPreviewIndex] = useState(0);
  const [toc, setToc] = useState<{label: string, index: number}[]>([]);
  const [theme, setTheme] = useState<Theme>('dark');
  const [fontSize, setFontSize] = useState<number>(100);
  const [showContextWords, setShowContextWords] = useState<boolean>(true);
  const [autoSpeedAdjustment, setAutoSpeedAdjustment] = useState<boolean>(true);
  const [speedNotification, setSpeedNotification] = useState<{ message: string; type: 'up' | 'down'; id: number } | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [activeNavTab, setActiveNavTab] = useState<'toc' | 'bookmarks'>('toc');
  const [bookmarkToast, setBookmarkToast] = useState<{ message: string; id: number } | null>(null);
  const [resumeToast, setResumeToast] = useState<{ message: string; id: number } | null>(null);
  const [exactWordInput, setExactWordInput] = useState<string>('');
  const [showSplitView, setShowSplitView] = useState<boolean>(false);
  const bookmarkToastTimeoutRef = useRef<number | null>(null);
  const resumeToastTimeoutRef = useRef<number | null>(null);

  // Compute structured paragraphs for the active document
  const paragraphs = useMemo<ParagraphData[]>(() => {
    return computeParagraphs(words);
  }, [words]);

  const triggerBookmarkToast = useCallback((message: string) => {
    if (bookmarkToastTimeoutRef.current) {
      clearTimeout(bookmarkToastTimeoutRef.current);
    }
    const id = Date.now();
    setBookmarkToast({ message, id });
    bookmarkToastTimeoutRef.current = window.setTimeout(() => {
      setBookmarkToast(curr => (curr?.id === id ? null : curr));
    }, 2400);
  }, []);

  const triggerResumeToast = useCallback((message: string) => {
    if (resumeToastTimeoutRef.current) {
      clearTimeout(resumeToastTimeoutRef.current);
    }
    const id = Date.now();
    setResumeToast({ message, id });
    resumeToastTimeoutRef.current = window.setTimeout(() => {
      setResumeToast(curr => (curr?.id === id ? null : curr));
    }, 3200);
  }, []);
  
  const timerRef = useRef<number | null>(null);
  const currentWordIndexRef = useRef(0);
  const lastSavedWordIndexRef = useRef(0);
  const wpmRef = useRef(300);
  const isPlayingRef = useRef(false);
  const autoSpeedAdjustmentRef = useRef(true);
  const focusStreakWordsRef = useRef(0);
  const wordsInCurrentPlaySessionRef = useRef(0);
  const recentPausesTimestampsRef = useRef<number[]>([]);
  const notificationTimeoutRef = useRef<number | null>(null);
  
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    autoSpeedAdjustmentRef.current = autoSpeedAdjustment;
  }, [autoSpeedAdjustment]);

  const triggerSpeedNotification = useCallback((message: string, type: 'up' | 'down') => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    const id = Date.now();
    setSpeedNotification({ message, type, id });
    notificationTimeoutRef.current = window.setTimeout(() => {
      setSpeedNotification(curr => (curr?.id === id ? null : curr));
    }, 2200);
  }, []);
  
  const saveProgress = useCallback(() => {
    const currentIdx = currentWordIndexRef.current;
    const currentWpm = wpmRef.current;
    lastSavedWordIndexRef.current = currentIdx;
    storage.updateDocumentProgress(documentId, {
      currentWordIndex: currentIdx,
      wpm: currentWpm
    });
  }, [documentId]);

  useEffect(() => {
    const loadData = async () => {
      // Record document as recently opened
      await storage.recordRecentlyRead(documentId);

      const docWords = await storage.getDocumentWords(documentId);
      const totalWordsCount = docWords ? docWords.length : 0;
      if (docWords) setWords(docWords);
      
      const docProgress = await storage.getDocumentProgress(documentId);
      const initialIndex = Math.max(0, Math.min(Math.max(0, totalWordsCount - 1), docProgress.currentWordIndex || 0));
      
      setProgress({
        currentWordIndex: initialIndex,
        wpm: docProgress.wpm || 300
      });
      currentWordIndexRef.current = initialIndex;
      lastSavedWordIndexRef.current = initialIndex;
      wpmRef.current = docProgress.wpm || 300;
      setNavPreviewIndex(initialIndex);
      setExactWordInput(String(initialIndex + 1));

      if (initialIndex > 0 && totalWordsCount > 0) {
        const percent = Math.min(100, Math.round(((initialIndex + 1) / totalWordsCount) * 100));
        triggerResumeToast(`Retomando da palavra ${(initialIndex + 1).toLocaleString()} de ${totalWordsCount.toLocaleString()} (${percent}%)`);
      }

      const userSettings = await storage.getSettings();
      setTheme(userSettings.theme);
      if (userSettings.fontSize) {
        setFontSize(userSettings.fontSize);
      }
      if (userSettings.showContextWords !== undefined) {
        setShowContextWords(userSettings.showContextWords);
      }
      if (userSettings.autoSpeedAdjustment !== undefined) {
        setAutoSpeedAdjustment(userSettings.autoSpeedAdjustment);
        autoSpeedAdjustmentRef.current = userSettings.autoSpeedAdjustment;
      }
      if (userSettings.showSplitParagraphView !== undefined) {
        setShowSplitView(userSettings.showSplitParagraphView);
      }

      const docBookmarks = await storage.getBookmarks(documentId);
      setBookmarks(docBookmarks);

      setLoading(false);
    };
    loadData();
  }, [documentId, triggerResumeToast]);

  // Lifecycle listeners for instant crash-proof state persistence
  useEffect(() => {
    const handleLifecycleSave = () => {
      saveProgress();
    };

    document.addEventListener('visibilitychange', handleLifecycleSave);
    window.addEventListener('pagehide', handleLifecycleSave);
    window.addEventListener('beforeunload', handleLifecycleSave);

    return () => {
      document.removeEventListener('visibilitychange', handleLifecycleSave);
      window.removeEventListener('pagehide', handleLifecycleSave);
      window.removeEventListener('beforeunload', handleLifecycleSave);
    };
  }, [saveProgress]);

  useEffect(() => {
    if (words.length > 0) {
      const generatedToc: {label: string, index: number}[] = [];
      const chapterRegex = /^(chapter|capítulo|part|parte)\b/i;
      
      for (let i = 0; i < words.length - 2; i++) {
        const cleanWord = words[i].replace(/[^a-zA-Záéíóúãõç]/gi, '');
        if (chapterRegex.test(cleanWord)) {
          const nextWord = words[i+1].replace(/[^a-zA-Z0-9]/gi, '');
          if (/^[0-9vxixv]+$/i.test(nextWord) || nextWord.length > 0) {
            let label = words.slice(i, i + 4).join(' ');
            if (label.length > 25) label = label.substring(0, 25) + '...';
            generatedToc.push({ label, index: i });
            i += 50; 
          }
        }
      }
      
      if (generatedToc.length < 3) {
        generatedToc.length = 0;
        for (let i = 0; i <= 10; i++) {
          const idx = Math.min(words.length - 1, Math.floor(i * (words.length / 10)));
          if (i === 10 && words.length > 0) {
            generatedToc.push({ label: 'End (100%)', index: words.length - 1 });
          } else {
            generatedToc.push({ label: `${i * 10}% - ${words[idx]?.substring(0, 15) || ''}...`, index: idx });
          }
        }
      }
      
      setToc(generatedToc);
    }
  }, [words]);

  // Handle cleanup and save on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      saveProgress();
      // Only log history if there was some reading happening, or just log the set WPM
      storage.addWpmHistory(wpmRef.current);
    };
  }, [saveProgress]);

  const nextWord = useCallback(() => {
    if (!isPlayingRef.current) return;
    
    if (currentWordIndexRef.current < words.length - 1) {
      currentWordIndexRef.current += 1;
      const newIndex = currentWordIndexRef.current;
      setProgress(p => ({ ...p, currentWordIndex: newIndex }));

      // Periodic auto-save every 10 words to ensure uninterrupted exact progress
      if (Math.abs(newIndex - lastSavedWordIndexRef.current) >= 10) {
        saveProgress();
      }

      // Track focus streak for auto-speed adjustment
      focusStreakWordsRef.current += 1;
      wordsInCurrentPlaySessionRef.current += 1;

      // Auto-increase speed (+5 WPM) every 60 consecutive words of sustained focus flow
      if (autoSpeedAdjustmentRef.current && focusStreakWordsRef.current >= 60) {
        focusStreakWordsRef.current = 0;
        if (wpmRef.current < 1000) {
          const newWpm = Math.min(1000, wpmRef.current + 5);
          wpmRef.current = newWpm;
          setProgress(p => ({ ...p, wpm: newWpm }));
          saveProgress();
          triggerSpeedNotification(`+5 WPM · Focus flow (${newWpm} WPM)`, 'up');
        }
      }
      
      // Calculate delay based on word features (punctuation, length) to improve comprehension
      let delayMultiplier = 1;
      const word = words[newIndex];
      if (word) {
        if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) delayMultiplier = 2.5;
        else if (word.endsWith(',') || word.endsWith(';') || word.endsWith(':')) delayMultiplier = 1.8;
        else if (word.length > 10) delayMultiplier = 1.3;
      }
      
      const baseDelayMs = 60000 / wpmRef.current;
      const totalDelay = baseDelayMs * delayMultiplier;
      
      timerRef.current = window.setTimeout(nextWord, totalDelay);
    } else {
      setIsPlaying(false);
      saveProgress();
    }
  }, [words, saveProgress, triggerSpeedNotification]);

  useEffect(() => {
    if (isPlaying) {
      // Start loop
      const baseDelayMs = 60000 / wpmRef.current;
      timerRef.current = window.setTimeout(nextWord, baseDelayMs);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, nextWord]);

  const togglePlay = () => {
    const nextPlayingState = !isPlaying;
    
    if (!nextPlayingState) {
      // User paused reading: save progress immediately
      saveProgress();

      // Check for hesitation or frequent pauses
      const now = Date.now();
      const recentPauses = recentPausesTimestampsRef.current.filter(t => now - t < 25000);
      const isFrequentPause = recentPauses.length >= 2;
      const isQuickStall = wordsInCurrentPlaySessionRef.current > 0 && wordsInCurrentPlaySessionRef.current < 15;
      
      if (autoSpeedAdjustmentRef.current && (isFrequentPause || isQuickStall)) {
        if (wpmRef.current > 60) {
          const newWpm = Math.max(50, wpmRef.current - 10);
          wpmRef.current = newWpm;
          setProgress(p => ({ ...p, wpm: newWpm }));
          saveProgress();
          triggerSpeedNotification(`-10 WPM · Pacing adjusted (${newWpm} WPM)`, 'down');
        }
        recentPausesTimestampsRef.current = [];
      } else {
        recentPausesTimestampsRef.current = [...recentPauses, now];
      }

      focusStreakWordsRef.current = 0;
      wordsInCurrentPlaySessionRef.current = 0;
    } else {
      // Resumed reading
      wordsInCurrentPlaySessionRef.current = 0;
    }

    setIsPlaying(nextPlayingState);
  };

  const handleBack = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPlaying(false);
    saveProgress();
    onBack();
  };

  const restartReading = () => {
    currentWordIndexRef.current = 0;
    setProgress(p => ({ ...p, currentWordIndex: 0 }));
    saveProgress();
    triggerResumeToast('Leitura reiniciada do início (palavra 1)');
  };

  const updateWpm = (delta: number) => {
    focusStreakWordsRef.current = 0;
    wordsInCurrentPlaySessionRef.current = 0;
    const newWpm = Math.max(50, Math.min(1000, wpmRef.current + delta));
    wpmRef.current = newWpm;
    setProgress(p => ({ ...p, wpm: newWpm }));
    saveProgress();
  };

  const setWpmDirectly = (value: number) => {
    focusStreakWordsRef.current = 0;
    wordsInCurrentPlaySessionRef.current = 0;
    const newWpm = Math.max(50, Math.min(1000, Math.round(value)));
    wpmRef.current = newWpm;
    setProgress(p => ({ ...p, wpm: newWpm }));
    saveProgress();
  };

  const jumpWords = (delta: number) => {
    let newIndex = currentWordIndexRef.current + delta;
    newIndex = Math.max(0, Math.min(words.length - 1, newIndex));
    currentWordIndexRef.current = newIndex;
    setProgress(p => ({ ...p, currentWordIndex: newIndex }));
    saveProgress();

    // If rewinding backwards, adjust pacing slightly to aid comprehension
    if (delta < 0) {
      focusStreakWordsRef.current = 0;
      wordsInCurrentPlaySessionRef.current = 0;
      if (autoSpeedAdjustmentRef.current && wpmRef.current > 60) {
        const newWpm = Math.max(50, wpmRef.current - 10);
        wpmRef.current = newWpm;
        setProgress(p => ({ ...p, wpm: newWpm }));
        saveProgress();
        triggerSpeedNotification(`-10 WPM · Rewind adjusted (${newWpm} WPM)`, 'down');
      }
    }
  };

  const openNav = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(false);
    setNavPreviewIndex(currentWordIndexRef.current);
    setExactWordInput(String(currentWordIndexRef.current + 1));
    setShowNav(true);
  };

  const jumpToNavIndex = () => {
    currentWordIndexRef.current = navPreviewIndex;
    setProgress(p => ({ ...p, currentWordIndex: navPreviewIndex }));
    setShowNav(false);
    saveProgress();
  };

  const handleDirectWordSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsedNum = parseInt(exactWordInput, 10);
    if (!isNaN(parsedNum) && words.length > 0) {
      const targetIdx = Math.max(0, Math.min(words.length - 1, parsedNum - 1));
      setNavPreviewIndex(targetIdx);
      setExactWordInput(String(targetIdx + 1));
    }
  };

  const jumpToBookmarkIndex = (index: number) => {
    currentWordIndexRef.current = index;
    setProgress(p => ({ ...p, currentWordIndex: index }));
    saveProgress();
    setShowNav(false);
    triggerBookmarkToast(`Saltou para o marcador na palavra ${(index + 1).toLocaleString()}`);
  };

  const toggleBookmarkAtIndex = useCallback(async (index: number) => {
    const existing = bookmarks.find(b => b.wordIndex === index);
    if (existing) {
      await storage.removeBookmark(documentId, existing.id);
      setBookmarks(prev => prev.filter(b => b.id !== existing.id));
      triggerBookmarkToast(`Marcador removido (palavra ${(index + 1).toLocaleString()})`);
    } else {
      const start = Math.max(0, index - 2);
      const end = Math.min(words.length, index + 6);
      const snippet = words.slice(start, end).join(' ');
      const newBm: Bookmark = {
        id: `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        wordIndex: index,
        snippet: snippet || `Palavra ${index + 1}`,
        timestamp: Date.now()
      };
      await storage.addBookmark(documentId, newBm);
      setBookmarks(prev => {
        const next = [...prev.filter(b => b.wordIndex !== index), newBm];
        next.sort((a, b) => a.wordIndex - b.wordIndex);
        return next;
      });
      triggerBookmarkToast(`Marcador salvo na palavra ${(index + 1).toLocaleString()}`);
    }
  }, [bookmarks, documentId, words, triggerBookmarkToast]);

  const toggleCurrentBookmark = useCallback(() => {
    toggleBookmarkAtIndex(currentWordIndexRef.current);
  }, [toggleBookmarkAtIndex]);

  const deleteBookmark = useCallback(async (bookmarkId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await storage.removeBookmark(documentId, bookmarkId);
    setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
    triggerBookmarkToast('Marcador excluído');
  }, [documentId, triggerBookmarkToast]);

  const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (words.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newIndex = Math.min(words.length - 1, Math.round(percentage * (words.length - 1)));
    
    // Check if user seeks back significantly (> 20 words)
    if (newIndex < currentWordIndexRef.current - 20) {
      focusStreakWordsRef.current = 0;
      wordsInCurrentPlaySessionRef.current = 0;
      if (autoSpeedAdjustmentRef.current && wpmRef.current > 60) {
        const newWpm = Math.max(50, wpmRef.current - 10);
        wpmRef.current = newWpm;
        saveProgress();
        triggerSpeedNotification(`-10 WPM · Seek adjusted (${newWpm} WPM)`, 'down');
      }
    }

    currentWordIndexRef.current = newIndex;
    setProgress(p => ({ ...p, currentWordIndex: newIndex }));
    saveProgress();
  };

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    storage.updateSettings({ theme: newTheme });
  };

  const updateFontSize = (newSize: number) => {
    setFontSize(newSize);
    storage.updateSettings({ fontSize: newSize });
  };

  const updateShowContextWords = (enabled: boolean) => {
    setShowContextWords(enabled);
    storage.updateSettings({ showContextWords: enabled });
  };

  const updateAutoSpeedAdjustment = (enabled: boolean) => {
    setAutoSpeedAdjustment(enabled);
    autoSpeedAdjustmentRef.current = enabled;
    storage.updateSettings({ autoSpeedAdjustment: enabled });
    if (enabled) {
      triggerSpeedNotification('Adaptive WPM Enabled', 'up');
    }
  };

  const toggleSplitView = useCallback((nextState?: boolean) => {
    setShowSplitView(curr => {
      const next = typeof nextState === 'boolean' ? nextState : !curr;
      storage.updateSettings({ showSplitParagraphView: next });
      return next;
    });
  }, []);

  const jumpToExactWord = useCallback((index: number) => {
    const boundedIndex = Math.max(0, Math.min(words.length - 1, index));
    currentWordIndexRef.current = boundedIndex;
    setProgress(p => ({ ...p, currentWordIndex: boundedIndex }));
    saveProgress();
  }, [words, saveProgress]);

  const openSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(false);
    setShowSettings(true);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input field
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        updateWpm(25);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        updateWpm(-25);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        jumpWords(-10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        jumpWords(10);
      } else if (e.code === 'KeyB' || e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        toggleCurrentBookmark();
      } else if (e.code === 'KeyV' || e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        toggleSplitView();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, toggleCurrentBookmark, toggleSplitView]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-zinc-500">Loading document...</div>;
  }

  const currentWord = words[progress.currentWordIndex] || '';
  const previousWordText = progress.currentWordIndex > 0 ? words[progress.currentWordIndex - 1] : '';
  const nextWordText = progress.currentWordIndex < words.length - 1 ? words[progress.currentWordIndex + 1] : '';
  const formattedWord = formatRSVPWord(currentWord);
  const progressPercent = words.length > 0 ? (progress.currentWordIndex / Math.max(1, words.length - 1)) * 100 : 0;
  const wordsLeft = Math.max(0, words.length - (progress.currentWordIndex + 1));
  const minutesLeft = Math.ceil(wordsLeft / Math.max(1, progress.wpm));
  const currentWordDisplayNum = Math.min(words.length, progress.currentWordIndex + 1);
  const isCurrentWordBookmarked = bookmarks.some(b => b.wordIndex === progress.currentWordIndex);
  const isNavPreviewBookmarked = bookmarks.some(b => b.wordIndex === navPreviewIndex);

  return (
    <div className={cn("flex flex-col h-screen overflow-hidden select-none", themeClasses[theme])} onClick={togglePlay}>
      
      {/* Top Persistent Progress Indicator */}
      <div className="w-full h-1 relative z-20 shrink-0 bg-[#3a3a44]">
        <div 
          className="h-full transition-all duration-150 ease-out bg-[#5fa777]" 
          style={{ width: `${progressPercent}%` }} 
        />
      </div>

      {/* Floating Speed & Bookmark Notifications */}
      {speedNotification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-3">
          <div className={cn(
            "flex items-center gap-2 px-4 py-1.5 rounded-[30px] text-xs sm:text-sm font-semibold shadow-[0_10px_30px_-18px_rgba(0,0,0,0.45)] backdrop-blur-md border",
            speedNotification.type === 'up'
              ? "bg-[#222228] text-[#5fa777] border-[#28342b]"
              : "bg-[#222228] text-[#F8B7A2] border-[#653a2c]"
          )}>
            <Zap className={cn("w-3.5 h-3.5", speedNotification.type === 'up' ? "text-[#5fa777] fill-[#5fa777]" : "text-[#F8B7A2] fill-[#F8B7A2]")} />
            <span>{speedNotification.message}</span>
          </div>
        </div>
      )}

      {bookmarkToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-[30px] text-xs sm:text-sm font-semibold shadow-[0_10px_30px_-18px_rgba(0,0,0,0.45)] backdrop-blur-md border bg-[#222228] text-[#FCFD76] border-[#514a19]">
            <BookmarkCheck className="w-4 h-4 text-[#FCFD76]" />
            <span>{bookmarkToast.message}</span>
          </div>
        </div>
      )}

      {resumeToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-[30px] text-xs sm:text-sm font-semibold shadow-[0_10px_30px_-18px_rgba(0,0,0,0.45)] backdrop-blur-md border bg-[#222228] text-[#5fa777] border-[#28342b]">
            <Zap className="w-4 h-4 text-[#5fa777] fill-[#5fa777]" />
            <span>{resumeToast.message}</span>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div 
        className={cn(
          "flex flex-wrap items-center justify-between p-4 sm:p-6 gap-y-4 transition-opacity duration-300",
          isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={handleBack}
          className="flex items-center gap-2 text-[#9a9aa3] hover:text-[#e8e8ec] bg-[#222228] hover:bg-[#2a2a32] border border-[#33333c] transition-all px-3 py-2 rounded-[11px] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-semibold text-xs sm:text-sm hidden sm:inline">Biblioteca</span>
        </button>
        
        <div className="flex items-center gap-2 sm:gap-3 px-3.5 sm:px-4 py-1.5 rounded-[30px] border border-[#33333c] bg-[#222228] order-3 w-full sm:w-auto sm:order-none justify-center">
          <button 
            onClick={(e) => { e.stopPropagation(); updateWpm(-25); }} 
            className="p-1 text-[#9a9aa3] hover:text-[#e8e8ec] transition-colors cursor-pointer shrink-0" 
            title="Reduzir velocidade (-25 WPM)"
          >
            <Minus className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1.5 font-mono font-bold text-sm sm:text-base text-[#e8e8ec] shrink-0">
            <span className="min-w-[3ch] text-right">{progress.wpm}</span>
            <span className="text-xs text-[#9a9aa3] font-sans font-medium">WPM</span>
            {autoSpeedAdjustment && (
              <span 
                className="ml-0.5 text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded-[30px] bg-[#35325f] text-[#c5c5ef] hidden md:inline-flex items-center gap-0.5"
                title="Ritmo adaptativo ativo: ajusta velocidade conforme foco e pausas"
              >
                <Zap className="w-2.5 h-2.5 fill-current" />
                AUTO
              </span>
            )}
          </div>

          {/* Dynamic WPM Slider */}
          <div className="flex items-center px-1 sm:px-1.5">
            <input 
              type="range" 
              min={50} 
              max={1000} 
              step={10}
              value={progress.wpm} 
              onChange={(e) => {
                e.stopPropagation();
                setWpmDirectly(Number(e.target.value));
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-20 xs:w-24 sm:w-28 md:w-36 accent-[#FCFD76] cursor-pointer h-1.5 bg-[#3a3a44] rounded-lg appearance-none"
              title={`Velocidade de leitura: ${progress.wpm} WPM`}
            />
          </div>

          <button 
            onClick={(e) => { e.stopPropagation(); updateWpm(25); }} 
            className="p-1 text-[#9a9aa3] hover:text-[#e8e8ec] transition-colors cursor-pointer shrink-0" 
            title="Aumentar velocidade (+25 WPM)"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Bookmark Button */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleCurrentBookmark(); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-[11px] border transition-all cursor-pointer",
              isCurrentWordBookmarked
                ? "bg-[#514a19] text-[#FCFD76] border-[#FCFD76]/60 shadow-[0_0_12px_rgba(252,253,118,0.2)]"
                : "text-[#9a9aa3] hover:text-[#e8e8ec] bg-[#222228] hover:bg-[#2a2a32] border-[#33333c]"
            )}
            title={isCurrentWordBookmarked ? "Remover marcador desta palavra (Atalho: B)" : "Adicionar marcador nesta palavra (Atalho: B)"}
          >
            {isCurrentWordBookmarked ? (
              <BookmarkCheck className="w-4 h-4 text-[#FCFD76]" />
            ) : (
              <BookmarkIcon className="w-4 h-4" />
            )}
            <span className="font-semibold text-xs sm:text-sm hidden sm:inline">
              {isCurrentWordBookmarked ? "Marcado" : "Marcar"}
            </span>
            {bookmarks.length > 0 && (
              <span className={cn(
                "text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ml-0.5",
                isCurrentWordBookmarked ? "bg-[#FCFD76] text-[#212121]" : "bg-[#35325f] text-[#c5c5ef]"
              )}>
                {bookmarks.length}
              </span>
            )}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); toggleSplitView(); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-[11px] border transition-all cursor-pointer",
              showSplitView
                ? "bg-[#2a2a36] text-[#FCFD76] border-[#404050]"
                : "text-[#9a9aa3] hover:text-[#e8e8ec] bg-[#222228] hover:bg-[#2a2a32] border-[#33333c]"
            )}
            title="Alternar Visão Dividida de Parágrafo (Atalho: V)"
          >
            <Columns2 className="w-4 h-4" />
            <span className="font-semibold text-xs sm:text-sm hidden sm:inline">
              Split
            </span>
          </button>

          <button 
            onClick={openSettings}
            className="p-2.5 text-[#9a9aa3] hover:text-[#e8e8ec] bg-[#222228] hover:bg-[#2a2a32] border border-[#33333c] rounded-[11px] transition-all cursor-pointer"
            title="Configurações de Leitura"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button 
            onClick={openNav}
            className="flex items-center gap-2 text-[#9a9aa3] hover:text-[#e8e8ec] bg-[#222228] hover:bg-[#2a2a32] border border-[#33333c] px-3 py-2 rounded-[11px] transition-all cursor-pointer"
            title="Navegar no texto e marcadores"
          >
            <span className="font-semibold text-xs sm:text-sm hidden sm:inline">Navegar</span>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Reader Area */}
      {showSplitView ? (
        <div className="flex-1 flex flex-col md:flex-row items-stretch justify-center relative px-3 sm:px-6 py-2 gap-3 sm:gap-5 overflow-hidden min-h-0">
          {/* Left / Top Pane: RSVP Dynamic Reader Stage */}
          <div 
            className="flex-1 flex flex-col items-center justify-center relative p-4 sm:p-8 bg-[#18181c]/80 border border-[#33333c] rounded-[20px] overflow-hidden shadow-inner cursor-pointer"
            onClick={togglePlay}
          >
            <div 
              className="flex flex-col items-center justify-center w-full transition-transform duration-200 origin-center select-none"
              style={{ transform: `scale(${Math.max(70, fontSize * 0.9) / 100})` }}
            >
              {/* Previous Word */}
              {showContextWords && (
                <div className="font-mono text-xs sm:text-base md:text-xl opacity-25 h-6 sm:h-8 flex items-center justify-center text-center px-4 tracking-normal transition-opacity duration-150 pointer-events-none text-[#c2c2c9]">
                  {previousWordText || <span className="opacity-0">—</span>}
                </div>
              )}

              {/* Current RSVP Word */}
              <div className="flex items-baseline font-mono text-[9vw] md:text-5xl lg:text-6xl xl:text-7xl w-full my-3 sm:my-5">
                {/* Prefix (right-aligned) */}
                <div className="flex-1 text-right text-[#e8e8ec] opacity-85">
                  {formattedWord.prefix}
                </div>
                {/* ORP (highlighted in highlighter yellow or theme accent) */}
                <div className={cn("font-extrabold relative shrink-0", themeAccents[theme])}>
                  {/* Crosshair indicator lines */}
                  <div className="absolute -top-3.5 sm:-top-4.5 left-1/2 -translate-x-1/2 w-0.5 h-2 sm:h-2.5 bg-current opacity-60 rounded-full pointer-events-none"></div>
                  <div className="absolute -bottom-3.5 sm:-bottom-4.5 left-1/2 -translate-x-1/2 w-0.5 h-2 sm:h-2.5 bg-current opacity-60 rounded-full pointer-events-none"></div>
                  
                  {formattedWord.orp}
                </div>
                {/* Suffix (left-aligned) */}
                <div className="flex-1 text-left text-[#e8e8ec] opacity-85">
                  {formattedWord.suffix}
                </div>
              </div>

              {/* Next Word */}
              {showContextWords && (
                <div className="font-mono text-xs sm:text-base md:text-xl opacity-25 h-6 sm:h-8 flex items-center justify-center text-center px-4 tracking-normal transition-opacity duration-150 pointer-events-none text-[#c2c2c9]">
                  {nextWordText || <span className="opacity-0">—</span>}
                </div>
              )}
            </div>

            <div className="absolute bottom-2.5 right-3 text-[10px] font-mono text-[#9a9aa3]/70 hidden sm:block">
              {isPlaying ? "Clique para pausar" : "Clique ou Espaço para ler"}
            </div>
          </div>

          {/* Right / Bottom Pane: Paragraph Split View */}
          <div className="flex-1 flex flex-col h-[42vh] md:h-auto min-h-0 overflow-hidden">
            <ParagraphSplitView
              paragraphs={paragraphs}
              currentWordIndex={progress.currentWordIndex}
              theme={theme}
              onWordClick={jumpToExactWord}
              onClose={() => toggleSplitView(false)}
              isPlaying={isPlaying}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center relative px-4">
          {/* Word Display with Context Words */}
          <div 
            className="flex flex-col items-center justify-center w-full transition-transform duration-200 origin-center select-none"
            style={{ transform: `scale(${fontSize / 100})` }}
          >
            {/* Previous Word (Larger font, lower opacity) */}
            {showContextWords && (
              <div className="font-mono text-sm sm:text-xl md:text-2xl lg:text-3xl opacity-20 h-8 sm:h-10 flex items-center justify-center text-center px-4 tracking-normal transition-opacity duration-150 pointer-events-none text-[#c2c2c9]">
                {previousWordText || <span className="opacity-0">—</span>}
              </div>
            )}

            {/* Current RSVP Word */}
            <div className="flex items-baseline font-mono text-[8vw] md:text-7xl lg:text-8xl w-full my-4 sm:my-6">
              {/* Prefix (right-aligned) */}
              <div className="flex-1 text-right text-[#e8e8ec] opacity-85">
                {formattedWord.prefix}
              </div>
              {/* ORP (highlighted in highlighter yellow or theme accent) */}
              <div className={cn("font-extrabold relative shrink-0", themeAccents[theme])}>
                {/* Crosshair indicator lines */}
                <div className="absolute -top-3.5 sm:-top-4.5 left-1/2 -translate-x-1/2 w-0.5 h-2 sm:h-2.5 bg-current opacity-60 rounded-full pointer-events-none"></div>
                <div className="absolute -bottom-3.5 sm:-bottom-4.5 left-1/2 -translate-x-1/2 w-0.5 h-2 sm:h-2.5 bg-current opacity-60 rounded-full pointer-events-none"></div>
                
                {formattedWord.orp}
              </div>
              {/* Suffix (left-aligned) */}
              <div className="flex-1 text-left text-[#e8e8ec] opacity-85">
                {formattedWord.suffix}
              </div>
            </div>

            {/* Next Word (Larger font, lower opacity) */}
            {showContextWords && (
              <div className="font-mono text-sm sm:text-xl md:text-2xl lg:text-3xl opacity-20 h-8 sm:h-10 flex items-center justify-center text-center px-4 tracking-normal transition-opacity duration-150 pointer-events-none text-[#c2c2c9]">
                {nextWordText || <span className="opacity-0">—</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual Progress Bar & Tracking Info */}
      <div 
        className={cn(
          "w-full max-w-xl mx-auto px-6 transition-opacity duration-300 z-10",
          isPlaying ? "opacity-30 hover:opacity-100" : "opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress labels */}
        <div className="flex items-center justify-between text-xs font-mono text-[#9a9aa3] mb-2 select-none">
          <span className="font-medium">
            Palavra <span className="font-bold text-[#FCFD76]">{currentWordDisplayNum.toLocaleString()}</span> de {words.length.toLocaleString()}
          </span>
          <span className="font-extrabold px-2 py-0.5 rounded-[30px] bg-[#35325f] text-[#c5c5ef]">
            {Math.round(progressPercent)}%
          </span>
          <span>
            {wordsLeft === 0 ? 'Concluído' : `~${minutesLeft} min restantes`}
          </span>
        </div>

        {/* Interactive Progress Track with Bookmark Markers */}
        <div 
          className="group relative h-2.5 sm:h-3 rounded-full cursor-pointer transition-all hover:h-3.5 flex items-center bg-[#3a3a44] border border-[#33333c]"
          onClick={handleProgressSeek}
          title="Clique para navegar no texto"
        >
          {/* Progress fill */}
          <div 
            className="h-full rounded-full transition-all duration-150 ease-out relative bg-[#5fa777]"
            style={{ width: `${progressPercent}%` }}
          >
            {/* Scrubber thumb */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#FCFD76] shadow-md border-2 border-[#18181c] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>

          {/* Bookmark Markers along track */}
          {bookmarks.map((bm) => {
            const bmPercent = words.length > 0 ? (bm.wordIndex / Math.max(1, words.length - 1)) * 100 : 0;
            return (
              <button
                key={bm.id}
                type="button"
                style={{ left: `${bmPercent}%` }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#FCFD76] shadow-[0_0_6px_rgba(252,253,118,0.9)] border border-[#18181c] z-10 transition-transform hover:scale-175 cursor-pointer focus:outline-none"
                title={`Marcador: Palavra ${(bm.wordIndex + 1).toLocaleString()} (${Math.round(bmPercent)}%) - "${bm.snippet}"`}
                onClick={(e) => {
                  e.stopPropagation();
                  jumpToBookmarkIndex(bm.wordIndex);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom Controls */}
      <div 
        className={cn(
          "p-5 sm:p-7 flex justify-center items-center gap-4 sm:gap-8 transition-opacity duration-300",
          isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={() => jumpWords(-10)}
          className="p-3.5 rounded-full bg-[#222228] border border-[#33333c] text-[#c2c2c9] hover:text-[#e8e8ec] hover:bg-[#2a2a32] transition-all hover:-translate-y-0.5 cursor-pointer shadow-none"
          title="Recuar 10 palavras"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <button 
          onClick={togglePlay}
          className="w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center bg-[#FCFD76] hover:bg-[#eef05a] text-[#212121] transition-all hover:-translate-y-0.5 active:scale-95 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.45)] cursor-pointer"
          title={isPlaying ? "Pausar (Espaço)" : "Iniciar Leitura (Espaço)"}
        >
          {isPlaying ? <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" /> : <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5" />}
        </button>

        <button 
          onClick={() => jumpWords(10)}
          className="p-3.5 rounded-full bg-[#222228] border border-[#33333c] text-[#c2c2c9] hover:text-[#e8e8ec] hover:bg-[#2a2a32] transition-all hover:-translate-y-0.5 cursor-pointer shadow-none"
          title="Avançar 10 palavras"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {progress.currentWordIndex >= Math.max(1, words.length - 1) && words.length > 0 && (
          <button
            onClick={restartReading}
            className="px-3.5 py-2.5 rounded-full bg-[#222228] border border-[#5fa777]/40 text-[#5fa777] hover:bg-[#5fa777]/15 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="Reiniciar leitura a partir da palavra 1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reiniciar</span>
          </button>
        )}
      </div>
      
      {/* Navigation Modal */}
      {showNav && (
        <div 
          className="fixed inset-0 z-50 bg-[rgba(20,20,40,0.6)] backdrop-blur-sm flex flex-col p-3 sm:p-4 md:p-10 animate-in fade-in"
          onClick={(e) => { e.stopPropagation(); setShowNav(false); }}
        >
          <div 
            className="flex flex-col bg-[#222228] border border-[#33333c] rounded-[24px] w-full max-w-5xl mx-auto h-full overflow-hidden shadow-[0_18px_40px_-22px_rgba(0,0,0,0.55)] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#33333c]">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#9a9aa3]">
                  Navegação
                </span>
                <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight text-[#e8e8ec]">
                  Localizar no Texto & Marcadores
                </h2>
              </div>
              <button 
                onClick={() => setShowNav(false)}
                className="p-2 text-[#9a9aa3] hover:text-[#e8e8ec] hover:bg-[#2a2a32] rounded-[11px] border border-[#33333c] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              
              {/* Sidebar with Tabs (TOC and Bookmarks) */}
              <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-[#33333c] bg-[#1e1e24] flex flex-col p-3 sm:p-4 overflow-y-auto max-h-48 md:max-h-none shrink-0">
                {/* Tab Switcher */}
                <div className="flex bg-[#18181c] p-1 rounded-[12px] border border-[#33333c] mb-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveNavTab('toc')}
                    className={cn(
                      "flex-1 py-1.5 px-2 rounded-[9px] text-xs font-bold transition-all text-center cursor-pointer",
                      activeNavTab === 'toc'
                        ? "bg-[#35325f] text-[#c5c5ef]"
                        : "text-[#9a9aa3] hover:text-[#e8e8ec]"
                    )}
                  >
                    Capítulos ({toc.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveNavTab('bookmarks')}
                    className={cn(
                      "flex-1 py-1.5 px-2 rounded-[9px] text-xs font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer",
                      activeNavTab === 'bookmarks'
                        ? "bg-[#35325f] text-[#c5c5ef]"
                        : "text-[#9a9aa3] hover:text-[#e8e8ec]"
                    )}
                  >
                    <BookmarkIcon className="w-3 h-3" />
                    Marcadores ({bookmarks.length})
                  </button>
                </div>

                {activeNavTab === 'toc' ? (
                  <div className="flex flex-col gap-1.5">
                    {toc.map((item, i) => {
                      const isActive = navPreviewIndex >= item.index && (i === toc.length - 1 || navPreviewIndex < toc[i+1].index);
                      return (
                        <button 
                          key={i}
                          onClick={() => setNavPreviewIndex(item.index)}
                          className={cn(
                            "text-left px-3 py-2 rounded-[10px] text-xs sm:text-sm transition-colors cursor-pointer", 
                            isActive ? "bg-[#35325f] text-[#c5c5ef] font-bold" : "text-[#9a9aa3] hover:bg-[#2a2a32] hover:text-[#e8e8ec]"
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {bookmarks.length === 0 ? (
                      <div className="py-6 px-2 text-center text-xs text-[#9a9aa3] flex flex-col items-center">
                        <BookmarkIcon className="w-7 h-7 mb-2 opacity-40 text-[#9a9aa3]" />
                        <p className="font-semibold text-[#c2c2c9] mb-1">Nenhum marcador salvo</p>
                        <p className="leading-relaxed text-[11px] opacity-75">
                          Pressione a tecla <kbd className="px-1 py-0.5 rounded bg-[#18181c] border border-[#33333c] text-[#FCFD76] font-mono">B</kbd> durante a leitura ou use o botão abaixo para marcar esta posição.
                        </p>
                      </div>
                    ) : (
                      bookmarks.map((bm) => {
                        const isSelected = navPreviewIndex === bm.wordIndex;
                        const bmPercent = words.length > 0 ? Math.round((bm.wordIndex / Math.max(1, words.length - 1)) * 100) : 0;
                        return (
                          <div
                            key={bm.id}
                            onClick={() => setNavPreviewIndex(bm.wordIndex)}
                            className={cn(
                              "group p-2.5 sm:p-3 rounded-[12px] border transition-all cursor-pointer flex flex-col gap-1 relative",
                              isSelected
                                ? "bg-[#28273d] border-[#504a8a] text-[#e8e8ec]"
                                : "bg-[#18181c] border-[#33333c] hover:border-[#474182] text-[#c2c2c9]"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#FCFD76]">
                                <BookmarkIcon className="w-3 h-3 fill-current" />
                                <span>{bmPercent}%</span>
                                <span className="text-[10px] text-[#9a9aa3] font-normal font-sans">
                                  • Palavra {(bm.wordIndex + 1).toLocaleString()}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => deleteBookmark(bm.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-[#9a9aa3] hover:text-[#ff6b63] hover:bg-[#ff6b63]/10 rounded-[6px] transition-all cursor-pointer"
                                title="Excluir marcador"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            <p className="text-xs italic text-[#e8e8ec]/90 line-clamp-2 leading-relaxed">
                              &ldquo;{bm.snippet}&rdquo;
                            </p>

                            <div className="flex items-center justify-between text-[10px] text-[#9a9aa3] mt-0.5">
                              <span>{formatBookmarkDate(bm.timestamp)}</span>
                              <span className="group-hover:text-[#FCFD76] text-[10px] font-semibold transition-colors">
                                Visualizar &rarr;
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Right side Text Preview & Scrubber */}
              <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden">
                <div className="mb-3 sm:mb-5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs font-mono text-[#9a9aa3]">
                    <span>Início (0%)</span>
                    <span className="text-[#FCFD76] font-bold font-mono text-sm">
                      {Math.round((navPreviewIndex / Math.max(1, words.length - 1)) * 100)}%
                    </span>
                    <span>Fim (100%)</span>
                  </div>

                  <input 
                    type="range" 
                    min={0} 
                    max={Math.max(0, words.length - 1)} 
                    value={navPreviewIndex} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setNavPreviewIndex(val);
                      setExactWordInput(String(val + 1));
                    }}
                    className="w-full accent-[#FCFD76] cursor-pointer h-2.5 bg-[#3a3a44] rounded-lg appearance-none"
                  />

                  {/* Direct Exact Word Number Input */}
                  <form 
                    onSubmit={handleDirectWordSubmit} 
                    className="flex flex-wrap items-center justify-between gap-2 pt-1"
                  >
                    <div className="text-xs text-[#9a9aa3] font-mono">
                      Palavra <span className="text-[#e8e8ec] font-bold">{(navPreviewIndex + 1).toLocaleString()}</span> de {words.length.toLocaleString()}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label htmlFor="exactWordInput" className="text-[11px] text-[#9a9aa3] font-medium hidden sm:inline">
                        Ir para palavra:
                      </label>
                      <input 
                        id="exactWordInput"
                        type="number"
                        min={1}
                        max={Math.max(1, words.length)}
                        value={exactWordInput}
                        onChange={(e) => setExactWordInput(e.target.value)}
                        className="w-24 px-2 py-1 text-xs font-mono text-center bg-[#18181c] border border-[#33333c] focus:border-[#FCFD76] focus:outline-none rounded-[8px] text-[#e8e8ec]"
                        placeholder="Nº"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 text-xs font-bold bg-[#35325f] hover:bg-[#433f78] text-[#c5c5ef] rounded-[8px] transition-colors cursor-pointer"
                      >
                        Ir
                      </button>
                    </div>
                  </form>
                </div>

                <div className="flex-1 bg-[#18181c] rounded-[16px] p-4 sm:p-6 overflow-y-auto text-sm sm:text-base leading-relaxed text-[#c2c2c9] border border-[#33333c]">
                  {(() => {
                    const startIdx = Math.max(0, navPreviewIndex - 100);
                    const endIdx = Math.min(words.length, navPreviewIndex + 300);
                    const previewWords = words.slice(startIdx, endIdx);
                    
                    return (
                      <>
                        {startIdx > 0 && <span className="text-[#9a9aa3] mr-2">...</span>}
                        {previewWords.map((word, i) => {
                          const actualIndex = startIdx + i;
                          const isSelected = actualIndex === navPreviewIndex;
                          const hasBookmark = bookmarks.some(b => b.wordIndex === actualIndex);
                          return (
                            <span 
                              key={actualIndex}
                              onClick={() => setNavPreviewIndex(actualIndex)}
                              onDoubleClick={() => {
                                setNavPreviewIndex(actualIndex);
                                setTimeout(jumpToNavIndex, 0);
                              }}
                              className={cn(
                                "cursor-pointer transition-colors duration-100 rounded-[4px] px-0.5 inline-block relative", 
                                isSelected 
                                  ? "text-[#212121] font-bold bg-[#FCFD76] px-1 mx-0.5" 
                                  : hasBookmark
                                  ? "text-[#FCFD76] font-semibold underline decoration-[#FCFD76]/50 underline-offset-2 hover:bg-[#2a2a32]"
                                  : "hover:text-[#e8e8ec] hover:bg-[#2a2a32]"
                              )}
                              title={hasBookmark ? "Marcador nesta palavra" : undefined}
                            >
                              {word}{' '}
                            </span>
                          );
                        })}
                        {endIdx < words.length && <span className="text-[#9a9aa3] ml-2">...</span>}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Navigation Modal Footer */}
            <div className="p-3 sm:p-5 border-t border-[#33333c] bg-[#1e1e24] flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => toggleBookmarkAtIndex(navPreviewIndex)}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-[12px] text-xs sm:text-sm font-semibold border transition-all w-full sm:w-auto cursor-pointer",
                  isNavPreviewBookmarked
                    ? "bg-[#514a19]/50 text-[#FCFD76] border-[#FCFD76]/50 hover:bg-[#514a19]/70"
                    : "bg-[#222228] text-[#c2c2c9] hover:text-[#e8e8ec] hover:bg-[#2a2a32] border-[#33333c]"
                )}
              >
                {isNavPreviewBookmarked ? (
                  <>
                    <BookmarkCheck className="w-4 h-4 text-[#FCFD76]" />
                    <span>Marcador salvo nesta posição (remover)</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-4 h-4 text-[#FCFD76]" />
                    <span>Salvar marcador nesta posição</span>
                  </>
                )}
              </button>

              <button 
                onClick={jumpToNavIndex}
                className="px-6 py-2.5 sm:px-8 bg-[#FCFD76] hover:bg-[#eef05a] text-[#212121] rounded-[12px] font-bold transition-all hover:-translate-y-0.5 shadow-none w-full sm:w-auto text-center cursor-pointer text-xs sm:text-sm"
              >
                Continuar a partir daqui
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div 
          className="fixed inset-0 z-50 bg-[rgba(20,20,40,0.6)] backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={(e) => { e.stopPropagation(); setShowSettings(false); }}
        >
          <div 
            className="flex flex-col bg-[#222228] border border-[#33333c] rounded-[24px] w-full max-w-md mx-auto overflow-hidden shadow-[0_18px_40px_-22px_rgba(0,0,0,0.55)] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#33333c]">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#9a9aa3]">
                  Preferências
                </span>
                <h2 className="text-xl font-extrabold tracking-tight text-[#e8e8ec]">Configurações</h2>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-2 text-[#9a9aa3] hover:text-[#e8e8ec] hover:bg-[#2a2a32] rounded-[11px] border border-[#33333c] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[75vh]">
              <h3 className="text-[11px] font-extrabold text-[#9a9aa3] uppercase tracking-[0.12em] mb-3">Ambiente de Leitura</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => updateTheme('dark')}
                  className={cn(
                    "flex flex-col items-center p-3.5 rounded-[16px] border transition-all cursor-pointer",
                    theme === 'dark' ? "border-[#FCFD76] bg-[#514a19]/30" : "border-[#33333c] bg-[#18181c] hover:border-[#474182]"
                  )}
                >
                  <div className="w-full h-10 bg-[#18181c] rounded-[8px] border border-[#33333c] flex items-center justify-center mb-2">
                    <span className="text-[#e8e8ec] font-mono text-base"><span className="opacity-50">T</span><span className="text-[#FCFD76] font-bold">h</span><span className="opacity-50">e</span></span>
                  </div>
                  <span className="text-xs font-bold text-[#e8e8ec]">Escuro Padrão</span>
                </button>
                
                <button
                  onClick={() => updateTheme('sepia')}
                  className={cn(
                    "flex flex-col items-center p-3.5 rounded-[16px] border transition-all cursor-pointer",
                    theme === 'sepia' ? "border-[#F8B7A2] bg-[#653a2c]/30" : "border-[#33333c] bg-[#18181c] hover:border-[#474182]"
                  )}
                >
                  <div className="w-full h-10 bg-[#222228] rounded-[8px] border border-[#33333c] flex items-center justify-center mb-2">
                    <span className="text-[#c2c2c9] font-mono text-base"><span className="opacity-50">T</span><span className="text-[#F8B7A2] font-bold">h</span><span className="opacity-50">e</span></span>
                  </div>
                  <span className="text-xs font-bold text-[#e8e8ec]">Sépia Conforto</span>
                </button>

                <button
                  onClick={() => updateTheme('solarized')}
                  className={cn(
                    "flex flex-col items-center p-3.5 rounded-[16px] border transition-all cursor-pointer",
                    theme === 'solarized' ? "border-[#c5c5ef] bg-[#35325f]/30" : "border-[#33333c] bg-[#18181c] hover:border-[#474182]"
                  )}
                >
                  <div className="w-full h-10 bg-[#1e1e24] rounded-[8px] border border-[#35325f] flex items-center justify-center mb-2">
                    <span className="text-[#D7D7F4] font-mono text-base"><span className="opacity-50">T</span><span className="text-[#c5c5ef] font-bold">h</span><span className="opacity-50">e</span></span>
                  </div>
                  <span className="text-xs font-bold text-[#e8e8ec]">Lavanda Foco</span>
                </button>

                <button
                  onClick={() => updateTheme('oled')}
                  className={cn(
                    "flex flex-col items-center p-3.5 rounded-[16px] border transition-all cursor-pointer",
                    theme === 'oled' ? "border-[#FCFD76] bg-[#514a19]/30" : "border-[#33333c] bg-[#18181c] hover:border-[#474182]"
                  )}
                >
                  <div className="w-full h-10 bg-[#101014] rounded-[8px] border border-[#33333c] flex items-center justify-center mb-2">
                    <span className="text-[#e8e8ec] font-mono text-base"><span className="opacity-50">T</span><span className="text-[#FCFD76] font-bold">h</span><span className="opacity-50">e</span></span>
                  </div>
                  <span className="text-xs font-bold text-[#e8e8ec]">OLED Profundo</span>
                </button>
              </div>

              <h3 className="text-[11px] font-extrabold text-[#9a9aa3] uppercase tracking-[0.12em] mb-3">Velocidade de Leitura (WPM)</h3>
              <div className="bg-[#18181c] border border-[#33333c] rounded-[14px] p-4 mb-6">
                <div className="flex items-center justify-between text-[#9a9aa3] mb-3 text-xs font-semibold">
                  <span>50 WPM</span>
                  <span className="font-mono text-[#FCFD76] font-bold text-sm">{progress.wpm} WPM</span>
                  <span>1000 WPM</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="1000" 
                  step="10"
                  value={progress.wpm}
                  onChange={(e) => setWpmDirectly(Number(e.target.value))}
                  className="w-full accent-[#FCFD76] cursor-pointer h-2 bg-[#3a3a44] rounded-lg appearance-none mb-3"
                />
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                  {[150, 250, 350, 450, 600, 800].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setWpmDirectly(preset)}
                      className={cn(
                        "py-1 px-1.5 rounded-[8px] text-xs font-mono font-semibold border transition-all cursor-pointer text-center",
                        progress.wpm === preset
                          ? "bg-[#FCFD76] text-[#212121] border-[#FCFD76] font-bold"
                          : "bg-[#222228] text-[#c2c2c9] border-[#33333c] hover:border-[#FCFD76]/50"
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <h3 className="text-[11px] font-extrabold text-[#9a9aa3] uppercase tracking-[0.12em] mb-3">Tamanho da Fonte</h3>
              <div className="bg-[#18181c] border border-[#33333c] rounded-[14px] p-4 mb-6">
                <div className="flex items-center justify-between text-[#9a9aa3] mb-3 text-xs font-semibold">
                  <span>Menor</span>
                  <span className="font-mono text-[#FCFD76] font-bold text-sm">{fontSize}%</span>
                  <span>Maior</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="150" 
                  step="5"
                  value={fontSize}
                  onChange={(e) => updateFontSize(Number(e.target.value))}
                  className="w-full accent-[#FCFD76] cursor-pointer h-2 bg-[#3a3a44] rounded-lg appearance-none"
                />
              </div>

              <h3 className="text-[11px] font-extrabold text-[#9a9aa3] uppercase tracking-[0.12em] mb-3">Contexto de Palavras</h3>
              <div className="bg-[#18181c] border border-[#33333c] rounded-[14px] p-4 flex items-center justify-between mb-6">
                <div className="flex flex-col pr-4">
                  <span className="text-[#e8e8ec] font-bold text-xs sm:text-sm">Palavra Anterior & Posterior</span>
                  <span className="text-[11px] text-[#9a9aa3] mt-0.5">Exibe adjacentes em menor opacidade para visão periférica</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateShowContextWords(!showContextWords)}
                  className={cn(
                    "w-12 h-6 shrink-0 flex items-center rounded-[30px] p-1 transition-colors duration-200 cursor-pointer",
                    showContextWords ? "bg-[#35325f] justify-end" : "bg-[#3a3a44] justify-start"
                  )}
                  aria-label="Alternar palavras de contexto"
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                </button>
              </div>

              <h3 className="text-[11px] font-extrabold text-[#9a9aa3] uppercase tracking-[0.12em] mb-3">Velocidade Adaptativa (Auto WPM)</h3>
              <div className="bg-[#18181c] border border-[#33333c] rounded-[14px] p-4 flex items-center justify-between mb-6">
                <div className="flex flex-col pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[#e8e8ec] font-bold text-xs sm:text-sm">Ajuste Inteligente de Ritmo</span>
                    <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded-[30px] bg-[#35325f] text-[#c5c5ef] flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5 fill-current" />
                      Smart
                    </span>
                  </div>
                  <span className="text-[11px] text-[#9a9aa3] mt-1">
                    Acelera suavemente (+5 WPM) em fluxo contínuo e desacelera (-10 WPM) em pausas e recuos.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => updateAutoSpeedAdjustment(!autoSpeedAdjustment)}
                  className={cn(
                    "w-12 h-6 shrink-0 flex items-center rounded-[30px] p-1 transition-colors duration-200 cursor-pointer",
                    autoSpeedAdjustment ? "bg-[#35325f] justify-end" : "bg-[#3a3a44] justify-start"
                  )}
                  aria-label="Alternar ajuste de velocidade"
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                </button>
              </div>

              <h3 className="text-[11px] font-extrabold text-[#9a9aa3] uppercase tracking-[0.12em] mb-3">Visão Dividida (Split Parágrafo)</h3>
              <div className="bg-[#18181c] border border-[#33333c] rounded-[14px] p-4 flex items-center justify-between">
                <div className="flex flex-col pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[#e8e8ec] font-bold text-xs sm:text-sm">Acompanhamento de Parágrafo</span>
                    <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded-[30px] bg-[#35325f] text-[#c5c5ef]">
                      Atalho: V
                    </span>
                  </div>
                  <span className="text-[11px] text-[#9a9aa3] mt-1">
                    Exibe a visualização de leitura dinâmica lado a lado com o parágrafo completo e palavra ativa destacada.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSplitView()}
                  className={cn(
                    "w-12 h-6 shrink-0 flex items-center rounded-[30px] p-1 transition-colors duration-200 cursor-pointer",
                    showSplitView ? "bg-[#35325f] justify-end" : "bg-[#3a3a44] justify-start"
                  )}
                  aria-label="Alternar visão dividida de parágrafo"
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
