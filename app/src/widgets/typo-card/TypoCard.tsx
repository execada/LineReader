import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { pageImage } from '../../entities/document/files.ts';
import type { StoredPage } from '../../entities/document/record.ts';
import type { Line } from '../../entities/line/model.ts';
import { CropView } from '../../entities/line/ui/CropView.tsx';
import { bestSuggestion, type Typo } from '../../features/typos/typos.ts';
import { colors, fonts, radius, space } from '../../shared/theme/tokens.ts';
import { Button } from '../../shared/ui/Button.tsx';

const CARD_INSET = space.xl * 2 + 14 * 2 + 2;

/**
 * One typo: where it is, the piece of the photo, the line with the word underlined,
 * and what to do with it. When no suggestion is clearly the closest, all are offered equally.
 */
export function TypoCard(props: {
  docId: string;
  page: StoredPage;
  line: Line;
  lineNumber: number;
  typo: Typo;
  onReplace: (word: string) => void;
  onKeep: () => void;
}) {
  const { width } = useWindowDimensions();
  const { typo, line, page } = props;
  const suggestion = bestSuggestion(typo);
  const others = typo.suggestions.filter((s) => s !== suggestion);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.badge}>Опечатка · {typo.language.toUpperCase()}</Text>
        <Text style={styles.where}>
          Стр. {typo.page + 1} · строка {props.lineNumber}
        </Text>
      </View>
      <CropView
        uri={pageImage(props.docId, page.image).uri}
        quad={line.quad}
        pageWidth={page.width}
        pageHeight={page.height}
        width={width - CARD_INSET}
        maxHeight={64}
      />
      <Text style={styles.line}>
        {line.text.slice(0, typo.start)}
        <Text style={styles.word}>{typo.word}</Text>
        {line.text.slice(typo.start + typo.word.length)}
      </Text>
      {others.length > 0 && (
        <View style={styles.others}>
          <Text style={styles.where}>{suggestion ? 'или' : 'Варианты'}</Text>
          {others.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={`Заменить на «${s}»`}
              onPress={() => props.onReplace(s)}
              style={styles.other}
            >
              <Text style={styles.otherText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.actions}>
        {suggestion ? <Button label={`Заменить на «${suggestion}»`} onPress={() => props.onReplace(suggestion)} grow /> : null}
        <Button label="Оставить" variant="secondary" onPress={props.onKeep} grow={!suggestion} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    fontFamily: fonts.uiSemibold,
    fontSize: 12,
    color: colors.accentText,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: space.s,
    paddingVertical: 3,
    borderRadius: radius.chip,
    overflow: 'hidden',
  },
  where: { fontFamily: fonts.ui, fontSize: 12, color: colors.inkMuted },
  line: { fontFamily: fonts.mono, fontSize: 16, lineHeight: 24, color: colors.ink },
  word: {
    textDecorationLine: 'underline',
    textDecorationColor: colors.accent,
    textDecorationStyle: Platform.OS === 'ios' ? 'dotted' : 'solid',
    color: colors.accentText,
  },
  others: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s },
  other: {
    minHeight: 36,
    paddingHorizontal: space.m,
    justifyContent: 'center',
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.line,
  },
  otherText: { fontFamily: fonts.mono, fontSize: 14, color: colors.ink },
  actions: { flexDirection: 'row', gap: space.s },
});
