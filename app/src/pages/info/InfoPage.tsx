import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Section } from '../../shared/content/privacy.ts';
import { colors, fonts, space, type } from '../../shared/theme/tokens.ts';
import { Button } from '../../shared/ui/Button.tsx';

/** A screen of plain text in sections: the privacy policy or «О программе». */
export function InfoPage(props: { title: string; subtitle?: string; sections: readonly Section[]; onBack: () => void }) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {props.title}
        </Text>
        {props.subtitle && <Text style={styles.subtitle}>{props.subtitle}</Text>}
        {props.sections.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.heading} accessibilityRole="header">
              {s.title}
            </Text>
            {s.paragraphs.map((p) => (
              <Text key={p} style={styles.paragraph}>
                {p}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <Button label="Назад" variant="secondary" onPress={props.onBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.xl },
  content: { paddingTop: space.l, paddingBottom: space.l, gap: space.l },
  title: { ...type.heading, color: colors.ink },
  subtitle: { ...type.caption, color: colors.inkMuted, marginTop: -space.s },
  section: { gap: space.s },
  heading: { fontFamily: fonts.uiSemibold, fontSize: 17, color: colors.ink },
  paragraph: { ...type.body, color: colors.ink },
  actions: { paddingVertical: space.l },
});
