import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { pageImage } from '../../entities/document/files.ts';
import type { StoredPage } from '../../entities/document/record.ts';
import type { Line } from '../../entities/line/model.ts';
import { reasonText } from '../../entities/line/reasonText.ts';
import type { Reason } from '../../entities/line/rules.ts';
import { CropView } from '../../entities/line/ui/CropView.tsx';
import { colors, fonts, radius, space, type } from '../../shared/theme/tokens.ts';
import { ConfidenceBar } from './ConfidenceBar.tsx';
import { HighlightedText } from './HighlightedText.tsx';

const SWIPE = 90;
const CARD_INSET = space.xl * 2 + 14 * 2 + 2;

/**
 * One line under review: where it is, its piece of the photo, the recognized
 * text with doubtful characters highlighted (or an editor for it), the
 * engine's confidence, why it is in the queue and other readings to pick from.
 * Swipe right confirms the line, swipe left opens the editor.
 */
export function LineCard(props: {
  docId: string;
  page: StoredPage;
  pageNumber: number;
  lineNumber: number;
  line: Line;
  reasons: readonly Reason[];
  /** Text in the editor, or null when the line is shown as read. */
  editing: string | null;
  onEditing: (text: string | null) => void;
  onSave: (text: string) => void;
  onConfirm: () => void;
}) {
  const { width } = useWindowDimensions();
  const { line, page, editing } = props;
  const others = line.candidates.filter((c) => c.text !== line.text);

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationX > SWIPE) props.onConfirm();
      else if (e.translationX < -SWIPE) props.onEditing(line.text);
    });

  const card = (
    <View style={styles.card} accessibilityHint="Свайп вправо — строка верна, свайп влево — исправить">
      <View style={styles.cardHeader}>
        <Text style={styles.small}>
          Стр. {props.pageNumber} · строка {props.lineNumber}
        </Text>
        <Text style={styles.small}>Кусок фото</Text>
      </View>
      <CropView
        uri={pageImage(props.docId, page.image).uri}
        quad={line.quad}
        pageWidth={page.width}
        pageHeight={page.height}
        width={width - CARD_INSET}
        maxHeight={120}
      />
      <Text style={[styles.small, styles.label]}>Распознано</Text>
      {editing === null ? (
        <HighlightedText text={line.text} style={styles.reading} />
      ) : (
        <TextInput
          style={[styles.reading, styles.input]}
          value={editing}
          onChangeText={props.onEditing}
          autoFocus
          multiline
          submitBehavior="submit"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="done"
          accessibilityLabel="Текст строки"
          onSubmitEditing={() => props.onSave(editing)}
        />
      )}
      <ConfidenceBar confidence={line.confidence} />
      {props.reasons.map((r) => (
        <Text key={r} style={styles.reason}>
          {reasonText(r, line)}
        </Text>
      ))}
    </View>
  );

  return (
    <View>
      {editing === null ? <GestureDetector gesture={swipe}>{card}</GestureDetector> : card}
      {editing === null && others.length > 0 && (
        <View style={styles.others}>
          <Text style={styles.small}>Другие варианты</Text>
          <View style={styles.chips}>
            {others.map((c) => (
              <Pressable key={c.text} onPress={() => props.onSave(c.text)} style={styles.candidate} accessibilityRole="button">
                <Text style={styles.candidateText}>{c.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card + 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    padding: 14,
    gap: space.s,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  small: { ...type.caption, fontSize: 12, color: colors.inkMuted },
  label: { marginTop: space.s },
  reading: {
    ...type.recognized,
    color: colors.ink,
    padding: space.m,
    borderRadius: space.m,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
  },
  input: { borderColor: colors.accent },
  reason: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkMuted },
  others: { marginTop: space.l, gap: space.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  candidate: {
    minHeight: 44,
    paddingHorizontal: space.l,
    justifyContent: 'center',
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  candidateText: { fontFamily: fonts.mono, fontSize: 15, color: colors.ink },
});
