import type { Quad } from './model.ts';

// Room around the line for ascenders and descenders, in pixels.
const PADDING = 6;

export interface Box {
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}

/** Axis-aligned box around a line quad, padded and clamped to the page, in whole pixels. */
export function cropBox(quad: Quad, pageWidth: number, pageHeight: number): Box {
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const left = Math.max(0, Math.floor(Math.min(...xs) - PADDING));
  const top = Math.max(0, Math.floor(Math.min(...ys) - PADDING));
  const right = Math.min(pageWidth, Math.ceil(Math.max(...xs) + PADDING));
  const bottom = Math.min(pageHeight, Math.ceil(Math.max(...ys) + PADDING));
  return {
    originX: left,
    originY: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}
