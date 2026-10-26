import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '../../shared/theme/tokens.ts';

/** Close, the offline note and the torch switch over the camera. */
export function CameraTopBar(props: { torch: boolean; onTorch: () => void; onClose: () => void }) {
  return (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={props.onClose} style={styles.round}>
        <Text style={styles.icon}>✕</Text>
      </Pressable>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Без сети, всё на телефоне</Text>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Подсветка"
        accessibilityState={{ checked: props.torch }}
        onPress={props.onTorch}
        style={[styles.pill, props.torch && styles.on]}
      >
        <Text style={[styles.pillText, props.torch && styles.pillTextOn]}>Свет</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.s },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.onCameraFill, alignItems: 'center', justifyContent: 'center' },
  icon: { fontFamily: fonts.uiSemibold, fontSize: 18, color: colors.onInk },
  pill: { height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.onCameraFill, justifyContent: 'center' },
  on: { backgroundColor: colors.paper },
  pillText: { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.onInk },
  pillTextOn: { color: colors.ink },
  badge: { paddingHorizontal: 12, paddingVertical: space.s, borderRadius: radius.chip, backgroundColor: colors.onCameraFill },
  badgeText: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.onInk },
});
