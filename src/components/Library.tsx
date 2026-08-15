import { useState, useEffect, useRef, ChangeEvent, MouseEvent } from 'react';
import { Upload, BookOpen, Trash2, FileText, File as FileIcon, Clock, TrendingUp } from 'lucide-react';
import { storage, DocumentMeta } from '../lib/storage';
import { parseTxt, parsePdf, parseEpub, parseMobi } from '../lib/parser';
import { cn } from '../lib/utils';

interface LibraryProps {
  onSelect: (id: string) => void;
  onOpenDashboard: () => void;
}

export default function Library({ onSelect, onOpenDashboard }: LibraryProps) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = async () => {
    const docs = await storage.getDocuments();
    setDocuments(docs.sort((a, b) => b.addedAt - a.addedAt));
  };

  useEffect(() => {
    loadDocs();
  }, []);

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
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-[#e8e8ec]">
              BlinkReader
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

      {/* Document Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {documents.map(doc => {
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
              onClick={() => onSelect(doc.id)}
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
              </div>
            </div>
          );
        })}

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
