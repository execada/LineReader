import type { SourceImage } from '../../shared/lib/sourceImage.ts';

/** Pages in one text; more would make recognition on the phone too slow to wait for. */
export const MAX_SHOTS = 20;

export type CaptureModeId = 'text' | 'document' | 'book';

/**
 * How to shoot: «Текст» for anything (signs, screens, notes) as is, «Документ»
 * through the system scanner that finds and straightens the page, «Книга» for a
 * spread, also as is, with a hint to keep the pages flat.
 */
export interface CaptureMode {
  readonly id: CaptureModeId;
  readonly label: string;
  readonly hint: string;
  readonly straighten: boolean;
}

export const CAPTURE_MODES: readonly CaptureMode[] = [
  { id: 'text', label: 'ТЕКСТ', hint: 'Наведите на любой текст: книгу, вывеску, экран', straighten: false },
  { id: 'document', label: 'ДОКУМЕНТ', hint: 'Сканер найдёт края листа и выровняет его', straighten: true },
  { id: 'book', label: 'КНИГА', hint: 'Прижмите страницы, чтобы строки не изгибались', straighten: false },
];

/** Appends new shots up to MAX_SHOTS and says how many did not fit. */
export function addShots(shots: readonly SourceImage[], added: readonly SourceImage[]): { shots: SourceImage[]; dropped: number } {
  const room = Math.max(0, MAX_SHOTS - shots.length);
  return { shots: [...shots, ...added.slice(0, room)], dropped: Math.max(0, added.length - room) };
}
