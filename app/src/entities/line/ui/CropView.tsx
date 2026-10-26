import { Image, StyleSheet, View } from 'react-native';

import { cropBox } from '../geometry.ts';
import type { Quad } from '../model.ts';
import { colors } from '../../../shared/theme/tokens.ts';

/**
 * Shows one line of the page photo, scaled to the given width, by placing the
 * whole photo behind a window; nothing is cut or written to disk.
 */
export function CropView(props: { uri: string; quad: Quad; pageWidth: number; pageHeight: number; width: number; maxHeight?: number }) {
  const box = cropBox(props.quad, props.pageWidth, props.pageHeight);
  const scale = props.width / box.width;
  const height = Math.min(box.height * scale, props.maxHeight ?? 220);
  return (
    <View style={[styles.window, { width: props.width, height }]} accessibilityRole="image" accessibilityLabel="Кусок фото со строкой">
      <Image
        source={{ uri: props.uri }}
        style={[
          styles.photo,
          {
            width: props.pageWidth * scale,
            height: props.pageHeight * scale,
            left: -box.originX * scale,
            top: -box.originY * scale,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { position: 'absolute' },
  window: {
    overflow: 'hidden',
    backgroundColor: colors.paperDeep,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
