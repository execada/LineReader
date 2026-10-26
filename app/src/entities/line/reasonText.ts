import type { Line } from './model.ts';
import type { Reason } from './rules.ts';

/** Why a line is in the review queue, in words for the person. */
export function reasonText(reason: Reason, line: Line): string {
  switch (reason) {
    case 'low_confidence':
      return 'Распознавание не уверено в строке';
    case 'risky_token':
      return 'Цифры рядом с похожими буквами (0 и О, 1 и l)';
    case 'candidates_disagree':
      return 'Варианты прочтения расходятся';
    case 'server_disagrees':
      return `Сервер прочитал иначе: «${line.serverText ?? ''}»`;
  }
}
