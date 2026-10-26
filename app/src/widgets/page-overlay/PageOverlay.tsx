import { Image, StyleSheet, View } from 'react-native';

import { pageImage } from '../../entities/document/files.ts';
import type { StoredPage } from '../../entities/document/record.ts';
import { cropBox } from '../../entities/line/geometry.ts';
import { colors } from '../../shared/theme/tokens.ts';

/**
 * The page photo fitted into width × maxHeight with every recognized line
 * highlighted: lines to check in the accent colour, the rest in blue.
 */
export function PageOverlay(props: { docId: string; page: StoredPage; toCheck: ReadonlySet<string>; width: number; maxHeight: number }) {
  const { page } = props;
  const scale = Math.min(props.width / page.width, props.maxHeight / page.height);
  return (
    <View
      style={[styles.frame, { width: page.width * scale, height: page.height * scale }]}
      accessibilityRole="image"
      accessibilityLabel="Снимок с подсвеченными строками"
    >
      <Image source={{ uri: pageImage(props.docId, page.image).uri }} style={StyleSheet.absoluteFill} resizeMode="stretch" />
      {page.lines.map((line) => {
        const box = cropBox(line.quad, page.width, page.height);
        return (
          <View
            key={line.id}
            style={[
              styles.mark,
              props.toCheck.has(line.id) ? styles.check : styles.read,
              { left: box.originX * scale, top: box.originY * scale, width: box.width * scale, height: box.height * scale },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', overflow: 'hidden', borderRadius: 4 },
  mark: { position: 'absolute', borderRadius: 3 },
  check: { backgroundColor: colors.accentHighlight },
  read: { backgroundColor: colors.lineHighlight },
});
