import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  X, Minus, Plus, Compass, AlignLeft, FileText
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

const themeActiveHighlight: Record<Theme, {
  bg: string;
  text: string;
  ring: string;
  glow: string;
}> = {
  dark: {
    bg: 'bg-[#FCFD76]',
    text: 'text-[#18181c]',
    ring: 'ring-[#FCFD76]/60',
    glow: 'shadow-[0_0_8px_rgba(252,253,118,0.4)]',
  },
  sepia: {
    bg: 'bg-[#F8B7A2]',
    text: 'text-[#1e1713]',
    ring: 'ring-[#F8B7A2]/60',
    glow: 'shadow-[0_0_8px_rgba(248,183,162,0.35)]',
  },
  solarized: {
    bg: 'bg-[#c5c5ef]',
    text: 'text-[#191928]',
    ring: 'ring-[#c5c5ef]/60',
    glow: 'shadow-[0_0_8px_rgba(197,197,239,0.35)]',
  },
  oled: {
    bg: 'bg-[#FCFD76]',
    text: 'text-[#0a0a0c]',
    ring: 'ring-[#FCFD76]/70',
    glow: 'shadow-[0_0_10px_rgba(252,253,118,0.5)]',
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

  // Keep active word centered in view
  useEffect(() => {
    if (!autoScroll || !activeWordElementRef.current || !containerRef.current) return;
    
    activeWordElementRef.current.scrollIntoView({
      behavior: isPlaying ? 'smooth' : 'auto',
      block: 'center',
      inline: 'nearest',
    });
  }, [currentWordIndex, autoScroll, isPlaying]);

  // Visible paragraphs based on mode
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
      className="flex flex-col h-full w-full bg-[#18181c]/90 backdrop-blur-sm border border-[#2c2c34] rounded-[16px] overflow-hidden transition-all"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Clean, Minimalist Toolbar Header - No heavy titles or icons */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#282830] bg-[#141417]/80 shrink-0">
        {/* Subtle status dot and mode switch */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowFullDocument(prev => !prev)}
            className={cn(
              "px-2 py-1 text-[11px] font-mono rounded-[6px] border transition-colors cursor-pointer flex items-center gap-1.5",
              showFullDocument 
                ? "bg-[#282832] text-[#e8e8ec] border-[#40404c]" 
                : "text-[#8a8a95] hover:text-[#e8e8ec] bg-transparent border-transparent hover:bg-[#222228]"
            )}
            title={showFullDocument ? "Alternar para Parágrafos Contextuais" : "Alternar para Documento Completo"}
          >
            {showFullDocument ? (
              <>
                <FileText className="w-3 h-3 text-[#FCFD76]" />
                <span>Completo</span>
              </>
            ) : (
              <>
                <AlignLeft className="w-3 h-3 text-[#c5c5ef]" />
                <span>Contexto</span>
              </>
            )}
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {/* Font Size Out */}
          <button
            type="button"
            onClick={() => setFontSize(s => Math.max(13, s - 1))}
            className="p-1 text-[#8a8a95] hover:text-[#e8e8ec] hover:bg-[#26262e] rounded-[6px] transition-colors cursor-pointer"
            title="Diminuir texto"
            aria-label="Diminuir texto"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <span className="text-[10px] font-mono text-[#7a7a85] px-0.5 select-none">
            {fontSize}px
          </span>

          {/* Font Size In */}
          <button
            type="button"
            onClick={() => setFontSize(s => Math.min(24, s + 1))}
            className="p-1 text-[#8a8a95] hover:text-[#e8e8ec] hover:bg-[#26262e] rounded-[6px] transition-colors cursor-pointer"
            title="Aumentar texto"
            aria-label="Aumentar texto"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3.5 bg-[#2c2c34] mx-0.5" />

          {/* Auto-scroll re-center */}
          <button
            type="button"
            onClick={() => {
              setAutoScroll(true);
              activeWordElementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className={cn(
              "p-1 rounded-[6px] transition-colors cursor-pointer",
              autoScroll
                ? "text-[#5fa777] hover:bg-[#222a24]"
                : "text-[#8a8a95] hover:text-[#e8e8ec] hover:bg-[#26262e]"
            )}
            title="Centralizar na leitura atual"
            aria-label="Centralizar na leitura atual"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>

          {/* Close split */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#8a8a95] hover:text-[#e8e8ec] hover:bg-[#26262e] rounded-[6px] transition-colors cursor-pointer ml-0.5"
            title="Fechar split view (V)"
            aria-label="Fechar split view"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Paragraphs Text Container - Clean, focused on readability */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 select-text leading-relaxed transition-all"
        style={{ fontSize: `${fontSize}px` }}
      >
        {visibleParagraphs.map((para) => {
          const isCurrentPara = para.id === currentParaIndex;
          const isPreviousPara = para.id < currentParaIndex;

          return (
            <div
              key={para.id}
              className={cn(
                "p-3 rounded-[12px] transition-all duration-200 relative",
                isCurrentPara 
                  ? "bg-[#1f1f26]/90 border-l-2 border-l-[#FCFD76] border-y border-r border-[#2d2d38]" 
                  : isPreviousPara
                  ? "opacity-50 hover:opacity-85"
                  : "opacity-60 hover:opacity-90"
              )}
            >
              <p className="leading-relaxed font-sans text-[#d4d4dc]">
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
                        "inline-block rounded-[4px] px-1 py-0.5 mx-0.5 cursor-pointer transition-all duration-100",
                        isActiveWord
                          ? cn(
                              "font-bold scale-105 z-10",
                              highlightStyle.bg,
                              highlightStyle.text,
                              highlightStyle.ring,
                              highlightStyle.glow,
                              "ring-1 ring-offset-1 ring-offset-[#18181c]"
                            )
                          : isReadWord
                          ? "text-[#82828e] opacity-80 hover:opacity-100 hover:text-[#e8e8ec] hover:bg-[#282832]"
                          : "text-[#d8d8e0] hover:text-[#FCFD76] hover:bg-[#282832]"
                      )}
                      title={`Palavra ${(absoluteWordIndex + 1).toLocaleString()} • Clique para saltar`}
                    >
                      {word}
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
