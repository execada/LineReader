import { StyleSheet, Text, View } from 'react-native';

import type { Line } from '../../entities/line/model.ts';
import { lines as linesWord } from '../../shared/lib/plural.ts';
import { colors, fonts, radius, space } from '../../shared/theme/tokens.ts';

/** The first lines of the recognized text in the monospace font, with how many more follow. */
export function TextPreview({ lines, shown = 3 }: { lines: readonly Line[]; shown?: number }) {
  const visible = lines.filter((l) => l.text.trim().length > 0);
  const rest = visible.length - shown;
  return (
    <View style={styles.box}>
      {visible.length === 0 && <Text style={styles.muted}>Текст на снимке не найден.</Text>}
      {visible.slice(0, shown).map((l) => (
        <Text key={l.id} style={styles.line} numberOfLines={1}>
          {l.text}
        </Text>
      ))}
      {rest > 0 && <Text style={styles.muted}>ещё {linesWord(rest)} · весь текст ›</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.m, borderRadius: radius.field, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  line: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 22, color: colors.ink },
  muted: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 22, color: colors.inkMuted },
});
