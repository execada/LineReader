import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { documentQueue } from '../../entities/document/queue.ts';
import type { DocumentRecord } from '../../entities/document/record.ts';
import { languageById } from '../../entities/language/languages.ts';
import { shareCsv, sharePdf, shareText } from '../../features/export/shareDocument.ts';
import { isTranslationCurrent } from '../../features/translate/state.ts';
import { lines as linesWord } from '../../shared/lib/plural.ts';
import { colors, fonts, radius, space, type } from '../../shared/theme/tokens.ts';
import { Button } from '../../shared/ui/Button.tsx';
import { CheckMark } from '../../shared/ui/CheckMark.tsx';
import { FormatOption } from '../../widgets/format-option/FormatOption.tsx';

type Format = 'pdf' | 'txt' | 'csv';

const FORMATS: readonly { id: Format; tag: string; title: string; detail: string }[] = [
  { id: 'pdf', tag: 'PDF', title: 'PDF с поиском', detail: 'Фото страницы, текст можно искать и копировать' },
  { id: 'txt', tag: 'TXT', title: 'Текст', detail: 'Только текст, строка за строкой' },
  { id: 'csv', tag: 'CSV', title: 'Таблица', detail: 'Строки рядами и столбцами, для Excel и Google Таблиц' },
];

/** The export sheet: PDF with search, TXT or CSV, optionally with the translation; the file is made on the phone and shared. */
export function ExportPage(props: { doc: DocumentRecord; onBack: () => void }) {
  const { doc } = props;
  const [format, setFormat] = useState<Format>('pdf');
  const translated = isTranslationCurrent(doc);
  const [withTranslation, setWithTranslation] = useState(translated);
  const [status, setStatus] = useState<string | null>(null);
  const unchecked = documentQueue(doc).length;
  const target = doc.translation ? (languageById(doc.translation.target)?.name ?? doc.translation.target) : '';
  const addTranslation = translated && withTranslation && format !== 'csv';

  const save = async () => {
    setStatus(format === 'pdf' ? 'Собираю PDF…' : null);
    try {
      if (format === 'txt') await shareText(doc, addTranslation);
      if (format === 'csv') await shareCsv(doc);
      if (format === 'pdf') {
        const skipped = await sharePdf(doc, addTranslation);
        setStatus(
          skipped > 0
            ? `В текстовый слой не вошли ${linesWord(skipped)}: шрифт не поддерживает их письменность. На картинке они есть.`
            : null,
        );
      }
    } catch {
      setStatus(format === 'pdf' ? 'PDF собрать не удалось. TXT можно сохранить.' : 'Файл сохранить не удалось.');
    }
  };

  return (
    <View style={styles.scrim}>
      <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={props.onBack} style={styles.dismiss} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Экспорт</Text>
        <View style={styles.formats} accessibilityRole="radiogroup">
          {FORMATS.map((f) => (
            <FormatOption
              key={f.id}
              tag={f.tag}
              title={f.title}
              detail={f.detail}
              selected={format === f.id}
              onPress={() => setFormat(f.id)}
            />
          ))}
        </View>
        {translated && format !== 'csv' && (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: withTranslation }}
            accessibilityLabel={`Добавить перевод на ${target}`}
            onPress={() => setWithTranslation((v) => !v)}
            style={styles.option}
          >
            <Text style={styles.optionText}>Добавить перевод: {target}</Text>
            <CheckMark checked={withTranslation} />
          </Pressable>
        )}
        {unchecked > 0 && (
          <Text style={styles.note}>
            Не сверено: {linesWord(unchecked)}. Несверенные строки попадут в файл так, как их прочитал телефон.
          </Text>
        )}
        {status && <Text style={styles.status}>{status}</Text>}
        <Button label={`Сохранить ${format.toUpperCase()}`} onPress={() => void save()} />
        <Text style={styles.caption}>Файл создаётся на телефоне</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.xl,
    paddingTop: 10,
    paddingBottom: space.l,
    gap: space.m,
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.sheetHandle, alignSelf: 'center' },
  title: { ...type.heading, fontSize: 24, color: colors.ink, marginTop: space.s },
  formats: { gap: space.s },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: space.xs },
  optionText: { fontFamily: fonts.ui, fontSize: 15, color: colors.ink },
  note: { ...type.caption, color: colors.inkMuted },
  status: { fontFamily: fonts.ui, fontSize: 14, color: colors.accentText },
  caption: { ...type.caption, fontSize: 12, color: colors.inkMuted, textAlign: 'center' },
});
