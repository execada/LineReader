import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space } from '../theme/tokens.ts';
import { Button } from './Button.tsx';

/** Full-screen progress with an optional stop button. */
export function BusyView({ message, onStop }: { message: string; onStop: (() => void) | null }) {
  return (
    <View style={styles.busy}>
      <ActivityIndicator color={colors.ink} />
      <Text style={styles.text}>{message}</Text>
      {onStop && <Button label="Остановить" variant="secondary" onPress={onStop} />}
    </View>
  );
}

const styles = StyleSheet.create({
  busy: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.l, padding: space.l },
  text: { fontFamily: fonts.ui, fontSize: 16, color: colors.ink, textAlign: 'center' },
});
