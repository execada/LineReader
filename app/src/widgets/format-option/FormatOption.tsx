import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '../../shared/theme/tokens.ts';

/** One file format to choose: a tag (PDF, TXT, CSV), its name and what is inside, as a radio row. */
export function FormatOption(props: { tag: string; title: string; detail: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: props.selected }}
      accessibilityLabel={`${props.title}. ${props.detail}`}
      onPress={props.onPress}
      style={[styles.row, props.selected && styles.selected]}
    >
      <View style={[styles.tag, props.selected && styles.tagSelected]}>
        <Text style={[styles.tagText, props.selected && styles.tagTextSelected]}>{props.tag}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{props.title}</Text>
        <Text style={styles.detail}>{props.detail}</Text>
      </View>
      <View style={[styles.radio, props.selected && styles.radioOn]}>{props.selected && <View style={styles.dot} />}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  selected: { borderWidth: 2, borderColor: colors.ink },
  tag: { width: 48, height: 48, borderRadius: space.m, backgroundColor: colors.paperDeep, alignItems: 'center', justifyContent: 'center' },
  tagSelected: { backgroundColor: colors.ink },
  tagText: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.ink },
  tagTextSelected: { color: colors.onInk },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.uiSemibold, fontSize: 16, color: colors.ink },
  detail: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkMuted },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.ink },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
});
