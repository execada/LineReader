import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius, space } from '../theme/tokens.ts';

/** A toggle chip, for example a recognition language; `onDark` is for the camera screen. */
export function Chip({
  label,
  active,
  onPress,
  onDark = false,
  role = 'checkbox',
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  onDark?: boolean;
  /** «button» for a chip that does something once instead of switching on and off. */
  role?: 'checkbox' | 'button';
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'checkbox' ? { checked: active } : undefined}
      onPress={onPress}
      hitSlop={4}
      style={[styles.chip, onDark && styles.dark, active && (onDark ? styles.darkActive : styles.active)]}
    >
      <Text style={[styles.label, onDark && styles.darkLabel, active && (onDark ? styles.darkActiveLabel : styles.activeLabel)]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    justifyContent: 'center',
    marginRight: space.s,
    marginBottom: space.s,
  },
  active: { backgroundColor: colors.ink, borderColor: colors.ink },
  dark: { backgroundColor: colors.camera, borderColor: colors.onCameraLine },
  darkActive: { backgroundColor: colors.paper, borderColor: colors.paper },
  label: { fontFamily: fonts.ui, fontSize: 14, color: colors.ink },
  activeLabel: { fontFamily: fonts.uiSemibold, color: colors.onInk },
  darkLabel: { color: colors.onCameraMuted },
  darkActiveLabel: { fontFamily: fonts.uiSemibold, color: colors.ink },
});
