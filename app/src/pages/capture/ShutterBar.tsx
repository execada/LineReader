import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '../../shared/theme/tokens.ts';

/** Pages taken so far, the shutter and «Готово», which starts recognition. */
export function ShutterBar(props: { shots: number; busy: boolean; onShoot: () => void; onDone: () => void }) {
  return (
    <View style={styles.bar}>
      <View style={styles.counter} accessibilityLabel={`Снято страниц: ${props.shots}`}>
        <Text style={styles.counterText}>{props.shots}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Снять"
        accessibilityState={{ disabled: props.busy }}
        disabled={props.busy}
        onPress={props.onShoot}
        style={({ pressed }) => [styles.shutter, (pressed || props.busy) && styles.pressed]}
      >
        <View style={styles.shutterInner} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: props.shots === 0 }}
        disabled={props.shots === 0}
        onPress={props.onDone}
        style={[styles.done, props.shots === 0 && styles.disabled]}
      >
        <Text style={styles.doneText}>Готово</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 36 },
  counter: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.onCameraLine,
    backgroundColor: colors.onCameraFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: { fontFamily: fonts.uiSemibold, fontSize: 15, color: colors.onInk },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: colors.onInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.onInk },
  pressed: { opacity: 0.6 },
  done: { height: 52, paddingHorizontal: 16, borderRadius: radius.chip, backgroundColor: colors.accent, justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  doneText: { fontFamily: fonts.uiSemibold, fontSize: 15, color: colors.card },
});
