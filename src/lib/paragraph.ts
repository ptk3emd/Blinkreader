export interface ParagraphData {
  id: number;
  startIndex: number;
  endIndex: number; // inclusive
  words: string[];
}

export function computeParagraphs(words: string[]): ParagraphData[] {
  if (!words || words.length === 0) return [];

  const paragraphs: ParagraphData[] = [];
  let currentStart = 0;
  let currentWords: string[] = [];

  const chapterRegex = /^(chapter|capítulo|part|parte|seção|section|livro|book)\b/i;
  // Matches sentence ending punctuation, possibly followed by quotation mark, parenthesis or bracket
  const sentenceEndRegex = /[.!?…]["'»”’)]*$/;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentWords.push(word);

    const isLastWord = i === words.length - 1;
    const isSentenceEnd = sentenceEndRegex.test(word);
    const nextWord = i + 1 < words.length ? words[i + 1] : '';
    const isNextChapter = chapterRegex.test(nextWord);
    
    // Natural paragraph sizing: average 30-70 words per paragraph
    const hasMinParagraphLength = currentWords.length >= 28;
    const hasMaxParagraphLength = currentWords.length >= 70;

    if (isLastWord || isNextChapter || (isSentenceEnd && hasMinParagraphLength) || hasMaxParagraphLength) {
      paragraphs.push({
        id: paragraphs.length,
        startIndex: currentStart,
        endIndex: i,
        words: [...currentWords],
      });
      currentStart = i + 1;
      currentWords = [];
    }
  }

  return paragraphs;
}

export function findParagraphIndex(paragraphs: ParagraphData[], wordIndex: number): number {
  if (!paragraphs || paragraphs.length === 0) return 0;
  
  let low = 0;
  let high = paragraphs.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const p = paragraphs[mid];
    if (wordIndex < p.startIndex) {
      high = mid - 1;
    } else if (wordIndex > p.endIndex) {
      low = mid + 1;
    } else {
      return mid;
    }
  }
  return Math.max(0, Math.min(paragraphs.length - 1, low));
}
