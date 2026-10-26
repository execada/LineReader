import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DocumentRecord } from '../../entities/document/record.ts';
import { colors, fonts, radius, space, type } from '../../shared/theme/tokens.ts';
import { summarize } from './summary.ts';

/** One saved text in «Мои тексты»: title, date, languages and how much is left to check. Long press deletes it. */
export function DocumentCard({ doc, onOpen, onDelete }: { doc: DocumentRecord; onOpen: () => void; onDelete: () => void }) {
  const s = summarize(doc);
  const date = new Date(doc.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Долгое нажатие — удалить"
      onPress={onOpen}
      onLongPress={() => confirmDelete(onDelete)}
      style={styles.card}
    >
      <Text style={styles.title} numberOfLines={1}>
        {s.title ?? 'Текст не найден'}
      </Text>
      <Text style={styles.meta}>
        {date} · {s.languages} · {doc.pages.length} стр.{doc.sentToServer > 0 ? ' · сервер' : ''}
      </Text>
      <View style={styles.progressRow}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(s.checkedShare * 100)}%` }]} />
        </View>
        {s.toCheck > 0 ? <Text style={styles.toCheck}>{s.toCheck} к сверке</Text> : <Text style={styles.checked}>сверено</Text>}
      </View>
    </Pressable>
  );
}

function confirmDelete(onDelete: () => void) {
  Alert.alert('Удалить документ?', 'Фото страниц и распознанный текст удалятся с телефона.', [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Удалить', style: 'destructive', onPress: onDelete },
  ]);
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  title: { fontFamily: fonts.uiSemibold, fontSize: 16, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted, marginTop: space.xs },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: space.s },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.paperDeep, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.done },
  toCheck: {
    fontFamily: fonts.uiSemibold,
    fontSize: 12,
    color: colors.accentText,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: space.s,
    paddingVertical: 3,
    borderRadius: radius.chip,
    overflow: 'hidden',
  },
  checked: { fontFamily: fonts.uiSemibold, fontSize: 12, color: colors.done },
});
