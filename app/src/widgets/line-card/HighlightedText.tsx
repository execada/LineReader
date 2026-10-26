import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { highlightSegments } from '../../entities/line/highlight.ts';
import { colors } from '../../shared/theme/tokens.ts';

/** The line with letters that may be digits marked, e.g. «Петров [0]лег» or «SN-7[B]0[O]». */
export function HighlightedText({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  return (
    <Text style={style} accessibilityLabel={text}>
      {highlightSegments(text).map((s, i) =>
        s.suspicious ? (
          <Text key={i} style={styles.mark}>
            {s.text}
          </Text>
        ) : (
          s.text
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  mark: { backgroundColor: colors.accentSoft, color: colors.accentText },
});
