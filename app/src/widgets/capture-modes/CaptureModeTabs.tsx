import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CAPTURE_MODES, type CaptureModeId } from '../../features/capture/shots.ts';
import { colors, fonts, radius } from '../../shared/theme/tokens.ts';

/** ТЕКСТ / ДОКУМЕНТ / КНИГА switch over the camera. */
export function CaptureModeTabs({ mode, onChange }: { mode: CaptureModeId; onChange: (mode: CaptureModeId) => void }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Режим съёмки" style={styles.tabs}>
      {CAPTURE_MODES.map((m) => {
        const selected = m.id === mode;
        return (
          <Pressable
            key={m.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(m.id)}
            hitSlop={6}
            style={[styles.tab, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 4, alignSelf: 'center' },
  tab: { height: 32, paddingHorizontal: 12, borderRadius: radius.chip, justifyContent: 'center' },
  selected: { backgroundColor: colors.onCameraFill },
  label: { fontFamily: fonts.uiSemibold, fontSize: 13, letterSpacing: 0.4, color: colors.onCameraMuted },
  selectedLabel: { color: colors.accentSoft },
});
