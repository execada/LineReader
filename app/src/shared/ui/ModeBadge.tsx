import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '../theme/tokens.ts';
import { pieces } from '../lib/plural.ts';

/** Always-visible label of where recognition happened: «Офлайн · телефон» or «Сервер · N кусков». */
export function ModeBadge({ sentToServer }: { sentToServer: number }) {
  const offline = sentToServer === 0;
  return (
    <View
      accessibilityLabel={offline ? 'Распознано на телефоне, без сети' : `На сервер отправлено кусков: ${sentToServer}`}
      style={[styles.badge, !offline && styles.server]}
    >
      <Text style={[styles.label, !offline && styles.serverLabel]}>
        {offline ? 'Офлайн · телефон' : `Сервер · ${pieces(sentToServer)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.chip,
    backgroundColor: colors.paperDeep,
  },
  server: { backgroundColor: colors.serverSoft },
  label: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.ink },
  serverLabel: { color: colors.server },
});
