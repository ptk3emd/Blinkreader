import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Play, Pause, List, ChevronLeft, ChevronRight, Minus, Plus, X, Settings, Zap } from 'lucide-react';
import { storage, DocumentProgress, Theme } from '../lib/storage';
import { formatRSVPWord, RSVPWord } from '../lib/rsvp';
import { cn } from '../lib/utils';

interface ReaderProps {
  documentId: string;
  onBack: () => void;
}

const themeClasses: Record<Theme, string> = {
  dark: 'bg-zinc-950 text-zinc-100',
  sepia: 'bg-[#F4ECD8] text-[#433422]',
  solarized: 'bg-[#002b36] text-[#839496]',
  oled: 'bg-black text-white'
};

const themeAccents: Record<Theme, string> = {
  dark: 'text-amber-500',
  sepia: 'text-red-700',
  solarized: 'text-[#2aa198]',
  oled: 'text-zinc-400'
};

const themeBgAccent: Record<Theme, string> = {
  dark: 'bg-amber-500',
  sepia: 'bg-red-700',
  solarized: 'bg-[#2aa198]',
  oled: 'bg-zinc-200'
};

const themeBgAlt: Record<Theme, string> = {
  dark: 'bg-zinc-900',
  sepia: 'bg-[#E8DFCA]',
  solarized: 'bg-[#073642]',
  oled: 'bg-zinc-950'
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
  
  const timerRef = useRef<number | null>(null);
  const currentWordIndexRef = useRef(0);
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
  
  useEffect(() => {
    const loadData = async () => {
      const docWords = await storage.getDocumentWords(documentId);
      if (docWords) setWords(docWords);
      
      const docProgress = await storage.getDocumentProgress(documentId);
      setProgress(docProgress);
      currentWordIndexRef.current = docProgress.currentWordIndex;
      wpmRef.current = docProgress.wpm;

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

      setLoading(false);
    };
    loadData();
  }, [documentId]);

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

  const saveProgress = useCallback(() => {
    storage.updateDocumentProgress(documentId, {
      currentWordIndex: currentWordIndexRef.current,
      wpm: wpmRef.current
    });
  }, [documentId]);

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
      setProgress(p => ({ ...p, currentWordIndex: currentWordIndexRef.current }));

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
      const word = words[currentWordIndexRef.current];
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
      // User paused reading: check for hesitation or frequent pauses
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

  const updateWpm = (delta: number) => {
    focusStreakWordsRef.current = 0;
    wordsInCurrentPlaySessionRef.current = 0;
    const newWpm = Math.max(50, Math.min(1000, wpmRef.current + delta));
    wpmRef.current = newWpm;
    setProgress(p => ({ ...p, wpm: newWpm }));
    saveProgress();
  };

  const jumpWords = (delta: number) => {
    let newIndex = currentWordIndexRef.current + delta;
    newIndex = Math.max(0, Math.min(words.length - 1, newIndex));
    currentWordIndexRef.current = newIndex;
    setProgress(p => ({ ...p, currentWordIndex: newIndex }));

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
    setShowNav(true);
  };

  const jumpToNavIndex = () => {
    currentWordIndexRef.current = navPreviewIndex;
    setProgress(p => ({ ...p, currentWordIndex: navPreviewIndex }));
    setShowNav(false);
  };

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

  const openSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(false);
    setShowSettings(true);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

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

  return (
    <div className={cn("flex flex-col h-screen overflow-hidden select-none", themeClasses[theme])} onClick={togglePlay}>
      
      {/* Top Persistent Progress Indicator */}
      <div className={cn("w-full h-1 relative z-20 shrink-0", themeBgAlt[theme])}>
        <div 
          className={cn("h-full transition-all duration-150 ease-out", themeBgAccent[theme])} 
          style={{ width: `${progressPercent}%` }} 
        />
      </div>

      {/* Floating Speed Auto-Adjustment Notification */}
      {speedNotification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-3">
          <div className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-mono font-semibold shadow-lg backdrop-blur-md border",
            speedNotification.type === 'up'
              ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/40"
              : "bg-amber-950/90 text-amber-300 border-amber-500/40"
          )}>
            <Zap className={cn("w-3.5 h-3.5", speedNotification.type === 'up' ? "text-emerald-400 fill-emerald-400" : "text-amber-400 fill-amber-400")} />
            <span>{speedNotification.message}</span>
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
          onClick={onBack}
          className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-colors px-2 sm:px-3 py-2 -ml-2 sm:-ml-3 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium hidden sm:inline">Library</span>
        </button>
        
        <div className={cn("flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-current opacity-70 order-3 w-full sm:w-auto sm:order-none justify-center", themeBgAlt[theme])}>
          <button onClick={(e) => { e.stopPropagation(); updateWpm(-25); }} className="hover:opacity-100 p-1 opacity-70" title="Decrease speed (-25 WPM)">
            <Minus className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1.5 font-mono font-medium text-base sm:text-lg">
            <span>{progress.wpm}</span>
            <span className="text-xs opacity-50">WPM</span>
            {autoSpeedAdjustment && (
              <span 
                className="ml-1 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 flex items-center gap-0.5"
                title="Adaptive Speed is Active: speeds up during focus flow, slows down on pause/rewind"
              >
                <Zap className="w-2.5 h-2.5 fill-current" />
                AUTO
              </span>
            )}
          </div>

          <button onClick={(e) => { e.stopPropagation(); updateWpm(25); }} className="hover:opacity-100 p-1 opacity-70" title="Increase speed (+25 WPM)">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={openSettings}
            className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-colors px-2 sm:px-3 py-2 rounded-lg"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={openNav}
            className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-colors px-2 sm:px-3 py-2 -mr-2 sm:-mr-3 rounded-lg"
          >
            <span className="font-medium hidden sm:inline">Navigate</span>
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Reader Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative px-4">

        {/* Word Display with Context Words */}
        <div 
          className="flex flex-col items-center justify-center w-full transition-transform duration-200 origin-center select-none"
          style={{ transform: `scale(${fontSize / 100})` }}
        >
          {/* Previous Word (Larger font, lower opacity) */}
          {showContextWords && (
            <div className="font-mono text-sm sm:text-xl md:text-2xl lg:text-3xl opacity-20 h-8 sm:h-10 flex items-center justify-center text-center px-4 tracking-normal transition-opacity duration-150 pointer-events-none">
              {previousWordText || <span className="opacity-0">—</span>}
            </div>
          )}

          {/* Current RSVP Word */}
          <div className="flex items-baseline font-mono text-[8vw] md:text-7xl lg:text-8xl w-full my-4 sm:my-6">
            {/* Prefix (right-aligned) */}
            <div className="flex-1 text-right opacity-80">
              {formattedWord.prefix}
            </div>
            {/* ORP (highlighted) */}
            <div className={cn("font-bold relative shrink-0", themeAccents[theme])}>
              {/* Crosshair indicator lines (positioned with safe margin to avoid overlapping characters and context words) */}
              <div className="absolute -top-3.5 sm:-top-4.5 left-1/2 -translate-x-1/2 w-0.5 h-2 sm:h-2.5 bg-current opacity-40 rounded-full pointer-events-none"></div>
              <div className="absolute -bottom-3.5 sm:-bottom-4.5 left-1/2 -translate-x-1/2 w-0.5 h-2 sm:h-2.5 bg-current opacity-40 rounded-full pointer-events-none"></div>
              
              {formattedWord.orp}
            </div>
            {/* Suffix (left-aligned) */}
            <div className="flex-1 text-left opacity-80">
              {formattedWord.suffix}
            </div>
          </div>

          {/* Next Word (Larger font, lower opacity) */}
          {showContextWords && (
            <div className="font-mono text-sm sm:text-xl md:text-2xl lg:text-3xl opacity-20 h-8 sm:h-10 flex items-center justify-center text-center px-4 tracking-normal transition-opacity duration-150 pointer-events-none">
              {nextWordText || <span className="opacity-0">—</span>}
            </div>
          )}
        </div>
      </div>

      {/* Visual Progress Bar & Tracking Info */}
      <div 
        className={cn(
          "w-full max-w-xl mx-auto px-6 transition-opacity duration-300 z-10",
          isPlaying ? "opacity-35 hover:opacity-100" : "opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress labels */}
        <div className="flex items-center justify-between text-xs sm:text-sm font-mono opacity-80 mb-2 select-none">
          <span className="font-medium">
            Word <span className={cn("font-bold", themeAccents[theme])}>{currentWordDisplayNum.toLocaleString()}</span> of {words.length.toLocaleString()}
          </span>
          <span className="font-bold px-2 py-0.5 rounded bg-current/10">
            {Math.round(progressPercent)}%
          </span>
          <span>
            {wordsLeft === 0 ? 'Finished' : `~${minutesLeft} min left`}
          </span>
        </div>

        {/* Interactive Progress Track */}
        <div 
          className={cn(
            "group relative h-2.5 sm:h-3 rounded-full cursor-pointer transition-all hover:h-4 flex items-center shadow-inner",
            themeBgAlt[theme]
          )}
          onClick={handleProgressSeek}
          title="Click to jump to this point in document"
        >
          {/* Progress fill */}
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-150 ease-out relative",
              themeBgAccent[theme]
            )}
            style={{ width: `${progressPercent}%` }}
          >
            {/* Scrubber thumb */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-md border-2 border-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div 
        className={cn(
          "p-4 sm:p-6 flex justify-center items-center gap-6 sm:gap-8 transition-opacity duration-300",
          isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={() => jumpWords(-10)}
          className={cn("transition-colors p-3 rounded-full opacity-60 hover:opacity-100", themeBgAlt[theme])}
        >
          <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>

        <button 
          onClick={togglePlay}
          className={cn("w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 text-current", themeBgAlt[theme], "brightness-125")}
        >
          {isPlaying ? <Pause className="w-6 h-6 sm:w-8 sm:h-8 fill-current" /> : <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-current ml-1" />}
        </button>

        <button 
          onClick={() => jumpWords(10)}
          className={cn("transition-colors p-3 rounded-full opacity-60 hover:opacity-100", themeBgAlt[theme])}
        >
          <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>
      </div>
      
      {/* Navigation Modal */}
      {showNav && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-4 md:p-12 animate-in fade-in"
          onClick={(e) => { e.stopPropagation(); setShowNav(false); }}
        >
          <div 
            className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl sm:rounded-3xl w-full max-w-6xl mx-auto h-full overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-zinc-900">
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-100">Navigate Text</h2>
              <button 
                onClick={() => setShowNav(false)}
                className="p-2 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              
              {/* TOC Sidebar */}
              <div className="hidden md:flex w-64 border-r border-zinc-900 bg-zinc-950/50 flex-col p-4 overflow-y-auto">
                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 px-2">Summary</h3>
                <div className="flex flex-col gap-1">
                  {toc.map((item, i) => {
                    const isActive = navPreviewIndex >= item.index && (i === toc.length - 1 || navPreviewIndex < toc[i+1].index);
                    return (
                      <button 
                        key={i}
                        onClick={() => setNavPreviewIndex(item.index)}
                        className={cn(
                          "text-left px-3 py-2 rounded-lg text-sm transition-colors", 
                          isActive ? "bg-amber-500/10 text-amber-500 font-medium" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                        )}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right side Text Preview & Scrubber */}
              <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden">
                <div className="mb-4 sm:mb-6 flex flex-col gap-2">
                  <div className="flex justify-between text-sm font-mono text-zinc-500">
                    <span>0%</span>
                    <span className="text-amber-500 font-bold">{Math.round((navPreviewIndex / Math.max(1, words.length - 1)) * 100)}%</span>
                    <span>100%</span>
                  </div>
                  <input 
                    type="range" 
                    min={0} 
                    max={Math.max(0, words.length - 1)} 
                    value={navPreviewIndex} 
                    onChange={(e) => setNavPreviewIndex(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer h-2 bg-zinc-800 rounded-lg appearance-none"
                  />
                  <div className="text-center text-xs text-zinc-600 mt-1 font-mono">
                    Word {navPreviewIndex.toLocaleString()} of {words.length.toLocaleString()}
                  </div>
                </div>

                <div className="flex-1 bg-zinc-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 overflow-y-auto text-base sm:text-lg leading-relaxed text-zinc-400 border border-zinc-800/50 shadow-inner">
                  {(() => {
                    const startIdx = Math.max(0, navPreviewIndex - 100);
                    const endIdx = Math.min(words.length, navPreviewIndex + 300);
                    const previewWords = words.slice(startIdx, endIdx);
                    
                    return (
                      <>
                        {startIdx > 0 && <span className="text-zinc-600 mr-2">...</span>}
                        {previewWords.map((word, i) => {
                          const actualIndex = startIdx + i;
                          const isSelected = actualIndex === navPreviewIndex;
                          return (
                            <span 
                              key={actualIndex}
                              onClick={() => setNavPreviewIndex(actualIndex)}
                              onDoubleClick={() => {
                                setNavPreviewIndex(actualIndex);
                                setTimeout(jumpToNavIndex, 0);
                              }}
                              className={cn(
                                "cursor-pointer transition-colors duration-100", 
                                isSelected 
                                  ? "text-amber-500 font-bold bg-amber-500/20 px-1 rounded-sm mx-0.5" 
                                  : "hover:text-zinc-200 hover:bg-zinc-800 rounded-sm"
                              )}
                            >
                              {word}{' '}
                            </span>
                          );
                        })}
                        {endIdx < words.length && <span className="text-zinc-600 ml-2">...</span>}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-zinc-900 bg-zinc-950 flex justify-end">
              <button 
                onClick={jumpToNavIndex}
                className="px-6 py-3 sm:px-8 bg-amber-600 hover:bg-amber-500 text-amber-50 rounded-xl font-bold transition-transform active:scale-95 shadow-lg w-full sm:w-auto text-center"
              >
                Jump to this point
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={(e) => { e.stopPropagation(); setShowSettings(false); }}
        >
          <div 
            className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl sm:rounded-3xl w-full max-w-md mx-auto overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-zinc-900">
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-100">Settings</h2>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-2 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Reading Theme</h3>
              <div className="grid grid-cols-2 gap-3 mb-8">
                <button
                  onClick={() => updateTheme('dark')}
                  className={cn(
                    "flex flex-col items-center p-4 rounded-xl border-2 transition-all",
                    theme === 'dark' ? "border-amber-500 bg-amber-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                  )}
                >
                  <div className="w-full h-12 bg-zinc-950 rounded-md border border-zinc-800 flex items-center justify-center mb-3">
                    <span className="text-zinc-100 font-mono text-xl"><span className="opacity-50">T</span><span className="text-amber-500 font-bold">h</span><span className="opacity-50">e</span></span>
                  </div>
                  <span className="text-zinc-100 font-medium">Dark</span>
                </button>
                
                <button
                  onClick={() => updateTheme('sepia')}
                  className={cn(
                    "flex flex-col items-center p-4 rounded-xl border-2 transition-all",
                    theme === 'sepia' ? "border-amber-500 bg-amber-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                  )}
                >
                  <div className="w-full h-12 bg-[#F4ECD8] rounded-md border border-[#E8DFCA] flex items-center justify-center mb-3">
                    <span className="text-[#433422] font-mono text-xl"><span className="opacity-50">T</span><span className="text-red-700 font-bold">h</span><span className="opacity-50">e</span></span>
                  </div>
                  <span className="text-zinc-100 font-medium">Sepia</span>
                </button>

                <button
                  onClick={() => updateTheme('solarized')}
                  className={cn(
                    "flex flex-col items-center p-4 rounded-xl border-2 transition-all",
                    theme === 'solarized' ? "border-amber-500 bg-amber-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                  )}
                >
                  <div className="w-full h-12 bg-[#002b36] rounded-md border border-[#073642] flex items-center justify-center mb-3">
                    <span className="text-[#839496] font-mono text-xl"><span className="opacity-50">T</span><span className="text-[#2aa198] font-bold">h</span><span className="opacity-50">e</span></span>
                  </div>
                  <span className="text-zinc-100 font-medium">Solarized</span>
                </button>

                <button
                  onClick={() => updateTheme('oled')}
                  className={cn(
                    "flex flex-col items-center p-4 rounded-xl border-2 transition-all",
                    theme === 'oled' ? "border-amber-500 bg-amber-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                  )}
                >
                  <div className="w-full h-12 bg-black rounded-md border border-zinc-900 flex items-center justify-center mb-3">
                    <span className="text-white font-mono text-xl"><span className="opacity-50">T</span><span className="text-zinc-400 font-bold">h</span><span className="opacity-50">e</span></span>
                  </div>
                  <span className="text-zinc-100 font-medium">OLED Black</span>
                </button>
              </div>

              <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Text Size</h3>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-8">
                <div className="flex items-center justify-between text-zinc-400 mb-4">
                  <span className="text-sm">Smaller</span>
                  <span className="font-mono text-amber-500 font-bold">{fontSize}%</span>
                  <span className="text-lg font-bold">Larger</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="150" 
                  step="5"
                  value={fontSize}
                  onChange={(e) => updateFontSize(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-2 bg-zinc-800 rounded-lg appearance-none"
                />
              </div>

              <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Reading Context</h3>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between mb-8">
                <div className="flex flex-col pr-4">
                  <span className="text-zinc-100 font-medium text-sm sm:text-base">Show Previous & Next Word</span>
                  <span className="text-xs text-zinc-500 mt-0.5">Display adjacent words in smaller font and reduced opacity</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateShowContextWords(!showContextWords)}
                  className={cn(
                    "w-12 h-6 shrink-0 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer",
                    showContextWords ? "bg-amber-600 justify-end" : "bg-zinc-800 justify-start"
                  )}
                  aria-label="Toggle context words"
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                </button>
              </div>

              <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Adaptive Speed (Auto WPM)</h3>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex flex-col pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-100 font-medium text-sm sm:text-base">Auto-Adjust Speed</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5 fill-current" />
                      Smart
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500 mt-1">
                    Subtly accelerates (+5 WPM) during continuous focus streaks and dials back (-10 WPM) on pauses or rewinds.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => updateAutoSpeedAdjustment(!autoSpeedAdjustment)}
                  className={cn(
                    "w-12 h-6 shrink-0 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer",
                    autoSpeedAdjustment ? "bg-amber-600 justify-end" : "bg-zinc-800 justify-start"
                  )}
                  aria-label="Toggle auto speed adjustment"
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
