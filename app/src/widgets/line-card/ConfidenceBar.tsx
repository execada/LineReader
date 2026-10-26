import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space } from '../../shared/theme/tokens.ts';

/** The engine's confidence in the line as a bar and a percentage; low values are in the accent colour. */
export function ConfidenceBar({ confidence }: { confidence: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  const low = percent < 100;
  return (
    <View style={styles.row}>
      <View style={styles.track}>
        <View style={[styles.fill, low ? styles.low : styles.high, { width: `${percent}%` }]} />
      </View>
      <Text style={[styles.text, low && styles.lowText]}>Уверенность {percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.paperDeep, overflow: 'hidden' },
  fill: { height: 6 },
  low: { backgroundColor: colors.accent },
  high: { backgroundColor: colors.done },
  text: { fontFamily: fonts.uiSemibold, fontSize: 13, color: colors.inkMuted },
  lowText: { color: colors.accentText },
});
