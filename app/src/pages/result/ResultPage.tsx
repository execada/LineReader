import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { documentQueue } from '../../entities/document/queue.ts';
import type { DocumentRecord } from '../../entities/document/record.ts';
import { documentText, linesInOrder } from '../../entities/document/text.ts';
import { copyDocumentText } from '../../features/copy-text/copyText.ts';
import { useTypos } from '../../features/typos/useTypos.ts';
import { lines as linesWord } from '../../shared/lib/plural.ts';
import { colors, fonts, radius, space } from '../../shared/theme/tokens.ts';
import { ModeBadge } from '../../shared/ui/ModeBadge.tsx';
import { PageOverlay } from '../../widgets/page-overlay/PageOverlay.tsx';
import { TextPreview } from '../../widgets/text-preview/TextPreview.tsx';
import { ResultActions } from './ResultActions.tsx';

const PHOTO_SHARE = 0.42;
const NO_WORDS: readonly string[] = [];

/**
 * Right after the shot: the photo with the found lines and the text under it,
 * ready to copy or share at once. Review is optional.
 */
export function ResultPage(props: {
  doc: DocumentRecord;
  onReview: () => void;
  onText: () => void;
  onTranslate: () => void;
  onTypos: () => void;
  onExport: () => void;
  onBack: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [status, setStatus] = useState<string | null>(null);
  const { doc } = props;
  const queue = documentQueue(doc);
  const toCheck = new Set(queue.map((item) => item.line.id));
  const lines = linesInOrder(doc);
  const first = doc.pages[0];
  const { typos } = useTypos(doc, NO_WORDS);

  const copy = async () => {
    try {
      setStatus((await copyDocumentText(doc)) ? 'Текст скопирован' : 'Копировать нечего: текст не найден.');
    } catch {
      setStatus('Не удалось скопировать текст.');
    }
  };
  const share = async () => {
    try {
      await Share.share({ message: documentText(doc) });
    } catch {
      setStatus('Не удалось открыть «Поделиться».');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" onPress={props.onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Мои тексты</Text>
        </Pressable>
        <ModeBadge sentToServer={doc.sentToServer} />
      </View>
      {first && <PageOverlay docId={doc.id} page={first} toCheck={toCheck} width={width - space.xl * 2} maxHeight={height * PHOTO_SHARE} />}
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Текст · {doc.languages.map((l) => l.toUpperCase()).join(' + ')}</Text>
          <Text style={styles.meta}>
            {linesWord(lines.length)}
            {doc.pages.length > 1 ? ` · ${doc.pages.length} стр.` : ''}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityHint="Открыть весь текст" onPress={props.onText}>
          <TextPreview lines={lines} />
        </Pressable>
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {status ?? (toCheck.size > 0 ? 'Копировать можно сразу, сверка по желанию.' : 'Сомнительных строк нет.')}
        </Text>
        <ResultActions
          toCheck={toCheck.size}
          onCopy={() => void copy()}
          onReview={props.onReview}
          onTranslate={props.onTranslate}
          onTypos={props.onTypos}
          typos={typos?.length ?? null}
          onShare={() => void share()}
          onSave={props.onExport}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.camera },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.xl, paddingTop: space.s },
  back: { fontFamily: fonts.uiMedium, fontSize: 16, color: colors.onInk },
  sheet: {
    marginTop: 'auto',
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.xl,
    paddingTop: 10,
    paddingBottom: space.l,
    gap: space.m,
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.sheetHandle, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: fonts.uiSemibold, fontSize: 15, color: colors.ink },
  meta: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkMuted },
  status: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkMuted },
});
