/** Russian plural: 1 кусок, 2 куска, 5 кусков, 11 кусков, 21 кусок. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** «1 кусок», «3 куска», «5 кусков». */
export const pieces = (n: number) => `${n} ${plural(n, 'кусок', 'куска', 'кусков')}`;
/** «1 строка», «3 строки», «5 строк». */
export const lines = (n: number) => `${n} ${plural(n, 'строка', 'строки', 'строк')}`;
