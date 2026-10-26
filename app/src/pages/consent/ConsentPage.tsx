import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DocumentRecord } from '../../entities/document/record.ts';
import { linesToSend } from '../../features/ask-server/askServer.ts';
import { pieces } from '../../shared/lib/plural.ts';
import { colors, fonts, radius, space, type } from '../../shared/theme/tokens.ts';
import { Button } from '../../shared/ui/Button.tsx';
import { CheckMark } from '../../shared/ui/CheckMark.tsx';
import { CropPicker } from '../../widgets/crop-picker/CropPicker.tsx';

const PROMISES = [
  'Остальной текст и целое фото остаются на телефоне',
  'Сервер удаляет куски сразу после ответа и ничего не пишет в журнал',
  'Передача только по защищённому соединению',
];

/**
 * Shows exactly what will leave the phone before anything is sent: the line
 * crops (never the photo), each of which can be unticked, and where they go.
 * Nothing is sent without the button.
 */
export function ConsentPage(props: {
  doc: DocumentRecord;
  serverHost: string;
  askEachTime: boolean;
  onAskEachTime: (ask: boolean) => void;
  onSend: (approvedIds: ReadonlySet<string>) => void;
  onCancel: () => void;
  onPrivacy: () => void;
}) {
  const targets = linesToSend(props.doc);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(targets.map((t) => t.line.id)));
  // The switch takes effect only with «Отправить»; «Не отправлять» leaves it as it was.
  const [ask, setAsk] = useState(props.askEachTime);
  const send = () => {
    if (ask !== props.askEachTime) props.onAskEachTime(ask);
    props.onSend(chosen);
  };
  const toggle = (id: string) => setChosen((ids) => (ids.has(id) ? new Set([...ids].filter((x) => x !== id)) : new Set([...ids, id])));

  return (
    <View style={styles.scrim}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.title}>Отправить {pieces(chosen.size)} на сервер?</Text>
          <Text style={styles.lead}>
            Сервер {props.serverHost} прочитает их другим движком. Его ответ не заменит текст: если он прочитает иначе, строка останется на
            сверке. Уйдёт только то, что отмечено ниже.
          </Text>
          <View style={styles.promises}>
            {PROMISES.map((p) => (
              <View key={p} style={styles.promise}>
                <Text style={styles.tick} accessibilityElementsHidden importantForAccessibility="no">
                  ✓
                </Text>
                <Text style={styles.promiseText}>{p}</Text>
              </View>
            ))}
          </View>
          <Pressable accessibilityRole="link" onPress={props.onPrivacy} hitSlop={8}>
            <Text style={styles.policy}>Политика конфиденциальности</Text>
          </Pressable>
          <CropPicker doc={props.doc} targets={targets} chosen={chosen} onToggle={toggle} />
        </ScrollView>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ask }}
          accessibilityLabel="Спрашивать каждый раз"
          onPress={() => setAsk((a) => !a)}
          style={styles.ask}
        >
          <CheckMark checked={ask} size={20} />
          <Text style={styles.askText}>Спрашивать каждый раз</Text>
        </Pressable>
        <View style={styles.actions}>
          <Button label={`Отправить ${pieces(chosen.size)}`} onPress={send} disabled={chosen.size === 0} />
          <Button label="Не отправлять, сверю сам" variant="quiet" onPress={props.onCancel} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.xl,
    paddingTop: 10,
    paddingBottom: space.l,
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.sheetHandle, alignSelf: 'center' },
  scroll: { flexShrink: 1 },
  content: { gap: space.l, paddingTop: space.xl, paddingBottom: space.l },
  title: { ...type.heading, fontSize: 24, color: colors.ink },
  lead: { ...type.body, color: colors.inkMuted },
  promises: { gap: 10 },
  policy: { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
  promise: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tick: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.done },
  promiseText: { flex: 1, fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.ink },
  ask: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  askText: { fontFamily: fonts.ui, fontSize: 14, color: colors.inkMuted },
  actions: { gap: space.s, marginTop: space.s },
});
