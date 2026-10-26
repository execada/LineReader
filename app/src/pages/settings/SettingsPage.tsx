import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { RemoteConfig } from '../../features/ask-server/client.ts';
import { Button } from '../../shared/ui/Button.tsx';
import { colors, fonts, space, type } from '../../shared/theme/tokens.ts';

/** Server address and access token. Without them the app works fully offline. */
export function SettingsPage(props: {
  current: RemoteConfig | null;
  onSave: (config: RemoteConfig) => Promise<void>;
  onForget: () => Promise<void>;
  onBack: () => void;
  onPrivacy: () => void;
  onAbout: () => void;
}) {
  const [url, setUrl] = useState(props.current?.baseUrl ?? 'https://');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const key = token.trim() || props.current?.token || '';
    // Empty the secure field before the screen goes away: iOS offers to save a
    // secure field's text in Passwords when it disappears, and this key is not
    // the person's password.
    setToken('');
    try {
      // An empty field keeps the saved key.
      await props.onSave({ baseUrl: url.trim(), token: key });
    } catch (e) {
      setError(e instanceof TypeError ? 'Адрес сервера записан с ошибкой' : e instanceof Error ? e.message : 'Не удалось сохранить');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={styles.title}>Сервер</Text>
      <Text style={styles.text}>
        Нужен только для уточнения сомнительных строк. Без сервера всё распознаётся на телефоне. Ключ хранится в защищённом хранилище
        телефона.
      </Text>
      <Text style={styles.label}>Адрес</Text>
      <TextInput style={styles.input} value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <Text style={styles.label}>Ключ доступа</Text>
      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        autoComplete="off"
        placeholder={props.current ? 'сохранён, введите новый, чтобы заменить' : ''}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.links}>
        <Pressable accessibilityRole="link" onPress={props.onPrivacy} hitSlop={8}>
          <Text style={styles.link}>Политика конфиденциальности</Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={props.onAbout} hitSlop={8}>
          <Text style={styles.link}>О программе и лицензии</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        {props.current && <Button label="Забыть сервер" variant="quiet" onPress={props.onForget} />}
        <Button label="Сохранить" onPress={save} />
        <Button label="Назад" variant="secondary" onPress={props.onBack} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  links: { gap: space.m, marginTop: space.xl },
  link: { fontFamily: fonts.uiMedium, fontSize: 15, color: colors.ink, textDecorationLine: 'underline' },
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: space.xl,
    paddingTop: space.l,
  },
  title: { ...type.heading, color: colors.ink },
  text: { ...type.body, color: colors.inkMuted, marginTop: space.s },
  label: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: space.xl,
  },
  input: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: space.s,
  },
  error: { fontFamily: fonts.ui, color: colors.accentText, marginTop: space.l },
  actions: { marginTop: 'auto', paddingBottom: space.l, gap: space.s },
});
