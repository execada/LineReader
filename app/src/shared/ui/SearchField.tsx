import { StyleSheet, TextInput } from 'react-native';

import { colors, fonts, radius, space } from '../theme/tokens.ts';

/** Search input in the app style; `label` is both the placeholder and the accessibility label. */
export function SearchField({ value, onChange, label }: { value: string; onChange: (text: string) => void; label: string }) {
  return (
    <TextInput
      style={styles.field}
      value={value}
      onChangeText={onChange}
      placeholder={label}
      placeholderTextColor={colors.inkMuted}
      accessibilityLabel={label}
      autoCorrect={false}
      clearButtonMode="while-editing"
      returnKeyType="search"
    />
  );
}

const styles = StyleSheet.create({
  field: {
    height: 44,
    marginTop: space.l,
    paddingHorizontal: 14,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    fontFamily: fonts.ui,
    fontSize: 15,
    color: colors.ink,
  },
});
