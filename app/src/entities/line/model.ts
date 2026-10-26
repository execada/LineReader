export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Corners in image pixels: top-left, top-right, bottom-right, bottom-left. */
export type Quad = readonly [Point, Point, Point, Point];

export interface Candidate {
  readonly text: string;
  readonly confidence: number;
}

type Source = 'device' | 'server' | 'user';
type Status = 'pending' | 'confirmed' | 'edited' | 'skipped';

/** One recognized line with its place on the photo and its review state. */
export interface Line {
  readonly id: string;
  readonly quad: Quad;
  readonly text: string;
  /** Engine confidence in [0, 1]; Vision returns only 1.0, 0.5 or 0.3 per line. */
  readonly confidence: number;
  readonly candidates: readonly Candidate[];
  readonly source: Source;
  readonly status: Status;
  /** The server's reading of the same crop, kept next to the device text, never instead of it. */
  readonly serverText?: string;
}
