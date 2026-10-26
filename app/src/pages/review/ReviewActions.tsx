import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space, type } from '../../shared/theme/tokens.ts';
import { Button } from '../../shared/ui/Button.tsx';

/**
 * Under the line: skip, ask the server about the lines left, edit, confirm;
 * while editing, cancel and save.
 */
export function ReviewActions(props: {
  editing: boolean;
  /** How many lines would go to the server, or null when no server is set up. */
  serverLines: number | null;
  onSkip: () => void;
  onAskServer: () => void;
  onEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (props.editing) {
    return (
      <View style={[styles.actions, styles.row]}>
        <Button label="Отмена" variant="quiet" onPress={props.onCancel} grow />
        <Button label="Сохранить" variant="done" onPress={props.onSave} grow />
      </View>
    );
  }
  return (
    <View style={styles.actions}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" onPress={props.onSkip} hitSlop={8} style={styles.link}>
          <Text style={styles.linkText}>Пропустить</Text>
        </Pressable>
        {props.serverLines !== null && props.serverLines > 0 && (
          <Pressable accessibilityRole="button" onPress={props.onAskServer} style={styles.server}>
            <Text style={styles.serverText}>Уточнить {props.serverLines} на сервере</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.row}>
        <Button label="Исправить" variant="outline" onPress={props.onEdit} grow />
        <Button label="Верно" variant="done" onPress={props.onConfirm} grow />
      </View>
      <Text style={styles.hint}>Свайп вправо: верно · влево: исправить</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { paddingBottom: space.l, paddingTop: space.m, gap: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: fonts.ui, fontSize: 15, color: colors.inkMuted },
  server: { minHeight: 44, paddingHorizontal: 14, borderRadius: radius.field, backgroundColor: colors.paperDeep, justifyContent: 'center' },
  serverText: { fontFamily: fonts.uiSemibold, fontSize: 14, color: colors.ink },
  hint: { ...type.caption, fontSize: 12, color: colors.inkMuted, textAlign: 'center' },
});
