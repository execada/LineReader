import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { withLines, type DocumentRecord } from '../../entities/document/record.ts';
import { readingOrder } from '../../entities/document/text.ts';
import { bestSuggestion, fixAll, fixTypo, type Typo } from '../../features/typos/typos.ts';
import { useTypos } from '../../features/typos/useTypos.ts';
import { colors, space, type } from '../../shared/theme/tokens.ts';
import { Button } from '../../shared/ui/Button.tsx';
import { DocumentTopBar } from '../../widgets/document-top-bar/DocumentTopBar.tsx';
import { TypoCard } from '../../widgets/typo-card/TypoCard.tsx';

/**
 * Typos in the text itself (written so on the photo), not recognition errors:
 * replace a word with the suggestion, keep it (it goes to the personal
 * dictionary) or replace all at once. Only the person's copy changes.
 */
export function TyposPage(props: {
  doc: DocumentRecord;
  onSave: (doc: DocumentRecord) => void;
  onKeep: (word: string) => void;
  onBack: () => void;
}) {
  const { doc } = props;
  const [kept, setKept] = useState<readonly string[]>([]);
  const { typos, error } = useTypos(doc, kept);
  const fixable = (typos ?? []).filter((t) => bestSuggestion(t) !== null);

  const [message, setMessage] = useState<string | null>(null);
  // The list may be a moment behind the text (a fix was just saved); a stale typo is skipped, not applied.
  const apply = (change: () => DocumentRecord) => {
    try {
      props.onSave(change());
      setMessage(null);
    } catch {
      setMessage('Текст уже изменился. Проверяю опечатки заново.');
    }
  };
  const replace = (typo: Typo, word: string) => apply(() => withLines(doc, typo.page, fixTypo(doc.pages[typo.page]!.lines, typo, word)));
  const keep = (typo: Typo) => {
    setKept((k) => (k.includes(typo.word) ? k : [...k, typo.word]));
    props.onKeep(typo.word);
  };
  const replaceAll = () =>
    apply(() =>
      doc.pages.reduce(
        (acc, p, page) =>
          fixable.some((t) => t.page === page)
            ? withLines(
                acc,
                page,
                fixAll(
                  p.lines,
                  fixable.filter((t) => t.page === page),
                ),
              )
            : acc,
        doc,
      ),
    );
  const lineNumber = (t: Typo) => [...doc.pages[t.page]!.lines].sort(readingOrder).findIndex((l) => l.id === t.lineId) + 1;

  return (
    <View style={styles.screen}>
      <DocumentTopBar sentToServer={doc.sentToServer} onBack={props.onBack} backLabel="Текст" />
      <Text style={styles.title}>Опечатки{typos && typos.length > 0 ? ` ${typos.length}` : ''}</Text>
      <Text style={styles.lead}>
        Это опечатки в самом тексте: на фото написано так же. Исправление меняет только вашу копию текста. Сомнительные строки здесь не
        проверяются, они ждут сверки.
      </Text>
      {message && <Text style={styles.lead}>{message}</Text>}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {typos === null && <Text style={styles.lead}>Проверяю орфографию на телефоне…</Text>}
        {typos?.length === 0 && <Text style={styles.lead}>{error ?? 'Опечаток не найдено.'}</Text>}
        {typos?.map((t) => (
          <TypoCard
            key={`${t.lineId}:${t.start}`}
            docId={doc.id}
            page={doc.pages[t.page]!}
            line={doc.pages[t.page]!.lines.find((l) => l.id === t.lineId)!}
            lineNumber={lineNumber(t)}
            typo={t}
            onReplace={(word) => replace(t, word)}
            onKeep={() => keep(t)}
          />
        ))}
      </ScrollView>
      {fixable.length > 0 && (
        <View style={styles.actions}>
          <Button label={`Заменить все ${fixable.length}`} variant="outline" onPress={replaceAll} />
          <Text style={styles.caption}>Слово, которое вы оставили, попадёт в ваш словарь</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.xl },
  title: { ...type.heading, color: colors.ink, marginTop: space.m },
  lead: { ...type.body, fontSize: 14, color: colors.inkMuted, marginTop: space.s },
  list: { flex: 1, marginTop: space.l },
  listContent: { gap: 10, paddingBottom: space.l },
  actions: { gap: space.s, paddingVertical: space.l },
  caption: { ...type.caption, fontSize: 12, color: colors.inkMuted, textAlign: 'center' },
});
