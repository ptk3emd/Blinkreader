import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  Columns2, Rows2, X, ZoomIn, ZoomOut, Compass, 
  ChevronUp, ChevronDown, Sparkles 
} from 'lucide-react';
import { Theme } from '../lib/storage';
import { ParagraphData, findParagraphIndex } from '../lib/paragraph';
import { cn } from '../lib/utils';

interface ParagraphSplitViewProps {
  paragraphs: ParagraphData[];
  currentWordIndex: number;
  theme: Theme;
  onWordClick: (index: number) => void;
  onClose: () => void;
  isPlaying: boolean;
}

const themeBorder: Record<Theme, string> = {
  dark: 'border-[#33333c]',
  sepia: 'border-[#33333c]',
  solarized: 'border-[#35325f]',
  oled: 'border-[#282830]',
};

const themeActiveHighlight: Record<Theme, {
  bg: string;
  text: string;
  ring: string;
  glow: string;
}> = {
  dark: {
    bg: 'bg-[#FCFD76]',
    text: 'text-[#18181c]',
    ring: 'ring-[#FCFD76]/70',
    glow: 'shadow-[0_0_12px_rgba(252,253,118,0.55)]',
  },
  sepia: {
    bg: 'bg-[#F8B7A2]',
    text: 'text-[#1e1713]',
    ring: 'ring-[#F8B7A2]/70',
    glow: 'shadow-[0_0_12px_rgba(248,183,162,0.5)]',
  },
  solarized: {
    bg: 'bg-[#c5c5ef]',
    text: 'text-[#191928]',
    ring: 'ring-[#c5c5ef]/70',
    glow: 'shadow-[0_0_12px_rgba(197,197,239,0.5)]',
  },
  oled: {
    bg: 'bg-[#FCFD76]',
    text: 'text-[#0a0a0c]',
    ring: 'ring-[#FCFD76]/80',
    glow: 'shadow-[0_0_14px_rgba(252,253,118,0.7)]',
  },
};

export default function ParagraphSplitView({
  paragraphs,
  currentWordIndex,
  theme,
  onWordClick,
  onClose,
  isPlaying,
}: ParagraphSplitViewProps) {
  const [fontSize, setFontSize] = useState<number>(16);
  const [showFullDocument, setShowFullDocument] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordElementRef = useRef<HTMLSpanElement | null>(null);

  // Find active paragraph
  const currentParaIndex = useMemo(() => {
    return findParagraphIndex(paragraphs, currentWordIndex);
  }, [paragraphs, currentWordIndex]);

  const activeParagraph = paragraphs[currentParaIndex];

  // Calculate paragraph progress
  const paraProgress = useMemo(() => {
    if (!activeParagraph) return { current: 1, total: 1, percent: 0 };
    const paraLength = activeParagraph.words.length || 1;
    const offset = Math.max(0, currentWordIndex - activeParagraph.startIndex);
    const current = Math.min(paraLength, offset + 1);
    const percent = Math.min(100, Math.round((current / paraLength) * 100));
    return { current, total: paraLength, percent };
  }, [activeParagraph, currentWordIndex]);

  // Keep active word centered in view
  useEffect(() => {
    if (!autoScroll || !activeWordElementRef.current || !containerRef.current) return;
    
    // Smoothly scroll active word into viewport
    activeWordElementRef.current.scrollIntoView({
      behavior: isPlaying ? 'smooth' : 'auto',
      block: 'center',
      inline: 'nearest',
    });
  }, [currentWordIndex, autoScroll, isPlaying]);

  // Which paragraphs to render
  const visibleParagraphs = useMemo(() => {
    if (showFullDocument) {
      return paragraphs;
    }
    // Contextual mode: previous 1, current, next 2
    const start = Math.max(0, currentParaIndex - 1);
    const end = Math.min(paragraphs.length, currentParaIndex + 3);
    return paragraphs.slice(start, end);
  }, [paragraphs, currentParaIndex, showFullDocument]);

  const highlightStyle = themeActiveHighlight[theme];

  return (
    <div 
      className={cn(
        "flex flex-col h-full w-full bg-[#1b1b20]/95 backdrop-blur-md border rounded-[20px] overflow-hidden shadow-2xl transition-all duration-300",
        themeBorder[theme]
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Split View Header */}
      <div className="flex items-center justify-between px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-[#33333c] bg-[#16161a] shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-[9px] bg-[#35325f] text-[#c5c5ef]">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#e8e8ec]">Acompanhamento de Parágrafo</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[6px] bg-[#222228] border border-[#33333c] text-[#FCFD76] font-semibold">
                {currentParaIndex + 1}/{paragraphs.length}
              </span>
            </div>
            <p className="text-[11px] text-[#9a9aa3] font-mono">
              Palavra {paraProgress.current} de {paraProgress.total} ({paraProgress.percent}%)
            </p>
          </div>
        </div>

        {/* Toolbar buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Font size adjustment */}
          <button
            type="button"
            onClick={() => setFontSize(s => Math.max(13, s - 1))}
            className="p-1.5 text-[#9a9aa3] hover:text-[#e8e8ec] hover:bg-[#2a2a32] rounded-[8px] border border-[#33333c] transition-colors cursor-pointer"
            title="Diminuir tamanho do texto"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] font-mono text-[#9a9aa3] px-1 hidden sm:inline">
            {fontSize}px
          </span>

          <button
            type="button"
            onClick={() => setFontSize(s => Math.min(26, s + 1))}
            className="p-1.5 text-[#9a9aa3] hover:text-[#e8e8ec] hover:bg-[#2a2a32] rounded-[8px] border border-[#33333c] transition-colors cursor-pointer"
            title="Aumentar tamanho do texto"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Context vs Full toggle */}
          <button
            type="button"
            onClick={() => setShowFullDocument(prev => !prev)}
            className={cn(
              "px-2 py-1 text-[11px] font-semibold rounded-[8px] border transition-colors cursor-pointer ml-1 hidden xs:inline-flex items-center gap-1",
              showFullDocument 
                ? "bg-[#35325f] text-[#c5c5ef] border-[#504a8a]" 
                : "text-[#9a9aa3] hover:text-[#e8e8ec] bg-[#222228] border-[#33333c]"
            )}
            title={showFullDocument ? "Mostrar parágrafos contextuais" : "Mostrar todo o texto"}
          >
            {showFullDocument ? "Texto Completo" : "Contextual"}
          </button>

          {/* Auto-scroll re-center button */}
          <button
            type="button"
            onClick={() => {
              setAutoScroll(true);
              activeWordElementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className={cn(
              "p-1.5 rounded-[8px] border transition-colors cursor-pointer",
              autoScroll
                ? "bg-[#28342b] text-[#5fa777] border-[#5fa777]/40"
                : "text-[#9a9aa3] hover:text-[#e8e8ec] bg-[#222228] border-[#33333c]"
            )}
            title="Centralizar automaticamente na palavra em leitura"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#9a9aa3] hover:text-[#e8e8ec] hover:bg-[#2a2a32] rounded-[8px] border border-[#33333c] transition-colors cursor-pointer ml-1"
            title="Fechar visão dividida"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Paragraphs Scroll Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 select-text leading-relaxed transition-all"
        style={{ fontSize: `${fontSize}px` }}
      >
        {visibleParagraphs.map((para) => {
          const isCurrentPara = para.id === currentParaIndex;
          const isPreviousPara = para.id < currentParaIndex;

          return (
            <div
              key={para.id}
              className={cn(
                "p-3.5 sm:p-4 rounded-[16px] transition-all duration-300 relative border",
                isCurrentPara 
                  ? "bg-[#18181c] border-[#504a8a]/70 shadow-lg ring-1 ring-[#504a8a]/30" 
                  : isPreviousPara
                  ? "bg-[#141417]/60 border-[#282830] opacity-45 hover:opacity-80"
                  : "bg-[#141417]/70 border-[#282830] opacity-55 hover:opacity-90"
              )}
            >
              {/* Paragraph Number Badge */}
              <div className="flex items-center justify-between mb-2">
                <span className={cn(
                  "text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-[6px]",
                  isCurrentPara 
                    ? "bg-[#35325f] text-[#c5c5ef]" 
                    : "bg-[#1e1e24] text-[#9a9aa3]"
                )}>
                  Parágrafo {para.id + 1}
                </span>

                {isCurrentPara && (
                  <span className="text-[10px] text-[#FCFD76] font-mono font-bold flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FCFD76]" />
                    Leitura ativa
                  </span>
                )}
              </div>

              {/* Paragraph Text with Words */}
              <p className="leading-relaxed font-sans text-[#c2c2c9]">
                {para.words.map((word, wordOffset) => {
                  const absoluteWordIndex = para.startIndex + wordOffset;
                  const isActiveWord = absoluteWordIndex === currentWordIndex;
                  const isReadWord = isCurrentPara && absoluteWordIndex < currentWordIndex;

                  return (
                    <span
                      key={absoluteWordIndex}
                      ref={isActiveWord ? activeWordElementRef : null}
                      onClick={() => onWordClick(absoluteWordIndex)}
                      className={cn(
                        "inline-block rounded-[5px] px-1 py-0.5 mx-0.5 cursor-pointer transition-all duration-150 relative",
                        isActiveWord
                          ? cn(
                              "font-bold scale-110 z-10",
                              highlightStyle.bg,
                              highlightStyle.text,
                              highlightStyle.ring,
                              highlightStyle.glow,
                              "ring-2 ring-offset-1 ring-offset-[#18181c]"
                            )
                          : isReadWord
                          ? "text-[#8a8a95] opacity-75 hover:opacity-100 hover:text-[#e8e8ec] hover:bg-[#2a2a32]"
                          : "hover:text-[#FCFD76] hover:bg-[#2a2a32] text-[#e8e8ec]"
                      )}
                      title={`Palavra ${(absoluteWordIndex + 1).toLocaleString()} • Clique para saltar`}
                    >
                      {word}
                      {/* Active Indicator Arrow */}
                      {isActiveWord && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-[#FCFD76] pointer-events-none animate-bounce" />
                      )}
                    </span>
                  );
                })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
