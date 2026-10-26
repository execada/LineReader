import { z } from 'zod';

import type { Line } from '../../entities/line/model.ts';

const point = z.object({ x: z.number().finite(), y: z.number().finite() });

const nativePage = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  lines: z.array(
    z.object({
      text: z.string(),
      confidence: z.number().min(0).max(1),
      candidates: z.array(z.object({ text: z.string(), confidence: z.number().min(0).max(1) })),
      quad: z.tuple([point, point, point, point]),
    }),
  ),
});

/** The page size and lines parsed from the native module output. */
export interface RecognizedPage {
  readonly width: number;
  readonly height: number;
  readonly lines: readonly Line[];
}

/** Validates what the native module returned and turns it into pending device lines. */
export function parsePage(raw: unknown, pageId: string): RecognizedPage {
  const page = nativePage.parse(raw);
  return {
    width: page.width,
    height: page.height,
    lines: page.lines
      .filter((l) => l.text.trim() !== '')
      .map((l, i) => ({
        id: `${pageId}-${i}`,
        quad: l.quad,
        text: l.text,
        confidence: l.confidence,
        candidates: l.candidates,
        source: 'device' as const,
        status: 'pending' as const,
      })),
  };
}
