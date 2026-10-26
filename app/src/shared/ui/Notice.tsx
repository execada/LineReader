import { StyleSheet, Text } from 'react-native';

import { colors, fonts, space } from '../theme/tokens.ts';

/** A message across the top of the screen; tapping it hides it. */
export function Notice({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Text style={styles.notice} onPress={onClose} accessibilityRole="alert">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  notice: { fontFamily: fonts.ui, fontSize: 14, color: colors.ink, backgroundColor: colors.accentSoft, padding: space.l },
});
