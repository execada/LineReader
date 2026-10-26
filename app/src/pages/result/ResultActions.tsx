import { StyleSheet, View } from 'react-native';

import { space } from '../../shared/theme/tokens.ts';
import { Button } from '../../shared/ui/Button.tsx';

/** What can be done with the text right away; review is offered only when some lines need it. */
export function ResultActions(props: {
  toCheck: number;
  onCopy: () => void;
  onReview: () => void;
  onTranslate: () => void;
  onTypos: () => void;
  /** How many typos were found, or null while checking. */
  typos: number | null;
  onShare: () => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.actions}>
      <View style={styles.row}>
        <Button label="Копировать" onPress={props.onCopy} grow />
        <Button label="Перевести" variant="secondary" onPress={props.onTranslate} grow />
      </View>
      <View style={styles.row}>
        <Button label={props.typos ? `Опечатки ${props.typos}` : 'Опечатки'} variant="secondary" onPress={props.onTypos} grow />
        {props.toCheck > 0 && <Button label={`Сверить ${props.toCheck}`} variant="secondary" onPress={props.onReview} grow />}
      </View>
      <View style={styles.row}>
        <Button label="Поделиться" variant="quiet" onPress={props.onShare} grow />
        <Button label="Сохранить" variant="quiet" onPress={props.onSave} grow />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.s },
  row: { flexDirection: 'row', gap: space.s },
});
