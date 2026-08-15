function tokenize(text: string): string[] {
  // Replace newlines with spaces, remove multiple spaces, then split
  const cleanText = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  // We want to keep punctuation attached to words
  return cleanText.split(' ').filter(w => w.length > 0);
}

function stripHtml(html: string): string {
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export async function parseTxt(file: File): Promise<string[]> {
  const text = await file.text();
  return tokenize(text);
}

export async function parsePdf(file: File): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  
  // Configure worker safely
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.0.379'}/build/pdf.worker.min.mjs`;
    }
  } catch (e) {
    console.warn('PDF Worker setup warning:', e);
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str || '')
      .join(' ');
    fullText += pageText + ' ';
  }

  return tokenize(fullText);
}

export async function parseEpub(file: File): Promise<string[]> {
  const ePubModule = await import('epubjs');
  const ePub = (ePubModule as any).default || ePubModule;
  
  const arrayBuffer = await file.arrayBuffer();
  const book = ePub(arrayBuffer);
  await book.ready;
  
  let fullText = '';
  // @ts-ignore
  const spine = book.spine;
  
  // @ts-ignore
  for (let i = 0; i < spine.length; i++) {
    // @ts-ignore
    const item = spine.get(i);
    try {
      const doc = await item.load(book.load.bind(book));
      const text = doc.textContent || doc.body?.textContent || '';
      fullText += text + ' ';
    } catch (e) {
      console.warn("Failed to parse an epub section", e);
    }
  }
  
  return tokenize(fullText);
}

export async function parseMobi(file: File): Promise<string[]> {
  const { initMobiFile, initKf8File } = await import('@lingo-reader/mobi-parser');
  
  try {
    const mobi = await initMobiFile(file);
    const spine = mobi.getSpine();
    let fullText = '';

    for (const chapter of spine) {
      const processed = mobi.loadChapter(chapter.id);
      if (processed?.html) {
        fullText += stripHtml(processed.html) + ' ';
      }
    }
    mobi.destroy();
    return tokenize(fullText);
  } catch (err) {
    console.warn("Failed to parse as MOBI, trying KF8/AZW3 fallback...", err);
    try {
      const kf8 = await initKf8File(file);
      const spine = kf8.getSpine();
      let fullText = '';
      for (const chapter of spine) {
        const processed = kf8.loadChapter(chapter.id);
        if (processed?.html) {
          fullText += stripHtml(processed.html) + ' ';
        }
      }
      kf8.destroy();
      return tokenize(fullText);
    } catch (kf8Err) {
      console.error("Failed to parse KF8 as well.", kf8Err);
      throw kf8Err;
    }
  }
}
