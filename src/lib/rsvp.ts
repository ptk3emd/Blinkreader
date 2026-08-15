export interface RSVPWord {
  prefix: string;
  orp: string;
  suffix: string;
}

export function getORPIndex(word: string): number {
  // Simple heuristic for Optimal Recognition Point
  // Punctuation should probably be ignored for length calculation, but to keep it simple and performant:
  
  // Clean word for length calculation (strip basic punctuation at ends)
  const cleanWord = word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
  const len = cleanWord.length || word.length; // fallback if only punctuation
  
  // Find index relative to original word string so we don't mess up rendering
  let targetIndex = 0;
  if (len === 1) targetIndex = 0;
  else if (len <= 3) targetIndex = 1;
  else if (len <= 5) targetIndex = 2;
  else if (len <= 9) targetIndex = 3;
  else if (len <= 13) targetIndex = 4;
  else targetIndex = 5;

  // Adjust targetIndex based on the leading punctuation we stripped
  const leadingPunctuationMatch = word.match(/^[^a-zA-Z0-9]+/);
  if (leadingPunctuationMatch && cleanWord.length > 0) {
    targetIndex += leadingPunctuationMatch[0].length;
  }
  
  // Ensure we don't go out of bounds
  return Math.min(Math.max(0, targetIndex), word.length - 1);
}

export function formatRSVPWord(word: string): RSVPWord {
  if (!word) return { prefix: '', orp: '', suffix: '' };
  
  const index = getORPIndex(word);
  return {
    prefix: word.substring(0, index),
    orp: word.charAt(index),
    suffix: word.substring(index + 1)
  };
}
