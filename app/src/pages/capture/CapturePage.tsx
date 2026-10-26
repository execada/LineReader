import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Language } from '../../entities/language/languages.ts';
import { addShots, CAPTURE_MODES, MAX_SHOTS, type CaptureModeId } from '../../features/capture/shots.ts';
import { cameraErrorText, scanDocument } from '../../features/capture/sources.ts';
import type { SourceImage } from '../../shared/lib/sourceImage.ts';
import { colors, fonts, space, type } from '../../shared/theme/tokens.ts';
import { Button } from '../../shared/ui/Button.tsx';
import { CaptureModeTabs } from '../../widgets/capture-modes/CaptureModeTabs.tsx';
import { LanguagePicker } from '../../widgets/language-picker/LanguagePicker.tsx';
import { CameraTopBar } from './CameraTopBar.tsx';
import { ShutterBar } from './ShutterBar.tsx';

/**
 * Camera for any text: pick the mode and languages, take one or more pages,
 * then «Готово» hands them to recognition. «Документ» uses the system scanner,
 * which finds the sheet edges and straightens the page.
 */
export function CapturePage(props: {
  available: readonly Language[];
  languages: readonly string[];
  onLanguages: (ids: string[]) => void;
  onDone: (images: SourceImage[]) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [mode, setMode] = useState<CaptureModeId>('text');
  const [shots, setShots] = useState<readonly SourceImage[]>([]);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const current = CAPTURE_MODES.find((m) => m.id === mode)!;

  const add = (added: readonly SourceImage[]) => {
    const next = addShots(shots, added);
    setShots(next.shots);
    setMessage(next.dropped > 0 ? `В одном тексте до ${MAX_SHOTS} страниц, лишние снимки не добавлены.` : null);
  };

  const shoot = async () => {
    setBusy(true);
    try {
      if (current.straighten) {
        add(await scanDocument());
      } else {
        const photo = await camera.current?.takePictureAsync({ quality: 0.9 });
        if (photo) add([{ uri: photo.uri, width: photo.width, height: photo.height }]);
      }
    } catch (e) {
      setMessage(cameraErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (permission && !permission.granted) {
    return (
      <View style={[styles.screen, styles.denied]}>
        <Text style={styles.deniedText}>
          {permission.canAskAgain
            ? 'Камера нужна, чтобы снять текст. Снимок распознаётся на телефоне и никуда не уходит.'
            : 'Доступ к камере выключен. Включите его в настройках телефона или выберите снимок из фото.'}
        </Text>
        {permission.canAskAgain && <Button label="Разрешить камеру" onPress={() => void requestPermission()} />}
        <Button label="Назад" variant="quiet" onPress={props.onClose} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
      <CameraTopBar torch={torch} onTorch={() => setTorch((t) => !t)} onClose={props.onClose} />
      <View style={styles.bottom}>
        <Text style={styles.hint}>{message ?? current.hint}</Text>
        <LanguagePicker available={props.available} chosen={props.languages} onChange={props.onLanguages} onDark />
        <CaptureModeTabs mode={mode} onChange={setMode} />
        <ShutterBar shots={shots.length} busy={busy} onShoot={() => void shoot()} onDone={() => props.onDone([...shots])} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.camera },
  bottom: { marginTop: 'auto', gap: space.l, paddingBottom: space.l },
  hint: { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.onCameraMuted, textAlign: 'center', paddingHorizontal: space.xl },
  denied: { justifyContent: 'center', padding: space.xl, gap: space.l },
  deniedText: { ...type.body, color: colors.onInk },
});
