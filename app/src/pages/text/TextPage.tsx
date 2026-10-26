import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { documentQueue } from '../../entities/document/queue.ts';
import type { DocumentRecord } from '../../entities/document/record.ts';
import { linesInOrder } from '../../entities/document/text.ts';
import type { Line } from '../../entities/line/model.ts';
import { copyDocumentText, copyLine } from '../../features/copy-text/copyText.ts';
import { lines as linesWord } from '../../shared/lib/plural.ts';
import { colors, fonts, radius, space, type } from '../../shared/theme/tokens.ts';
import { Button } from '../../shared/ui/Button.tsx';
import { DocumentTopBar } from '../../widgets/document-top-bar/DocumentTopBar.tsx';
import { summarize } from '../../widgets/document-card/summary.ts';
import { LineList } from '../../widgets/line-list/LineList.tsx';

/** The whole text line by line: copy all of it with the button or one line with a long press. */
export function TextPage(props: { doc: DocumentRecord; onReview: () => void; onExport: () => void; onBack: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const { doc } = props;
  const lines = linesInOrder(doc);
  const toCheck = new Set(documentQueue(doc).map((item) => item.line.id));
  const title = summarize(doc).title ?? 'Текст';

  const run = async (action: () => Promise<string>) => {
    try {
      setStatus(await action());
    } catch {
      setStatus('Не удалось скопировать.');
    }
  };
  const copyAll = () => run(async () => ((await copyDocumentText(doc)) ? 'Текст скопирован' : 'Копировать нечего: текст не найден.'));
  const copyOne = (line: Line) => run(async () => (await copyLine(line.text), 'Строка скопирована'));

  return (
    <View style={styles.screen}>
      <DocumentTopBar sentToServer={doc.sentToServer} onBack={props.onBack} />
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={toCheck.size === 0}
        onPress={props.onReview}
        style={[styles.banner, toCheck.size > 0 ? styles.bannerCheck : styles.bannerDone]}
      >
        <Text style={[styles.bannerTitle, toCheck.size > 0 ? styles.bannerCheckText : styles.bannerDoneText]}>
          {toCheck.size > 0 ? `${linesWord(toCheck.size)} к сверке` : '0 строк к сверке'}
        </Text>
        <Text style={[styles.bannerText, toCheck.size > 0 ? styles.bannerCheckText : styles.bannerDoneText]}>
          {toCheck.size > 0 ? 'Нажмите, чтобы сверить с фото' : `Всего ${linesWord(lines.length)}`}
        </Text>
      </Pressable>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <LineList lines={lines} toCheck={toCheck} onLongPress={(line) => void copyOne(line)} />
      </ScrollView>
      <Text style={styles.status} accessibilityLiveRegion="polite">
        {status ?? 'Долгое нажатие на строку копирует её.'}
      </Text>
      <View style={styles.actions}>
        <Button label="Сохранить" variant="secondary" onPress={props.onExport} />
        <Button label="Копировать текст" onPress={() => void copyAll()} grow />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.xl },
  title: { ...type.heading, color: colors.ink, marginTop: space.m },
  banner: { marginTop: space.m, padding: space.l, borderRadius: radius.card - 2 },
  bannerCheck: { backgroundColor: colors.accentSoft },
  bannerDone: { backgroundColor: colors.doneSoft },
  bannerTitle: { fontFamily: fonts.uiSemibold, fontSize: 16 },
  bannerText: { fontFamily: fonts.ui, fontSize: 13, marginTop: 2 },
  bannerCheckText: { color: colors.accentText },
  bannerDoneText: { color: colors.doneText },
  list: { flex: 1, marginTop: space.l },
  listContent: { paddingBottom: space.l },
  status: { ...type.caption, color: colors.inkMuted, textAlign: 'center', paddingTop: space.s },
  actions: { flexDirection: 'row', gap: 10, paddingVertical: space.l },
});
