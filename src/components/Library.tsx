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
    <div className="max-w-4xl mx-auto p-6 md:p-12 w-full">
      <header className="flex justify-between items-center mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">BlinkReader</h1>
        
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenDashboard}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors shadow-sm"
            title="Performance Dashboard"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="font-medium hidden sm:inline">Stats</span>
          </button>
          
          <button
            onClick={() => setShowPasteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4" />
            <span className="font-medium hidden sm:inline">Paste Text</span>
          </button>

          <div>
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
                "flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-amber-50 rounded-lg cursor-pointer transition-colors shadow-sm",
                loading && "opacity-50 cursor-not-allowed"
              )}
            >
              {loading ? <Clock className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="font-medium">{loading ? 'Parsing...' : 'Import'}</span>
            </label>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map(doc => (
          <div 
            key={doc.id}
            onClick={() => onSelect(doc.id)}
            className="group relative bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-zinc-800 rounded-lg text-amber-500">
                {doc.type === 'pdf' ? <FileIcon className="w-6 h-6" /> : 
                 (doc.type === 'epub' || doc.type === 'mobi' || doc.type === 'azw3') ? <BookOpen className="w-6 h-6" /> :
                 <FileText className="w-6 h-6" />}
              </div>
              <button 
                onClick={(e) => handleDelete(e, doc.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <h3 className="font-semibold text-zinc-100 mb-1 line-clamp-2" title={doc.title}>
              {doc.title}
            </h3>
            
            <div className="flex items-center gap-3 text-sm text-zinc-500 mt-4">
              <span className="uppercase text-xs font-semibold tracking-wider">{doc.type}</span>
              <span>•</span>
              <span>{doc.totalWords.toLocaleString()} words</span>
            </div>
          </div>
        ))}

        {documents.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-500 flex flex-col items-center">
            <BookOpen className="w-12 h-12 mb-4 text-zinc-700" />
            <p className="text-lg font-medium mb-1 text-zinc-300">Your library is empty</p>
            <p className="text-sm">Import a PDF, EPUB, MOBI, AZW3, or TXT file to start reading</p>
          </div>
        )}
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <h2 className="text-xl font-bold text-zinc-100 mb-4">Paste Text</h2>
            
            <input
              type="text"
              placeholder="Title (e.g. My Article)"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            
            <textarea
              placeholder="Paste your text here..."
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              className="w-full flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 min-h-[200px] resize-y focus:outline-none focus:ring-2 focus:ring-amber-500/50 mb-6"
            />
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-5 py-2.5 rounded-lg font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteSubmit}
                disabled={loading || !pasteTitle.trim() || !pasteContent.trim()}
                className="px-5 py-2.5 rounded-lg font-medium bg-amber-600 hover:bg-amber-500 text-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <Clock className="w-4 h-4 animate-spin" />}
                Add to Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
