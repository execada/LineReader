import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme/tokens.ts';

/** The box of a checkbox; the row around it is the touch target and carries the accessibility state. */
export function CheckMark({ checked, size = 22 }: { checked: boolean; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size, borderRadius: size / 4 }, checked && styles.checked]}
    >
      {checked && <Text style={[styles.mark, { fontSize: size * 0.7 }]}>✓</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  checked: { backgroundColor: colors.ink },
  mark: { fontFamily: fonts.uiBold, color: colors.onInk },
});
