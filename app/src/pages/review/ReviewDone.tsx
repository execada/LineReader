import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space, type } from '../../shared/theme/tokens.ts';
import { Button } from '../../shared/ui/Button.tsx';

/** Shown when no line is left to check: the way to the server and to export. */
export function ReviewDone({ onAskServer, onExport }: { onAskServer: (() => void) | null; onExport: () => void }) {
  return (
    <>
      <View style={styles.done}>
        <Text style={styles.title}>Всё сверено</Text>
        <Text style={styles.text}>Строки без замечаний остались как их прочитал телефон.</Text>
      </View>
      <View style={styles.actions}>
        {onAskServer && <Button label="Уточнить на сервере" variant="secondary" onPress={onAskServer} />}
        <Button label="Сохранить TXT или PDF" onPress={onExport} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  done: { flex: 1, justifyContent: 'center' },
  title: { ...type.heading, color: colors.done },
  text: { fontFamily: fonts.ui, fontSize: 15, color: colors.inkMuted, marginTop: space.s },
  actions: { paddingBottom: space.l, paddingTop: space.s, gap: space.s },
});
