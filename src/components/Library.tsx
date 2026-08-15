import { useState, useEffect, useRef, useMemo, ChangeEvent, MouseEvent } from 'react';
import { 
  Upload, BookOpen, Trash2, FileText, File as FileIcon, 
  Clock, TrendingUp, Search, X, Bookmark, Play, ChevronRight 
} from 'lucide-react';
import { storage, DocumentMeta, DocumentProgress } from '../lib/storage';
import { parseTxt, parsePdf, parseEpub, parseMobi } from '../lib/parser';
import { cn } from '../lib/utils';

interface LibraryProps {
  onSelect: (id: string) => void;
  onOpenDashboard: () => void;
}

export default function Library({ onSelect, onOpenDashboard }: LibraryProps) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<DocumentMeta[]>([]);
  const [recentProgress, setRecentProgress] = useState<Record<string, DocumentProgress>>({});
  const [bookmarkCounts, setBookmarkCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = async () => {
    const docs = await storage.getDocuments();
    const sortedDocs = [...docs].sort((a, b) => b.addedAt - a.addedAt);
    setDocuments(sortedDocs);

    const counts: Record<string, number> = {};
    await Promise.all(
      sortedDocs.map(async (d) => {
        const bms = await storage.getBookmarks(d.id);
        if (bms && bms.length > 0) {
          counts[d.id] = bms.length;
        }
      })
    );
    setBookmarkCounts(counts);

    // Load recently read documents (up to 5)
    const recentIds = await storage.getRecentlyRead();
    const recentList: DocumentMeta[] = [];
    const progressMap: Record<string, DocumentProgress> = {};

    for (const id of recentIds) {
      const matched = sortedDocs.find(d => d.id === id);
      if (matched) {
        recentList.push(matched);
        const prog = await storage.getDocumentProgress(id);
        progressMap[id] = prog;
      }
      if (recentList.length >= 5) break;
    }

    setRecentDocuments(recentList);
    setRecentProgress(progressMap);
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleSelectDocument = async (id: string) => {
    await storage.recordRecentlyRead(id);
    onSelect(id);
  };

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase().trim();
    return documents.filter(doc => doc.title.toLowerCase().includes(q));
  }, [documents, searchQuery]);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      let words: string[] = [];
      let type: DocumentMeta['type'] = 'txt';

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        words = await parsePdf(file);
        type = 'pdf';
      } else if (file.type === 'application/epub+zip' || file.name.endsWith('.epub')) {
        words = await parseEpub(file);
        type = 'epub';
      } else if (file.type === 'application/x-mobipocket-ebook' || file.name.endsWith('.mobi')) {
        words = await parseMobi(file);
        type = 'mobi';
      } else if (file.type === 'application/vnd.amazon.ebook' || file.name.endsWith('.azw3')) {
        words = await parseMobi(file);
        type = 'azw3';
      } else {
        words = await parseTxt(file);
        type = 'txt';
      }

      if (words.length === 0) {
        alert("No readable text found in this file.");
        setLoading(false);
        return;
      }

      const meta: DocumentMeta = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        type,
        addedAt: Date.now(),
        totalWords: words.length
      };

      await storage.addDocument(meta, words);
      await loadDocs();
    } catch (err) {
      console.error(err);
      alert("Error reading file.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Delete this document?")) {
      await storage.deleteDocument(id);
      await loadDocs();
    }
  };

  const handlePasteSubmit = async () => {
    if (!pasteTitle.trim() || !pasteContent.trim()) return;
    
    setLoading(true);
    try {
      const words = pasteContent.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(w => w.length > 0);
      
      if (words.length === 0) {
        alert("No readable text found.");
        return;
      }

      const meta: DocumentMeta = {
        id: crypto.randomUUID(),
        title: pasteTitle.trim(),
        type: 'txt',
        addedAt: Date.now(),
        totalWords: words.length
      };

      await storage.addDocument(meta, words);
      await loadDocs();
      setShowPasteModal(false);
      setPasteTitle('');
      setPasteContent('');
    } catch (err) {
      console.error(err);
      alert("Error saving text.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-5 sm:p-8 md:p-12 w-full">
      {/* Header section with brand styling */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 md:mb-12 pb-6 border-b border-[#33333c]">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <img 
              src="/favicon.svg" 
              alt="Uma palavra logo" 
              className="w-8 h-8 rounded-[9px] shadow-sm border border-[#33333c]" 
              referrerPolicy="no-referrer"
            />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-[#e8e8ec]">
              Uma palavra
            </h1>
          </div>
          <p className="text-[#c2c2c9] text-sm sm:text-base font-medium">
            Leitura rápida RSVP e foco dinâmico com processamento visual calibrado.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={onOpenDashboard}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#222228] hover:bg-[#2a2a32] text-[#e8e8ec] border border-[#33333c] hover:border-[#474182] rounded-[12px] transition-all text-sm font-semibold shadow-none hover:-translate-y-0.5 cursor-pointer"
            title="Métricas de Desempenho"
          >
            <TrendingUp className="w-4 h-4 text-[#c5c5ef]" />
            <span>Métricas</span>
          </button>
          
          <button
            onClick={() => setShowPasteModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#222228] hover:bg-[#2a2a32] text-[#e8e8ec] border border-[#33333c] hover:border-[#474182] rounded-[12px] transition-all text-sm font-semibold shadow-none hover:-translate-y-0.5 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#c5c5ef]" />
            <span>Colar Texto</span>
          </button>

          <div className="flex-1 sm:flex-initial">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              accept=".txt,.pdf,.epub,.mobi,.azw3,application/pdf,application/epub+zip,application/x-mobipocket-ebook,application/vnd.amazon.ebook"
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={cn(
                "flex items-center justify-center gap-2 px-5 py-2.5 bg-[#FCFD76] hover:bg-[#eef05a] text-[#212121] rounded-[12px] cursor-pointer transition-all text-sm font-bold shadow-none hover:-translate-y-0.5 w-full sm:w-auto",
                loading && "opacity-60 cursor-not-allowed"
              )}
            >
              {loading ? <Clock className="w-4 h-4 animate-spin text-[#212121]" /> : <Upload className="w-4 h-4 text-[#212121]" />}
              <span>{loading ? 'Processando...' : 'Importar'}</span>
            </label>
          </div>
        </div>
      </header>

      {/* Search and Filter Bar */}
      {documents.length > 0 && (
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9aa3] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar documentos por título..."
              className="w-full bg-[#18181c] border border-[#33333c] focus:border-[#FCFD76] rounded-[12px] pl-10 pr-10 py-2.5 text-sm text-[#e8e8ec] placeholder:text-[#9a9aa3] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9a9aa3] hover:text-[#e8e8ec] hover:bg-[#2a2a32] rounded-[6px] transition-colors cursor-pointer"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs text-[#9a9aa3] font-mono px-1 flex items-center justify-between sm:justify-end gap-2">
            {searchQuery.trim() ? (
              <span>
                {filteredDocuments.length} de {documents.length} {documents.length === 1 ? 'documento' : 'documentos'}
              </span>
            ) : (
              <span>
                {documents.length} {documents.length === 1 ? 'documento salvo' : 'documentos salvos'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recently Read Section (last opened documents, max 5) */}
      {!searchQuery.trim() && recentDocuments.length > 0 && (
        <section className="mb-10 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FCFD76]" />
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.12em] text-[#e8e8ec]">
                Lidos Recentemente
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#18181c] border border-[#33333c] text-[#c2c2c9]">
                {recentDocuments.length}
              </span>
            </div>
            <span className="text-xs text-[#9a9aa3] hidden sm:inline">Últimos 5 abertos</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentDocuments.map((doc) => {
              const prog = recentProgress[doc.id] || { currentWordIndex: 0, wpm: 300 };
              const percent = doc.totalWords > 0 
                ? Math.min(100, Math.round(((prog.currentWordIndex + 1) / doc.totalWords) * 100))
                : 0;

              const typeColors: Record<string, string> = {
                pdf: 'bg-[#653a2c] text-[#F8B7A2]',
                epub: 'bg-[#35325f] text-[#D7D7F4]',
                mobi: 'bg-[#35325f] text-[#D7D7F4]',
                azw3: 'bg-[#35325f] text-[#D7D7F4]',
                txt: 'bg-[#28342b] text-[#5fa777]'
              };

              return (
                <div
                  key={`recent-${doc.id}`}
                  onClick={() => handleSelectDocument(doc.id)}
                  className="group relative bg-[#1f1f26] border border-[#33333c] hover:border-[#FCFD76]/70 hover:bg-[#25252e] rounded-[20px] p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_30px_-18px_rgba(0,0,0,0.5)] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("p-2 rounded-[10px]", typeColors[doc.type] || 'bg-[#262733] text-[#eef0f8]')}>
                          {doc.type === 'pdf' ? <FileIcon className="w-4 h-4" /> : 
                           (doc.type === 'epub' || doc.type === 'mobi' || doc.type === 'azw3') ? <BookOpen className="w-4 h-4" /> :
                           <FileText className="w-4 h-4" />}
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[5px] bg-[#18181c] text-[#9a9aa3]">
                          {doc.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {bookmarkCounts[doc.id] ? (
                          <span 
                            className="flex items-center gap-1 text-[11px] text-[#FCFD76] font-mono font-semibold bg-[#514a19]/40 border border-[#514a19] px-2 py-0.5 rounded-full"
                            title={`${bookmarkCounts[doc.id]} marcador(es)`}
                          >
                            <Bookmark className="w-3 h-3 fill-current" />
                            <span>{bookmarkCounts[doc.id]}</span>
                          </span>
                        ) : null}
                        <button 
                          onClick={(e) => handleDelete(e, doc.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-[#9a9aa3] hover:text-[#ff6b63] hover:bg-[#ff6b63]/10 rounded-[8px] transition-all cursor-pointer"
                          title="Excluir documento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-bold text-[#e8e8ec] group-hover:text-[#FCFD76] transition-colors text-sm sm:text-base leading-snug mb-3 line-clamp-2" title={doc.title}>
                      {doc.title}
                    </h3>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#33333c]/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[#FCFD76] font-bold">
                        {percent}% <span className="text-[10px] text-[#9a9aa3] font-normal font-sans">lido</span>
                      </span>
                      <span className="text-[11px] text-[#9a9aa3] font-mono">
                        {Math.min(doc.totalWords, prog.currentWordIndex + 1).toLocaleString()} / {doc.totalWords.toLocaleString()}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-[#18181c] rounded-full overflow-hidden border border-[#33333c]/40">
                      <div 
                        className="h-full bg-[#FCFD76] transition-all duration-300 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-mono text-[#9a9aa3]">
                        {prog.wpm || 300} WPM
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#FCFD76] group-hover:translate-x-0.5 transition-transform">
                        Continuar <Play className="w-3 h-3 fill-current" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Document Section Header */}
      {documents.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#c5c5ef]" />
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.12em] text-[#9a9aa3]">
              {searchQuery.trim() ? 'Resultados da Busca' : 'Todos os Documentos'}
            </h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#18181c] border border-[#33333c] text-[#c2c2c9]">
              {filteredDocuments.length}
            </span>
          </div>
        </div>
      )}

      {/* Document Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDocuments.map(doc => {
          const typeColors = {
            pdf: 'bg-[#653a2c] text-[#F8B7A2]',
            epub: 'bg-[#35325f] text-[#D7D7F4]',
            mobi: 'bg-[#35325f] text-[#D7D7F4]',
            azw3: 'bg-[#35325f] text-[#D7D7F4]',
            txt: 'bg-[#28342b] text-[#5fa777]'
          }[doc.type] || 'bg-[#262733] text-[#eef0f8]';

          return (
            <div 
              key={doc.id}
              onClick={() => handleSelectDocument(doc.id)}
              className="group relative bg-[#222228] border border-[#33333c] hover:border-[#474182] hover:bg-[#2a2a32] rounded-[24px] p-6 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_30px_-18px_rgba(0,0,0,0.45)] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className={cn("p-2.5 rounded-[12px]", typeColors)}>
                    {doc.type === 'pdf' ? <FileIcon className="w-5 h-5" /> : 
                     (doc.type === 'epub' || doc.type === 'mobi' || doc.type === 'azw3') ? <BookOpen className="w-5 h-5" /> :
                     <FileText className="w-5 h-5" />}
                  </div>
                  <button 
                    onClick={(e) => handleDelete(e, doc.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-[#9a9aa3] hover:text-[#ff6b63] hover:bg-[#ff6b63]/10 rounded-[10px] transition-all cursor-pointer"
                    title="Excluir documento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <h3 className="font-bold text-[#e8e8ec] text-base leading-snug mb-2 line-clamp-2" title={doc.title}>
                  {doc.title}
                </h3>
              </div>
              
              <div className="flex items-center gap-2.5 text-xs text-[#9a9aa3] pt-4 mt-2 border-t border-[#33333c]/60 font-mono">
                <span className="uppercase font-bold tracking-wider px-2 py-0.5 rounded-[6px] bg-[#18181c] text-[#c2c2c9]">
                  {doc.type}
                </span>
                <span>•</span>
                <span>{doc.totalWords.toLocaleString()} palavras</span>
                {bookmarkCounts[doc.id] ? (
                  <>
                    <span>•</span>
                    <span 
                      className="flex items-center gap-1 text-[#FCFD76] font-semibold"
                      title={`${bookmarkCounts[doc.id]} ${bookmarkCounts[doc.id] === 1 ? 'marcador salvo' : 'marcadores salvos'}`}
                    >
                      <Bookmark className="w-3 h-3 fill-current" />
                      <span>{bookmarkCounts[doc.id]}</span>
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}

        {documents.length > 0 && filteredDocuments.length === 0 && (
          <div className="col-span-full py-16 px-6 text-center border border-dashed border-[#33333c] bg-[#1e1e24]/60 rounded-[24px] text-[#9a9aa3] flex flex-col items-center">
            <div className="w-14 h-14 rounded-[16px] bg-[#222228] border border-[#33333c] flex items-center justify-center mb-4 text-[#9a9aa3]">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-1.5 text-[#e8e8ec]">Nenhum documento encontrado</h3>
            <p className="text-sm text-[#9a9aa3] max-w-md mb-4">
              Nenhum título corresponde ao termo &quot;{searchQuery}&quot;.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-[#222228] hover:bg-[#2a2a32] text-[#e8e8ec] border border-[#33333c] rounded-[10px] text-xs font-semibold transition-colors cursor-pointer"
            >
              Limpar busca
            </button>
          </div>
        )}

        {documents.length === 0 && !loading && (
          <div className="col-span-full py-16 px-6 text-center border border-dashed border-[#33333c] bg-[#1e1e24]/60 rounded-[24px] text-[#9a9aa3] flex flex-col items-center">
            <div className="w-14 h-14 rounded-[16px] bg-[#35325f] flex items-center justify-center mb-4 text-[#D7D7F4]">
              <BookOpen className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-1.5 text-[#e8e8ec]">Sua biblioteca está vazia</h3>
            <p className="text-sm text-[#9a9aa3] max-w-md">
              Importe materiais em PDF, EPUB, MOBI ou TXT para iniciar o estudo com leitura RSVP de alta performance.
            </p>
          </div>
        )}
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(20,20,40,0.6)] backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#222228] border border-[#33333c] rounded-[24px] p-6 sm:p-8 w-full max-w-2xl shadow-[0_18px_40px_-22px_rgba(0,0,0,0.55)] flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold tracking-tight text-[#e8e8ec]">Colar Texto</h2>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#9a9aa3] bg-[#18181c] px-2.5 py-1 rounded-[30px]">
                RSVP
              </span>
            </div>
            
            <input
              type="text"
              placeholder="Título do texto (ex.: Fisiologia Renal - Resumo)"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              className="w-full bg-[#18181c] border border-[#33333c] focus:border-[#FCFD76] rounded-[12px] px-4 py-3 text-[#e8e8ec] text-sm mb-4 focus:outline-none transition-colors"
            />
            
            <textarea
              placeholder="Cole seu texto ou artigo aqui..."
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              className="w-full flex-1 bg-[#18181c] border border-[#33333c] focus:border-[#FCFD76] rounded-[12px] px-4 py-3 text-[#e8e8ec] text-sm min-h-[200px] resize-y focus:outline-none transition-colors mb-6"
            />
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-5 py-2.5 rounded-[12px] font-semibold text-sm text-[#9a9aa3] hover:text-[#e8e8ec] hover:bg-[#2a2a32] border border-transparent transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handlePasteSubmit}
                disabled={loading || !pasteTitle.trim() || !pasteContent.trim()}
                className="px-6 py-2.5 rounded-[12px] font-bold text-sm bg-[#FCFD76] hover:bg-[#eef05a] text-[#212121] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-none"
              >
                {loading && <Clock className="w-4 h-4 animate-spin text-[#212121]" />}
                Salvar na Biblioteca
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
