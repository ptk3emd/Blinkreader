import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Play, Pause, List, ChevronLeft, ChevronRight, Minus, Plus, X, Settings } from 'lucide-react';
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
  
  const timerRef = useRef<number | null>(null);
  const currentWordIndexRef = useRef(0);
  const wpmRef = useRef(300);
  const isPlayingRef = useRef(false);
  
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  
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
  }, [words]);

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

  const togglePlay = () => setIsPlaying(!isPlaying);

  const updateWpm = (delta: number) => {
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

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    storage.updateSettings({ theme: newTheme });
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
  const formattedWord = formatRSVPWord(currentWord);
  const progressPercent = words.length > 0 ? (progress.currentWordIndex / (words.length - 1)) * 100 : 0;

  return (
    <div className={cn("flex flex-col h-screen overflow-hidden", themeClasses[theme])} onClick={togglePlay}>
      
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
        
        <div className={cn("flex items-center gap-3 sm:gap-6 px-4 py-2 rounded-full border border-current opacity-70 order-3 w-full sm:w-auto sm:order-none justify-center", themeBgAlt[theme])}>
          <button onClick={(e) => { e.stopPropagation(); updateWpm(-25); }} className="hover:opacity-100 p-1 opacity-70">
            <Minus className="w-4 h-4" />
          </button>
          <div className="font-mono font-medium text-lg w-20 text-center">
            {progress.wpm} <span className="text-xs opacity-50">WPM</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); updateWpm(25); }} className="hover:opacity-100 p-1 opacity-70">
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
        
        {/* Progress Bar (Subtle) */}
        <div className={cn("absolute top-0 left-0 w-full h-1", themeBgAlt[theme])}>
          <div 
            className={cn("h-full transition-all duration-300 ease-out opacity-50", themeBgAlt[theme], "brightness-150")} 
            style={{ width: `${progressPercent}%`, backgroundColor: 'currentColor' }} 
          />
        </div>

        {/* Word Display */}
        <div className="flex items-baseline font-mono text-[8vw] md:text-7xl lg:text-8xl w-full">
          {/* Prefix (right-aligned) */}
          <div className="flex-1 text-right opacity-80">
            {formattedWord.prefix}
          </div>
          {/* ORP (highlighted) */}
          <div className={cn("font-bold relative", themeAccents[theme])}>
            {/* Crosshair indicator lines */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-px h-4 bg-current opacity-30"></div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-px h-4 bg-current opacity-30"></div>
            
            {formattedWord.orp}
          </div>
          {/* Suffix (left-aligned) */}
          <div className="flex-1 text-left opacity-80">
            {formattedWord.suffix}
          </div>
        </div>

        {/* Context hints (optional, can be faded out if playing) */}
        {!isPlaying && (
          <div className="absolute bottom-24 sm:bottom-32 flex gap-4 sm:gap-12 font-mono text-sm sm:text-xl pointer-events-none opacity-40 px-4 w-full justify-center">
            <div className="opacity-50 hidden sm:block">{words[progress.currentWordIndex - 2] || ''}</div>
            <div className="opacity-75 truncate max-w-[80px] sm:max-w-none text-right">{words[progress.currentWordIndex - 1] || ''}</div>
            <div className="w-8 sm:w-32 text-center shrink-0">—</div>
            <div className="opacity-75 truncate max-w-[80px] sm:max-w-none text-left">{words[progress.currentWordIndex + 1] || ''}</div>
            <div className="opacity-50 hidden sm:block">{words[progress.currentWordIndex + 2] || ''}</div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div 
        className={cn(
          "p-4 sm:p-8 flex justify-center items-center gap-6 sm:gap-8 transition-opacity duration-300",
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
              <div className="grid grid-cols-2 gap-3">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
