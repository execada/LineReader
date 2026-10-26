import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '../theme/tokens.ts';

type LineSource = 'device' | 'server' | 'user';

const look: Record<LineSource, { bg: string; fg: string; label: string }> = {
  device: { bg: colors.paperDeep, fg: colors.inkMuted, label: 'телефон' },
  server: { bg: colors.serverSoft, fg: colors.server, label: 'сервер' },
  user: { bg: colors.ink, fg: colors.onInk, label: 'исправлено вами' },
};

/** Who gave the line its text: the phone, the server or the person. */
export function SourceChip({ source }: { source: LineSource }) {
  const v = look[source];
  return (
    <View style={[styles.chip, { backgroundColor: v.bg }]}>
      <Text style={[styles.label, { color: v.fg }]}>{v.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.chip },
  label: { fontFamily: fonts.uiSemibold, fontSize: 11 },
});
