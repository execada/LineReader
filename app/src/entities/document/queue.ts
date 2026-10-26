import { reviewQueue, type ReviewItem } from '../line/review.ts';
import { rulesFor } from '../line/rules.ts';
import type { DocumentRecord } from './record.ts';

/** A line to check and the page it is on. */
export interface DocumentReviewItem extends ReviewItem {
  readonly page: number;
}

/** Lines of the whole document that need a person's look, page by page, by the rules of its engine. */
export function documentQueue(doc: DocumentRecord): DocumentReviewItem[] {
  const rules = rulesFor(doc.engine);
  return doc.pages.flatMap((p, page) => reviewQueue(p.lines, rules).map((item) => ({ ...item, page })));
}
