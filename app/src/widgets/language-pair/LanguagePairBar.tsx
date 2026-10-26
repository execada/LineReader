import { Pressable, StyleSheet, Text, View } from 'react-native';

import { languageById } from '../../entities/language/languages.ts';
import { colors, fonts, radius, space } from '../../shared/theme/tokens.ts';

const name = (id: string) => languageById(id)?.name ?? id.toUpperCase();

/** «Polski ⇄ Русский»: the source, a swap button and the target, which opens the list of targets. */
export function LanguagePairBar(props: { source: string; target: string; onSwap: () => void; onTarget: () => void }) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        <Text style={styles.label}>{name(props.source)}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Поменять языки местами" onPress={props.onSwap} style={styles.swap}>
        <Text style={styles.swapText}>⇄</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Выбрать язык перевода"
        onPress={props.onTarget}
        style={[styles.side, styles.target]}
      >
        <Text style={styles.label}>{name(props.target)} ▾</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  side: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.field,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  target: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  label: { fontFamily: fonts.uiSemibold, fontSize: 15, color: colors.ink },
  swap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  swapText: { fontFamily: fonts.uiBold, fontSize: 18, color: colors.onInk },
});
