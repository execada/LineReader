import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { documentQueue } from '../../entities/document/queue.ts';
import type { DocumentRecord } from '../../entities/document/record.ts';
import type { Line } from '../../entities/line/model.ts';
import { confirmLine, editLine, reviewProgress, skipLine } from '../../entities/line/review.ts';
import { rulesFor } from '../../entities/line/rules.ts';
import { readingOrder } from '../../entities/document/text.ts';
import { linesToSend } from '../../features/ask-server/askServer.ts';
import { colors, space } from '../../shared/theme/tokens.ts';
import { DocumentTopBar } from '../../widgets/document-top-bar/DocumentTopBar.tsx';
import { LineCard } from '../../widgets/line-card/LineCard.tsx';
import { ReviewProgress } from '../../widgets/review-progress/ReviewProgress.tsx';
import { ReviewActions } from './ReviewActions.tsx';
import { ReviewDone } from './ReviewDone.tsx';

/** Line-by-line review: the first line of the queue with its photo piece, until nothing is left. */
export function ReviewPage(props: {
  doc: DocumentRecord;
  onLines: (page: number, lines: Line[], learnedFrom?: { before: string; after: string }) => void;
  onExport: () => void;
  onAskServer: (() => void) | null;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const queue = documentQueue(props.doc);
  const current = queue[0];
  const topBar = <DocumentTopBar sentToServer={props.doc.sentToServer} onBack={props.onBack} />;

  if (!current) {
    return (
      <View style={styles.screen}>
        {topBar}
        <ReviewDone onAskServer={props.onAskServer} onExport={props.onExport} />
      </View>
    );
  }

  const { line, page, reasons } = current;
  const pageData = props.doc.pages[page]!;
  const apply = (next: Line[], learned?: { before: string; after: string }) => {
    setEditing(null);
    props.onLines(page, next, learned);
  };
  const confirm = () => apply(confirmLine(pageData.lines, line.id));
  const save = (text: string) =>
    apply(editLine(pageData.lines, line.id, text), {
      before: line.text,
      after: text,
    });

  const progress = reviewProgress(
    props.doc.pages.flatMap((p) => p.lines),
    rulesFor(props.doc.engine),
  );
  const lineNumber = [...pageData.lines].sort(readingOrder).findIndex((l) => l.id === line.id) + 1;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {topBar}
      <ReviewProgress done={progress.done} left={progress.left} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        <LineCard
          key={line.id}
          docId={props.doc.id}
          page={pageData}
          pageNumber={page + 1}
          lineNumber={lineNumber}
          line={line}
          reasons={reasons}
          editing={editing}
          onEditing={setEditing}
          onSave={save}
          onConfirm={confirm}
        />
      </ScrollView>
      <ReviewActions
        editing={editing !== null}
        serverLines={props.onAskServer ? linesToSend(props.doc).length : null}
        onSkip={() => apply(skipLine(pageData.lines, line.id))}
        onAskServer={() => props.onAskServer?.()}
        onEdit={() => setEditing(line.text)}
        onConfirm={confirm}
        onCancel={() => setEditing(null)}
        onSave={() => editing !== null && save(editing)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.xl },
  body: { flex: 1, marginTop: space.xl },
  bodyContent: { paddingBottom: space.l },
});
