import { StyleSheet, Text, View } from 'react-native';

import type { TranslatedParagraph } from '../../entities/document/record.ts';
import { colors, fonts, radius, space } from '../../shared/theme/tokens.ts';

const NUMBER = /(\d[\d\s.,:/-]*\d|\d)/u;

/** Numbers in the translation are marked so they are easy to check against the original. */
function Marked({ text }: { text: string }) {
  return (
    <Text style={styles.translated}>
      {text.split(NUMBER).map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={styles.number}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

/** Each paragraph as recognized and its translation under it. */
export function TranslationPairs({ paragraphs }: { paragraphs: readonly TranslatedParagraph[] }) {
  return (
    <View style={styles.list}>
      {paragraphs.map((p, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.original}>{p.text}</Text>
          <Marked text={p.translated} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: {
    padding: 14,
    gap: space.s,
    borderRadius: radius.card - 2,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  original: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  translated: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 23, color: colors.ink },
  number: { fontFamily: fonts.uiSemibold, color: colors.server, backgroundColor: colors.serverSoft },
});
