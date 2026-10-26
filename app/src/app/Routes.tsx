import type { DocumentRecord } from '../entities/document/record.ts';
import type { Language } from '../entities/language/languages.ts';
import type { Line } from '../entities/line/model.ts';
import { linesToSend } from '../features/ask-server/askServer.ts';
import type { RemoteConfig } from '../features/ask-server/client.ts';
import type { SourceImage } from '../shared/lib/sourceImage.ts';
import { CapturePage } from '../pages/capture/CapturePage.tsx';
import { ConsentPage } from '../pages/consent/ConsentPage.tsx';
import { ExportPage } from '../pages/export/ExportPage.tsx';
import { InfoPage } from '../pages/info/InfoPage.tsx';
import { HomePage } from '../pages/home/HomePage.tsx';
import { ResultPage } from '../pages/result/ResultPage.tsx';
import { TranslatePage } from '../pages/translate/TranslatePage.tsx';
import { TyposPage } from '../pages/typos/TyposPage.tsx';
import { TextPage } from '../pages/text/TextPage.tsx';
import { ReviewPage } from '../pages/review/ReviewPage.tsx';
import { SettingsPage } from '../pages/settings/SettingsPage.tsx';
import { BusyView } from '../shared/ui/BusyView.tsx';
import { LICENSES } from '../shared/content/licenses.ts';
import { PRIVACY, PRIVACY_UPDATED } from '../shared/content/privacy.ts';
import type { Screen } from './navigation.ts';

/** Everything the screens read and the actions they call. */
export interface RoutesProps {
  screen: Screen;
  go: (screen: Screen) => void;
  docs: readonly DocumentRecord[];
  available: readonly Language[];
  languages: readonly string[];
  onLanguages: (ids: string[]) => void;
  server: RemoteConfig | null;
  askEachTime: boolean;
  onAskEachTime: (ask: boolean) => void;
  onRecognize: (images: SourceImage[]) => void;
  onLines: (doc: DocumentRecord, page: number, lines: Line[], learned?: { before: string; after: string }) => void;
  onDelete: (id: string) => void;
  onSaveDoc: (doc: DocumentRecord) => void;
  onKeepWord: (word: string) => void;
  onSend: (doc: DocumentRecord, server: RemoteConfig, approved: ReadonlySet<string>) => void;
  onStopSending: () => void;
  onSaveServer: (config: RemoteConfig) => Promise<void>;
  onForgetServer: () => Promise<void>;
}

/** Shows the page for the current screen. */
export function Routes(p: RoutesProps) {
  const { screen, go, server } = p;
  const home = () => go({ name: 'home' });
  if (screen.name === 'home') {
    return (
      <HomePage
        documents={p.docs}
        available={p.available}
        languages={p.languages}
        onLanguages={p.onLanguages}
        onImages={p.onRecognize}
        onCapture={() => go({ name: 'capture' })}
        onOpen={(id) => go({ name: 'result', id })}
        onDelete={p.onDelete}
        onSettings={() => go({ name: 'settings' })}
      />
    );
  }
  if (screen.name === 'capture') {
    return (
      <CapturePage available={p.available} languages={p.languages} onLanguages={p.onLanguages} onDone={p.onRecognize} onClose={home} />
    );
  }
  if (screen.name === 'busy') {
    return <BusyView message={screen.message} onStop={screen.cancellable ? p.onStopSending : null} />;
  }
  if (screen.name === 'privacy') {
    return (
      <InfoPage
        title="Политика конфиденциальности"
        subtitle={`Обновлена ${PRIVACY_UPDATED}`}
        sections={PRIVACY}
        onBack={() => go(screen.back)}
      />
    );
  }
  if (screen.name === 'about') {
    return (
      <InfoPage
        title="О программе"
        subtitle="Сверка — распознавание, перевод и проверка текста с фото"
        sections={LICENSES}
        onBack={() => go(screen.back)}
      />
    );
  }
  if (screen.name === 'settings') {
    return (
      <SettingsPage
        current={server}
        onSave={async (config) => {
          await p.onSaveServer(config);
          home();
        }}
        onForget={p.onForgetServer}
        onBack={home}
        onPrivacy={() => go({ name: 'privacy', back: screen })}
        onAbout={() => go({ name: 'about', back: screen })}
      />
    );
  }
  const doc = p.docs.find((d) => d.id === screen.id);
  if (!doc) return null;
  const toReview = () => go({ name: 'review', id: doc.id });
  switch (screen.name) {
    case 'result':
      return (
        <ResultPage
          doc={doc}
          onReview={() => go({ name: 'review', id: doc.id })}
          onText={() => go({ name: 'text', id: doc.id })}
          onTranslate={() => go({ name: 'translate', id: doc.id })}
          onTypos={() => go({ name: 'typos', id: doc.id })}
          onExport={() => go({ name: 'export', id: doc.id })}
          onBack={home}
        />
      );
    case 'translate':
      return (
        <TranslatePage
          doc={doc}
          onSave={p.onSaveDoc}
          onExport={() => go({ name: 'export', id: doc.id })}
          onBack={() => go({ name: 'result', id: doc.id })}
        />
      );
    case 'typos':
      return <TyposPage doc={doc} onSave={p.onSaveDoc} onKeep={p.onKeepWord} onBack={() => go({ name: 'result', id: doc.id })} />;
    case 'text':
      return (
        <TextPage
          doc={doc}
          onReview={() => go({ name: 'review', id: doc.id })}
          onExport={() => go({ name: 'export', id: doc.id })}
          onBack={home}
        />
      );
    case 'review':
      return (
        <ReviewPage
          doc={doc}
          onLines={(page, lines, learned) => p.onLines(doc, page, lines, learned)}
          onExport={() => go({ name: 'export', id: doc.id })}
          onAskServer={
            server
              ? () =>
                  p.askEachTime
                    ? go({ name: 'consent', id: doc.id })
                    : p.onSend(doc, server, new Set(linesToSend(doc).map((t) => t.line.id)))
              : null
          }
          onBack={home}
        />
      );
    case 'consent':
      return server ? (
        <ConsentPage
          doc={doc}
          serverHost={new URL(server.baseUrl).host}
          askEachTime={p.askEachTime}
          onAskEachTime={p.onAskEachTime}
          onSend={(approved) => p.onSend(doc, server, approved)}
          onCancel={toReview}
          onPrivacy={() => go({ name: 'privacy', back: screen })}
        />
      ) : null;
    case 'export':
      return <ExportPage doc={doc} onBack={() => go({ name: 'result', id: doc.id })} />;
  }
}
