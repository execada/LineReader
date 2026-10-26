import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Line } from '../../entities/line/model.ts';
import { colors, fonts, radius, space } from '../../shared/theme/tokens.ts';
import { SourceChip } from '../../shared/ui/SourceChip.tsx';

/**
 * Every line of the text in one card, each with who gave it its text. Lines
 * still to check are marked; a long press on a line hands it to onLongPress.
 */
export function LineList(props: { lines: readonly Line[]; toCheck: ReadonlySet<string>; onLongPress: (line: Line) => void }) {
  const lines = props.lines.filter((l) => l.text.trim().length > 0);
  return (
    <View style={styles.card}>
      {lines.map((line, i) => (
        <Pressable
          key={line.id}
          accessibilityRole="button"
          accessibilityHint="Долгое нажатие — скопировать строку"
          onLongPress={() => props.onLongPress(line)}
          style={({ pressed }) => [styles.row, i < lines.length - 1 && styles.divider, pressed && styles.pressed]}
        >
          <Text style={styles.text} selectable={false}>
            {line.text}
          </Text>
          <View style={styles.meta}>
            <SourceChip source={line.source} />
            {props.toCheck.has(line.id) && <Text style={styles.check}>к сверке</Text>}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingVertical: 6 },
  row: { paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.paperDeep },
  pressed: { backgroundColor: colors.paper },
  text: { fontFamily: fonts.mono, fontSize: 15, lineHeight: 22, color: colors.ink },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  check: { fontFamily: fonts.uiSemibold, fontSize: 11, color: colors.accentText },
});
