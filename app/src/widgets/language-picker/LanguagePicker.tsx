import { StyleSheet, Text, View } from 'react-native';

import type { Language } from '../../entities/language/languages.ts';
import { colors, fonts, space } from '../../shared/theme/tokens.ts';
import { Chip } from '../../shared/ui/Chip.tsx';

/** Recognition languages as chips; the last chosen language cannot be turned off. */
export function LanguagePicker(props: {
  available: readonly Language[];
  chosen: readonly string[];
  onChange: (ids: string[]) => void;
  /** Light chips over the camera, without the label. */
  onDark?: boolean;
}) {
  const toggle = (id: string) => {
    const next = props.chosen.includes(id) ? props.chosen.filter((l) => l !== id) : [...props.chosen, id];
    if (next.length > 0) props.onChange(next);
  };
  return (
    <View>
      {!props.onDark && <Text style={styles.label}>Языки текста</Text>}
      <View style={[styles.chips, props.onDark && styles.centered]}>
        {props.available.map((l) => (
          <Chip key={l.id} label={l.name} active={props.chosen.includes(l.id)} onPress={() => toggle(l.id)} onDark={props.onDark} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.inkMuted, marginTop: space.xl, marginBottom: space.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  centered: { justifyContent: 'center' },
});
