import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { loadDictionary, saveRecord, updateLines } from '../entities/document/files.ts';
import type { DocumentRecord } from '../entities/document/record.ts';
import type { Line } from '../entities/line/model.ts';
import { askServer } from '../features/ask-server/askServer.ts';
import { RemoteError, type RemoteConfig } from '../features/ask-server/client.ts';
import { useServer } from '../features/ask-server/useServer.ts';
import { useLearnWords } from '../features/dictionary/useLearnWords.ts';
import { recognizeNewDocument } from '../features/recognize/recognize.ts';
import type { SourceImage } from '../shared/lib/sourceImage.ts';
import { colors } from '../shared/theme/tokens.ts';
import { Notice } from '../shared/ui/Notice.tsx';
import type { Screen } from './navigation.ts';
import { Routes } from './Routes.tsx';
import { useAppFonts } from './useAppFonts.ts';
import { useBackNavigation } from './useBackNavigation.ts';
import { useDeviceLanguages } from './useDeviceLanguages.ts';
import { useLibrary } from './useLibrary.ts';

export default function App() {
  const fontsReady = useAppFonts();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [notice, setNotice] = useState<string | null>(null);
  const notify = useCallback((message: string) => setNotice(message), []);
  const library = useLibrary(notify);
  const languages = useDeviceLanguages(notify);
  const { server, save, forget, askEachTime, setAskEachTime } = useServer();
  const { learn, keep } = useLearnWords(notify);
  const sending = useRef<AbortController | null>(null);
  const stopSending = useCallback(() => sending.current?.abort(), []);
  useBackNavigation(screen, setScreen, stopSending);

  const recognize = async (images: SourceImage[]) => {
    setNotice(null);
    setScreen({ name: 'busy', message: 'Готовлю снимки…', cancellable: false });
    try {
      const rec = await recognizeNewDocument(images, languages.chosen, await loadDictionary(), (page, total) =>
        setScreen({
          name: 'busy',
          message: `Распознаю на телефоне: страница ${page} из ${total}`,
          cancellable: false,
        }),
      );
      library.add(rec);
      setScreen({ name: 'result', id: rec.id });
    } catch (e) {
      setNotice(e instanceof Error && e.message ? `Не получилось распознать: ${e.message}` : 'Не получилось распознать.');
      setScreen({ name: 'home' });
    }
  };

  const changeLines = (rec: DocumentRecord, page: number, lines: Line[], learned?: { before: string; after: string }) => {
    try {
      library.replace(updateLines(rec, page, lines));
    } catch {
      setNotice('Не удалось сохранить правку. Повторите.');
      return;
    }
    if (learned) learn(learned.before, learned.after);
  };

  const saveDoc = (rec: DocumentRecord) => {
    try {
      saveRecord(rec);
      library.replace(rec);
    } catch {
      setNotice('Не удалось сохранить правку. Повторите.');
    }
  };

  const send = async (rec: DocumentRecord, config: RemoteConfig, approved: ReadonlySet<string>) => {
    sending.current = new AbortController();
    setScreen({
      name: 'busy',
      message: 'Отправляю куски строк на сервер…',
      cancellable: true,
    });
    try {
      library.replace(await askServer(rec, config, approved, sending.current.signal));
      setNotice(null);
    } catch (e) {
      setNotice(e instanceof RemoteError ? e.message : 'Сервер не ответил. Строки остались распознанными на телефоне.');
    } finally {
      sending.current = null;
      setScreen({ name: 'review', id: rec.id });
    }
  };

  const dark = screen.name === 'capture' || screen.name === 'result';
  if (!fontsReady) return <View style={styles.fill} />;

  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <SafeAreaView
          style={[styles.fill, dark && styles.dark, (screen.name === 'consent' || screen.name === 'export') && styles.scrim]}
          edges={['top', 'bottom']}
        >
          <StatusBar style={dark ? 'light' : 'dark'} />
          {notice && <Notice message={notice} onClose={() => setNotice(null)} />}
          <Routes
            screen={screen}
            go={setScreen}
            docs={library.docs}
            available={languages.available}
            languages={languages.chosen}
            onLanguages={languages.setChosen}
            server={server}
            askEachTime={askEachTime}
            onAskEachTime={(ask) => void setAskEachTime(ask).catch(() => setNotice('Настройка не сохранилась.'))}
            onRecognize={recognize}
            onLines={changeLines}
            onDelete={library.remove}
            onSaveDoc={saveDoc}
            onKeepWord={keep}
            onSend={(doc, config, approved) => void send(doc, config, approved)}
            onStopSending={stopSending}
            onSaveServer={save}
            onForgetServer={forget}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  dark: { backgroundColor: colors.camera },
  scrim: { backgroundColor: colors.scrim },
});
