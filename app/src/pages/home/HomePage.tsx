import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DocumentRecord } from '../../entities/document/record.ts';
import type { Language } from '../../entities/language/languages.ts';
import { pickPhotos } from '../../features/capture/sources.ts';
import type { SourceImage } from '../../shared/lib/sourceImage.ts';
import { searchDocuments } from '../../features/search/search.ts';
import { colors, fonts, space, type } from '../../shared/theme/tokens.ts';
import { Button } from '../../shared/ui/Button.tsx';
import { ModeBadge } from '../../shared/ui/ModeBadge.tsx';
import { SearchField } from '../../shared/ui/SearchField.tsx';
import { DocumentCard } from '../../widgets/document-card/DocumentCard.tsx';
import { LanguagePicker } from '../../widgets/language-picker/LanguagePicker.tsx';

/** «Мои тексты»: saved texts with search, languages and the buttons that start a new text. */
export function HomePage(props: {
  documents: readonly DocumentRecord[];
  /** Languages with an on-device model on this phone. */
  available: readonly Language[];
  languages: readonly string[];
  onLanguages: (ids: string[]) => void;
  onImages: (images: SourceImage[]) => void;
  onCapture: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onSettings: () => void;
}) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pick = async () => {
    setError(null);
    try {
      const images = await pickPhotos();
      if (images.length > 0) props.onImages(images);
    } catch {
      setError('Не удалось открыть фото.');
    }
  };
  const empty = props.documents.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <ModeBadge sentToServer={0} />
        <Pressable accessibilityRole="button" onPress={props.onSettings} hitSlop={12}>
          <Text style={styles.link}>Сервер</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>Мои тексты</Text>
      <Text style={styles.lead}>Книги, вывески, экраны, записки, документы. Всё хранится только на этом телефоне.</Text>
      <LanguagePicker available={props.available} chosen={props.languages} onChange={props.onLanguages} />
      {!empty && <SearchField value={query} onChange={setQuery} label="Поиск по тексту" />}

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={searchDocuments(props.documents, query)}
        keyExtractor={(d) => d.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>{empty ? 'Текстов пока нет.' : 'Ничего не нашлось.'}</Text>}
        renderItem={({ item }) => <DocumentCard doc={item} onOpen={() => props.onOpen(item.id)} onDelete={() => props.onDelete(item.id)} />}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        <Button label="Из фото" variant="secondary" onPress={() => void pick()} />
        <Button label="Снять текст" onPress={props.onCapture} grow />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: space.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: space.l,
  },
  title: { ...type.title, color: colors.ink, marginTop: space.xl },
  link: {
    fontFamily: fonts.uiMedium,
    fontSize: 16,
    color: colors.inkMuted,
    textDecorationLine: 'underline',
  },
  lead: { ...type.body, color: colors.inkMuted, marginTop: space.s },
  list: { flex: 1, marginTop: space.l },
  listContent: { gap: 10 },
  empty: { fontFamily: fonts.ui, color: colors.inkMuted, marginTop: space.xl },
  error: {
    fontFamily: fonts.ui,
    color: colors.accentText,
    marginBottom: space.s,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: space.l,
    paddingBottom: space.l,
  },
});
