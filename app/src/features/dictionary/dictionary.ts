// Words a person typed when correcting a line. On iOS they go to Vision as
// customWords on the next pages; Tesseract on Android does not take them.

const WORD = /^[\p{L}][\p{L}\p{M}'’-]+$/u;
const EDGE_PUNCTUATION = /^[\p{P}]+|[\p{P}]+$/gu;

function words(text: string): string[] {
  return text
    .split(/\s+/u)
    .map((w) => w.replace(EDGE_PUNCTUATION, ''))
    .filter((w) => WORD.test(w));
}

/** Words present in the corrected text but not in the engine's reading. */
export function learnWords(recognized: string, corrected: string): string[] {
  const before = new Set(words(recognized));
  return words(corrected).filter((w) => !before.has(w));
}

/** Adds new words at the end; the oldest fall off once the list is full. */
export function mergeDictionary(current: readonly string[], learned: readonly string[], max: number): string[] {
  const merged = [...current];
  for (const w of learned) {
    if (!merged.includes(w)) merged.push(w);
  }
  return merged.slice(Math.max(0, merged.length - max));
}
