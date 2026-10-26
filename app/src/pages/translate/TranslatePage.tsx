import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DocumentRecord } from '../../entities/document/record.ts';
import { languageById } from '../../entities/language/languages.ts';
import { copyTranslation } from '../../features/copy-text/copyText.ts';
import { defaultPair, TRANSLATION_LANGUAGES, type LanguagePair } from '../../features/translate/pair.ts';
import { isTranslationCurrent } from '../../features/translate/state.ts';
import { pairStatus, translateDocument } from '../../features/translate/translateDocument.ts';
import { phoneLanguage } from '../../shared/lib/phoneLanguage.ts';
import { colors, space, type } from '../../shared/theme/tokens.ts';
import { Button } from '../../shared/ui/Button.tsx';
import { Chip } from '../../shared/ui/Chip.tsx';
import { DocumentTopBar } from '../../widgets/document-top-bar/DocumentTopBar.tsx';
import { LanguagePairBar } from '../../widgets/language-pair/LanguagePairBar.tsx';
import { TranslationPairs } from '../../widgets/translation-pairs/TranslationPairs.tsx';

type Status = Awaited<ReturnType<typeof pairStatus>>;

const NOTES: Record<Status, string> = {
  installed: 'Перевод сделает телефон, без сети.',
  supported: 'Один раз скачается языковой пакет, дальше перевод работает без сети. Текст никуда не отправляется.',
  unsupported: 'Эту пару языков телефон не переводит.',
  unavailable: 'Перевод на телефоне работает с iOS 18.',
};

/** Translation of the text on the phone, paragraph by paragraph, with the original above each translation. */
export function TranslatePage(props: {
  doc: DocumentRecord;
  onSave: (doc: DocumentRecord) => void;
  onExport: () => void;
  onBack: () => void;
}) {
  const { doc } = props;
  const [pair, setPair] = useState<LanguagePair>(() =>
    doc.translation
      ? { source: doc.translation.source, target: doc.translation.target }
      : defaultPair(doc.languages, TRANSLATION_LANGUAGES.includes(phoneLanguage()) ? phoneLanguage() : 'ru'),
  );
  const [checked, setChecked] = useState<{ key: string; status: Status } | null>(null);
  const key = `${pair.source}>${pair.target}`;
  const status = checked?.key === key ? checked.status : null;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const ready = isTranslationCurrent(doc) && doc.translation?.source === pair.source && doc.translation.target === pair.target;

  useEffect(() => {
    let live = true;
    const pairKey = `${pair.source}>${pair.target}`;
    pairStatus(pair).then(
      (s) => live && setChecked({ key: pairKey, status: s }),
      () => live && setChecked({ key: pairKey, status: 'unsupported' }),
    );
    return () => {
      live = false;
    };
  }, [pair]);

  // The latest document and whether the screen is still open, for a translation that finishes later.
  const latest = useRef(doc);
  const open = useRef(true);
  useEffect(() => {
    latest.current = doc;
  }, [doc]);
  useEffect(
    () => () => {
      open.current = false;
    },
    [],
  );

  const translate = async () => {
    setBusy(true);
    setMessage(null);
    const from = doc;
    try {
      const next = await translateDocument(from, pair);
      // An edit made while translating wins; the translation is dropped and can be repeated.
      if (latest.current === from) props.onSave(next);
      else if (open.current) setMessage('Текст изменился во время перевода. Переведите ещё раз.');
    } catch (e) {
      if (open.current) setMessage(e instanceof Error && e.message ? e.message : 'Перевод не удался.');
    } finally {
      if (open.current) setBusy(false);
    }
  };
  const copy = async () => {
    try {
      setMessage((await copyTranslation(doc)) ? 'Перевод скопирован' : 'Копировать нечего.');
    } catch {
      setMessage('Не удалось скопировать перевод.');
    }
  };
  const chooseTarget = (target: string) => {
    setChoosing(false);
    setPair((p) => ({ source: p.source === target ? p.target : p.source, target }));
  };

  return (
    <View style={styles.screen}>
      <DocumentTopBar sentToServer={doc.sentToServer} onBack={props.onBack} backLabel="Текст" />
      <Text style={styles.title}>Перевод</Text>
      <LanguagePairBar
        source={pair.source}
        target={pair.target}
        onSwap={() => setPair((p) => ({ source: p.target, target: p.source }))}
        onTarget={() => setChoosing((c) => !c)}
      />
      {choosing && (
        <View style={styles.targets}>
          {TRANSLATION_LANGUAGES.filter((id) => id !== pair.target).map((id) => (
            <Chip key={id} label={languageById(id)?.name ?? id} active={false} role="button" onPress={() => chooseTarget(id)} />
          ))}
        </View>
      )}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {ready && doc.translation ? (
          <TranslationPairs paragraphs={doc.translation.paragraphs} />
        ) : (
          <Text style={styles.note}>{status ? NOTES[status] : 'Проверяю, переводит ли телефон эту пару…'}</Text>
        )}
      </ScrollView>
      {message && (
        <Text style={styles.message} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
      <View style={styles.actions}>
        {ready ? (
          <>
            <Button label="Сохранить" variant="secondary" onPress={props.onExport} />
            <Button label="Копировать перевод" onPress={() => void copy()} grow />
          </>
        ) : (
          <Button
            label={busy ? 'Перевожу…' : 'Перевести'}
            onPress={() => void translate()}
            disabled={busy || status === null || status === 'unsupported' || status === 'unavailable'}
            grow
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.xl },
  title: { ...type.heading, color: colors.ink, marginVertical: space.m },
  targets: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.m },
  body: { flex: 1, marginTop: space.l },
  bodyContent: { paddingBottom: space.l },
  note: { ...type.body, color: colors.inkMuted },
  message: { ...type.caption, color: colors.inkMuted, textAlign: 'center', paddingTop: space.s },
  actions: { flexDirection: 'row', gap: 10, paddingVertical: space.l },
});
