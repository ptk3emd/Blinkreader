import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, TrendingUp, Bookmark as BookmarkIcon, 
  Search, X, Trash2, Edit3, Check, Play, BookOpen, 
  Clock, FileText, File as FileIcon, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { storage, DocumentBookmarkItem, DocumentMeta } from '../lib/storage';
import { cn } from '../lib/utils';

interface DashboardProps {
  onBack: () => void;
  onOpenDocument?: (docId: string, wordIndex?: number) => void;
  initialTab?: 'metrics' | 'bookmarks';
}

interface ChartData {
  date: string;
  wpm: number;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatFullDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function Dashboard({ onBack, onOpenDocument, initialTab = 'metrics' }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'metrics' | 'bookmarks'>(initialTab);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [averageWpm, setAverageWpm] = useState<number>(0);
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [bookmarks, setBookmarks] = useState<DocumentBookmarkItem[]>([]);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Bookmarks filter & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDocId, setSelectedDocId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'position'>('recent');
  
  // Note editing state
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(curr => (curr === msg ? null : curr));
    }, 2800);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. WPM History
      const history = await storage.getWpmHistory();
      setTotalSessions(history.length);
      
      const grouped = history.reduce((acc, curr) => {
        const dateStr = new Date(curr.timestamp).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
        if (!acc[dateStr]) {
          acc[dateStr] = { sum: 0, count: 0 };
        }
        acc[dateStr].sum += curr.wpm;
        acc[dateStr].count += 1;
        return acc;
      }, {} as Record<string, { sum: number; count: number }>);

      const parsedChartData: ChartData[] = Object.entries(grouped).map(([date, { sum, count }]) => ({
        date,
        wpm: Math.round(sum / count)
      }));
      setChartData(parsedChartData);

      if (history.length > 0) {
        const totalWpm = history.reduce((sum, entry) => sum + entry.wpm, 0);
        setAverageWpm(Math.round(totalWpm / history.length));
      }

      // 2. Documents & All Bookmarks
      const docs = await storage.getDocuments();
      setDocuments(docs);
      const allBookmarks = await storage.getAllBookmarks();
      setBookmarks(allBookmarks);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filter and Sort bookmarks
  const filteredBookmarks = useMemo(() => {
    return bookmarks
      .filter((item) => {
        if (selectedDocId !== 'all' && item.documentId !== selectedDocId) {
          return false;
        }
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const matchTitle = item.documentTitle.toLowerCase().includes(q);
        const matchSnippet = item.bookmark.snippet.toLowerCase().includes(q);
        const matchNote = item.bookmark.note ? item.bookmark.note.toLowerCase().includes(q) : false;
        return matchTitle || matchSnippet || matchNote;
      })
      .sort((a, b) => {
        if (sortBy === 'recent') {
          return b.bookmark.timestamp - a.bookmark.timestamp;
        }
        if (sortBy === 'oldest') {
          return a.bookmark.timestamp - b.bookmark.timestamp;
        }
        if (sortBy === 'position') {
          // Sort by document name first, then word index
          if (a.documentTitle !== b.documentTitle) {
            return a.documentTitle.localeCompare(b.documentTitle);
          }
          return a.bookmark.wordIndex - b.bookmark.wordIndex;
        }
        return 0;
      });
  }, [bookmarks, selectedDocId, searchQuery, sortBy]);

  // Unique documents with bookmarks
  const docsWithBookmarksCount = useMemo(() => {
    const ids = new Set(bookmarks.map(b => b.documentId));
    return ids.size;
  }, [bookmarks]);

  const bookmarksWithNotesCount = useMemo(() => {
    return bookmarks.filter(b => !!b.bookmark.note?.trim()).length;
  }, [bookmarks]);

  // Actions on bookmarks
  const handleDeleteBookmark = async (docId: string, bookmarkId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await storage.removeBookmark(docId, bookmarkId);
      setBookmarks(prev => prev.filter(b => b.bookmark.id !== bookmarkId));
      showToast('Marcador excluído');
    } catch (err) {
      console.error('Failed to delete bookmark:', err);
    }
  };

  const startEditNote = (bookmark: DocumentBookmarkItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingBookmarkId(bookmark.bookmark.id);
    setNoteDraft(bookmark.bookmark.note || '');
  };

  const handleSaveNote = async (docId: string, bookmarkId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await storage.updateBookmarkNote(docId, bookmarkId, noteDraft.trim());
      setBookmarks(prev => prev.map(b => {
        if (b.bookmark.id === bookmarkId) {
          return {
            ...b,
            bookmark: {
              ...b.bookmark,
              note: noteDraft.trim() || undefined
            }
          };
        }
        return b;
      }));
      setEditingBookmarkId(null);
      setNoteDraft('');
      showToast('Anotação salva com sucesso');
    } catch (err) {
      console.error('Failed to update bookmark note:', err);
    }
  };

  const handleOpenBookmark = (docId: string, wordIndex: number) => {
    if (onOpenDocument) {
      onOpenDocument(docId, wordIndex);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#18181c] border border-[#33333c] p-3 rounded-[12px] shadow-xl">
          <p className="text-[#9a9aa3] text-xs mb-1 font-mono">{label}</p>
          <p className="text-[#FCFD76] font-bold font-mono text-sm">
            {payload[0].value} <span className="text-xs text-[#9a9aa3] font-sans">WPM</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-[#9a9aa3]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#FCFD76] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Carregando painel...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 md:p-12 w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#222228] border border-[#FCFD76]/50 text-[#e8e8ec] px-4 py-2.5 rounded-[12px] shadow-xl flex items-center gap-2 animate-in fade-in duration-200 text-sm">
          <Sparkles className="w-4 h-4 text-[#FCFD76]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-[#33333c]">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2.5 text-[#9a9aa3] hover:text-[#e8e8ec] hover:bg-[#2a2a32] rounded-[12px] border border-[#33333c] transition-all cursor-pointer shadow-none"
            title="Voltar para a biblioteca"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#9a9aa3]">
                Painel do Leitor
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-[#e8e8ec]">
              {activeTab === 'metrics' ? 'Histórico & Desempenho' : 'Marcadores & Timestamps'}
            </h1>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-[#222228] p-1.5 rounded-[14px] border border-[#33333c] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('metrics')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-[10px] text-xs sm:text-sm font-bold transition-all cursor-pointer",
              activeTab === 'metrics'
                ? "bg-[#35325f] text-[#c5c5ef] shadow-[0_0_12px_rgba(80,74,138,0.3)]"
                : "text-[#9a9aa3] hover:text-[#e8e8ec]"
            )}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Métricas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bookmarks')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-[10px] text-xs sm:text-sm font-bold transition-all cursor-pointer",
              activeTab === 'bookmarks'
                ? "bg-[#35325f] text-[#c5c5ef] shadow-[0_0_12px_rgba(80,74,138,0.3)]"
                : "text-[#9a9aa3] hover:text-[#e8e8ec]"
            )}
          >
            <BookmarkIcon className="w-4 h-4" />
            <span>Marcadores</span>
            {bookmarks.length > 0 && (
              <span className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded-full",
                activeTab === 'bookmarks' 
                  ? "bg-[#c5c5ef] text-[#191928]" 
                  : "bg-[#18181c] text-[#9a9aa3]"
              )}>
                {bookmarks.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* METRICS VIEW */}
      {activeTab === 'metrics' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 mb-8 md:mb-12">
            <div className="bg-[#222228] border border-[#33333c] rounded-[24px] p-6 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-[#9a9aa3]">
                  Velocidade Média
                </span>
                <div className="w-8 h-8 rounded-[8px] bg-[#35325f] text-[#c5c5ef] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-[-0.04em] text-[#e8e8ec]">
                {averageWpm || '--'} <span className="text-sm font-semibold text-[#9a9aa3] font-sans">WPM</span>
              </div>
            </div>

            <div className="bg-[#222228] border border-[#33333c] rounded-[24px] p-6 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-[#9a9aa3]">
                  Sessões Registradas
                </span>
                <div className="w-8 h-8 rounded-[8px] bg-[#28342b] text-[#5fa777] flex items-center justify-center">
                  <span className="text-xs font-bold font-mono">#</span>
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-[-0.04em] text-[#e8e8ec]">
                {totalSessions}
              </div>
            </div>

            <div className="bg-[#222228] border border-[#33333c] rounded-[24px] p-6 shadow-none flex flex-col justify-between sm:col-span-2 md:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-[#9a9aa3]">
                  Marcadores Salvos
                </span>
                <div className="w-8 h-8 rounded-[8px] bg-[#3a3520] text-[#FCFD76] flex items-center justify-center">
                  <BookmarkIcon className="w-4 h-4 fill-current" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-[-0.04em] text-[#e8e8ec]">
                  {bookmarks.length}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('bookmarks')}
                  className="text-xs text-[#FCFD76] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver todos</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#222228] border border-[#33333c] rounded-[24px] p-6 sm:p-8 h-[420px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-extrabold text-[#e8e8ec] tracking-[-0.02em]">
                Evolução de Velocidade (WPM)
              </h2>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#c5c5ef] bg-[#35325f] px-3 py-1 rounded-[30px]">
                Fluxo Contínuo
              </span>
            </div>
            
            {chartData.length > 0 ? (
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#33333c" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9a9aa3" 
                      tick={{ fill: '#9a9aa3', fontSize: 12, fontFamily: 'Urbanist' }} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#9a9aa3" 
                      tick={{ fill: '#9a9aa3', fontSize: 12, fontFamily: 'monospace' }} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="wpm" 
                      stroke="#FCFD76" 
                      strokeWidth={3}
                      dot={{ fill: '#FCFD76', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#212121', stroke: '#FCFD76', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[#9a9aa3] pb-6">
                <TrendingUp className="w-10 h-10 mb-3 text-[#33333c]" />
                <p className="text-base font-bold text-[#c2c2c9]">Nenhum histórico registrado ainda</p>
                <p className="text-xs text-[#9a9aa3] mt-1">Conclua leituras na biblioteca para gerar o gráfico de evolução.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOOKMARKS VIEW */}
      {activeTab === 'bookmarks' && (
        <div className="space-y-6">
          {/* Summary Stats for Bookmarks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#222228] border border-[#33333c] rounded-[20px] p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-[14px] bg-[#3a3520] text-[#FCFD76] flex items-center justify-center shrink-0">
                <BookmarkIcon className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#9a9aa3] font-bold">Total Marcadores</div>
                <div className="text-2xl font-bold font-mono text-[#e8e8ec]">{bookmarks.length}</div>
              </div>
            </div>

            <div className="bg-[#222228] border border-[#33333c] rounded-[20px] p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-[14px] bg-[#35325f] text-[#c5c5ef] flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#9a9aa3] font-bold">Documentos</div>
                <div className="text-2xl font-bold font-mono text-[#e8e8ec]">{docsWithBookmarksCount}</div>
              </div>
            </div>

            <div className="bg-[#222228] border border-[#33333c] rounded-[20px] p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-[14px] bg-[#28342b] text-[#5fa777] flex items-center justify-center shrink-0">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#9a9aa3] font-bold">Com Anotações</div>
                <div className="text-2xl font-bold font-mono text-[#e8e8ec]">{bookmarksWithNotesCount}</div>
              </div>
            </div>
          </div>

          {/* Search, Document Filter & Sorting Bar */}
          <div className="bg-[#222228] border border-[#33333c] rounded-[20px] p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9aa3] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por trecho, documento ou anotação..."
                className="w-full bg-[#18181c] border border-[#33333c] focus:border-[#FCFD76] rounded-[12px] pl-10 pr-10 py-2 text-sm text-[#e8e8ec] placeholder:text-[#9a9aa3] focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9a9aa3] hover:text-[#e8e8ec] rounded-[6px] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Document Filter Dropdown */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-[#9a9aa3] bg-[#18181c] border border-[#33333c] rounded-[12px] px-3 py-1.5">
                <Filter className="w-3.5 h-3.5 text-[#9a9aa3]" />
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="bg-transparent text-[#e8e8ec] text-xs focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all" className="bg-[#18181c]">Todos os Documentos ({bookmarks.length})</option>
                  {documents.map((doc) => {
                    const count = bookmarks.filter(b => b.documentId === doc.id).length;
                    return (
                      <option key={doc.id} value={doc.id} className="bg-[#18181c]">
                        {doc.title.length > 25 ? doc.title.substring(0, 25) + '...' : doc.title} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Sort selector */}
              <div className="text-xs text-[#9a9aa3] bg-[#18181c] border border-[#33333c] rounded-[12px] px-3 py-1.5">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-[#e8e8ec] text-xs focus:outline-none cursor-pointer"
                >
                  <option value="recent" className="bg-[#18181c]">Mais Recentes</option>
                  <option value="oldest" className="bg-[#18181c]">Mais Antigos</option>
                  <option value="position" className="bg-[#18181c]">Ordem de Leitura</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bookmarks List */}
          {filteredBookmarks.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredBookmarks.map((item) => {
                const isEditing = editingBookmarkId === item.bookmark.id;
                const totalWords = item.totalWords || 1;
                const percent = Math.min(100, Math.round(((item.bookmark.wordIndex + 1) / totalWords) * 100));

                const typeColors = {
                  pdf: 'bg-[#ff6b63]/15 text-[#ff6b63] border-[#ff6b63]/30',
                  epub: 'bg-[#c5c5ef]/15 text-[#c5c5ef] border-[#c5c5ef]/30',
                  mobi: 'bg-[#f7df94]/15 text-[#f7df94] border-[#f7df94]/30',
                  azw3: 'bg-[#f7df94]/15 text-[#f7df94] border-[#f7df94]/30',
                  txt: 'bg-[#5fa777]/15 text-[#5fa777] border-[#5fa777]/30'
                }[item.documentType] || 'bg-[#262733] text-[#eef0f8] border-[#35325f]';

                return (
                  <div
                    key={item.bookmark.id}
                    className="group bg-[#222228] border border-[#33333c] hover:border-[#474182] rounded-[20px] p-5 sm:p-6 transition-all duration-200 shadow-none flex flex-col gap-4 relative"
                  >
                    {/* Top Header inside Card */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className={cn("text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-[6px] border", typeColors)}>
                          {item.documentType}
                        </span>
                        <h3 className="font-bold text-base text-[#e8e8ec] line-clamp-1" title={item.documentTitle}>
                          {item.documentTitle}
                        </h3>
                      </div>

                      {/* Timestamp & Meta */}
                      <div className="flex items-center gap-2 text-xs text-[#9a9aa3] font-mono shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        <span title={formatFullDateTime(item.bookmark.timestamp)}>
                          {formatRelativeTime(item.bookmark.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Word Index & Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-1.5 text-[#FCFD76] font-bold">
                          <BookmarkIcon className="w-3.5 h-3.5 fill-current" />
                          <span>Palavra {(item.bookmark.wordIndex + 1).toLocaleString()}</span>
                          <span className="text-[#9a9aa3] font-normal font-sans">
                            de {item.totalWords.toLocaleString()}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-[#c5c5ef]">
                          {percent}%
                        </span>
                      </div>

                      {/* Micro Progress Track */}
                      <div className="w-full bg-[#18181c] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#FCFD76] h-full rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Snippet Context */}
                    <div className="bg-[#18181c] rounded-[14px] p-3.5 border border-[#2c2c34] text-sm text-[#d4d4dc] leading-relaxed italic relative">
                      <span className="text-[#FCFD76] font-bold mr-1">&ldquo;</span>
                      {item.bookmark.snippet}
                      <span className="text-[#FCFD76] font-bold ml-1">&rdquo;</span>
                    </div>

                    {/* Note / Annotation Section */}
                    {isEditing ? (
                      <div className="flex flex-col gap-2 pt-1">
                        <textarea
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="Escreva uma anotação ou reflexão sobre este trecho..."
                          className="w-full bg-[#18181c] border border-[#FCFD76] rounded-[12px] p-3 text-xs text-[#e8e8ec] focus:outline-none min-h-[70px] resize-y"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingBookmarkId(null)}
                            className="px-3 py-1.5 text-xs text-[#9a9aa3] hover:text-[#e8e8ec] hover:bg-[#2a2a32] rounded-[8px] transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleSaveNote(item.documentId, item.bookmark.id, e)}
                            className="px-3 py-1.5 text-xs font-bold bg-[#FCFD76] text-[#212121] hover:bg-[#eef05a] rounded-[8px] transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Salvar Nota</span>
                          </button>
                        </div>
                      </div>
                    ) : item.bookmark.note ? (
                      <div className="flex items-start justify-between gap-3 bg-[#28273d]/50 border border-[#35325f] rounded-[12px] p-3 text-xs text-[#D7D7F4]">
                        <div className="flex items-start gap-2 flex-1">
                          <Edit3 className="w-3.5 h-3.5 text-[#c5c5ef] mt-0.5 shrink-0" />
                          <p className="leading-relaxed font-sans">{item.bookmark.note}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => startEditNote(item, e)}
                          className="text-[#9a9aa3] hover:text-[#c5c5ef] text-[11px] font-semibold underline shrink-0 cursor-pointer"
                        >
                          Editar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => startEditNote(item, e)}
                        className="self-start text-xs text-[#8a8a95] hover:text-[#FCFD76] flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Adicionar anotação...</span>
                      </button>
                    )}

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#33333c]/60">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteBookmark(item.documentId, item.bookmark.id, e)}
                        className="p-2 text-[#8a8a95] hover:text-[#ff6b63] hover:bg-[#ff6b63]/10 rounded-[10px] transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
                        title="Excluir marcador"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Excluir</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenBookmark(item.documentId, item.bookmark.wordIndex)}
                        className="px-4 py-2 bg-[#FCFD76] hover:bg-[#eef05a] text-[#212121] font-bold rounded-[12px] text-xs sm:text-sm flex items-center gap-2 transition-all hover:-translate-y-0.5 cursor-pointer shadow-none"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Continuar Leitura</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 px-6 text-center border border-dashed border-[#33333c] bg-[#1e1e24]/60 rounded-[24px] text-[#9a9aa3] flex flex-col items-center">
              <div className="w-14 h-14 rounded-[18px] bg-[#3a3520] text-[#FCFD76] flex items-center justify-center mb-4">
                <BookmarkIcon className="w-7 h-7 fill-current" />
              </div>
              <h3 className="text-lg font-bold mb-1.5 text-[#e8e8ec]">
                {searchQuery || selectedDocId !== 'all' 
                  ? 'Nenhum marcador encontrado com estes filtros' 
                  : 'Nenhum marcador salvo ainda'}
              </h3>
              <p className="text-sm text-[#9a9aa3] max-w-md mb-5 leading-relaxed">
                {searchQuery || selectedDocId !== 'all'
                  ? 'Tente ajustar sua busca ou selecionar outro documento.'
                  : 'Durante a leitura no leitor RSVP, pressione a tecla B ou clique no botão de marcador para salvar passagens importantes com anotações personalizadas.'}
              </p>
              {searchQuery || selectedDocId !== 'all' ? (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSelectedDocId('all'); }}
                  className="px-4 py-2 bg-[#222228] hover:bg-[#2a2a32] text-[#e8e8ec] border border-[#33333c] rounded-[10px] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Limpar filtros
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onBack}
                  className="px-5 py-2.5 bg-[#FCFD76] hover:bg-[#eef05a] text-[#212121] font-bold rounded-[12px] text-xs sm:text-sm transition-all cursor-pointer shadow-none"
                >
                  Ir para a Biblioteca
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
