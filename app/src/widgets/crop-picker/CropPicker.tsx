import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { pageImage } from '../../entities/document/files.ts';
import type { DocumentRecord } from '../../entities/document/record.ts';
import type { Line } from '../../entities/line/model.ts';
import { CropView } from '../../entities/line/ui/CropView.tsx';
import { colors, radius, space } from '../../shared/theme/tokens.ts';
import { CheckMark } from '../../shared/ui/CheckMark.tsx';

const ROW_INSET = space.xl * 2 + space.m * 2 + 22 + space.m + 2;

/** Every crop that could be sent, as it will be sent, each with its own checkbox. */
export function CropPicker(props: {
  doc: DocumentRecord;
  targets: readonly { page: number; line: Line }[];
  chosen: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const { width } = useWindowDimensions();
  return (
    <View style={styles.list}>
      {props.targets.map(({ page, line }) => {
        const p = props.doc.pages[page]!;
        const checked = props.chosen.has(line.id);
        return (
          <Pressable
            key={line.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={`Кусок со строкой «${line.text}»`}
            onPress={() => props.onToggle(line.id)}
            style={styles.row}
          >
            <CheckMark checked={checked} />
            <CropView
              uri={pageImage(props.doc.id, p.image).uri}
              quad={line.quad}
              pageWidth={p.width}
              pageHeight={p.height}
              width={width - ROW_INSET}
              maxHeight={56}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    borderRadius: radius.field + 2,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
});
