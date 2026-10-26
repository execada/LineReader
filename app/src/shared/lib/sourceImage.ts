/** A photo picked or scanned by the person, before it is copied into a document. */
export interface SourceImage {
  readonly uri: string;
  readonly width?: number;
  readonly height?: number;
}
