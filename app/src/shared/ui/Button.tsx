import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, touch, type } from '../theme/tokens.ts';

type Variant = 'primary' | 'secondary' | 'outline' | 'done' | 'quiet';

const look: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.ink, fg: colors.onInk, border: colors.ink },
  secondary: { bg: colors.card, fg: colors.ink, border: colors.line },
  outline: { bg: colors.card, fg: colors.ink, border: colors.ink },
  done: { bg: colors.done, fg: colors.card, border: colors.done },
  quiet: { bg: colors.paperDeep, fg: colors.ink, border: colors.paperDeep },
};

/** Main button: primary (ink), secondary (white), outline (white with ink border), done (green), quiet (paper). `grow` fills a row. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  grow = false,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  grow?: boolean;
}) {
  const v = look[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        grow && styles.grow,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[type.button, { color: v.fg }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.primary,
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
});
