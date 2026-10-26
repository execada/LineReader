import { StyleSheet, Text, View } from 'react-native';

import { lines as linesWord } from '../../shared/lib/plural.ts';
import { colors, space, type } from '../../shared/theme/tokens.ts';

const MAX_SEGMENTS = 12;

/** «Сверить N строк из M» and a strip of segments: checked green, current accent, the rest grey. */
export function ReviewProgress({ done, left }: { done: number; left: number }) {
  const total = done + left;
  const segments = total <= MAX_SEGMENTS;
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Сверить {linesWord(left)}</Text>
        {done > 0 && <Text style={styles.total}>из {total}</Text>}
      </View>
      {segments ? (
        <View style={styles.strip} accessibilityLabel={`Сверено ${done} из ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.segment, i < done ? styles.done : i === done ? styles.current : styles.rest]} />
          ))}
        </View>
      ) : (
        <View style={[styles.segment, styles.rest, styles.bar]} accessibilityLabel={`Сверено ${done} из ${total}`}>
          <View style={[styles.fill, styles.done, { width: `${Math.round((done / total) * 100)}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { ...type.heading, color: colors.ink },
  total: { ...type.caption, fontSize: 14, color: colors.inkMuted },
  strip: { flexDirection: 'row', gap: 4, marginTop: space.m },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  bar: { marginTop: space.m, overflow: 'hidden' },
  fill: { height: 6 },
  done: { backgroundColor: colors.done },
  current: { backgroundColor: colors.accent },
  rest: { backgroundColor: colors.line },
});
