import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space } from '../../shared/theme/tokens.ts';
import { ModeBadge } from '../../shared/ui/ModeBadge.tsx';

/** Back link (to the list unless told otherwise) and the badge that says where the text was recognized. */
export function DocumentTopBar({
  sentToServer,
  onBack,
  backLabel = 'Мои тексты',
}: {
  sentToServer: number;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>‹ {backLabel}</Text>
      </Pressable>
      <ModeBadge sentToServer={sentToServer} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.s },
  back: { fontFamily: fonts.uiMedium, fontSize: 16, color: colors.ink },
});
