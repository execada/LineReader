import { useEffect } from 'react';
import { BackHandler } from 'react-native';

import type { Screen } from './navigation.ts';

/** Android Back goes one screen up (review and export back to the text, the rest to the list) instead of closing the app; while sending it stops the upload. */
export function useBackNavigation(screen: Screen, go: (screen: Screen) => void, stopSending: () => void) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      switch (screen.name) {
        case 'home':
          return false;
        case 'busy':
          stopSending();
          return true;
        case 'privacy':
        case 'about':
          go(screen.back);
          return true;
        case 'consent':
          go({ name: 'review', id: screen.id });
          return true;
        case 'text':
        case 'translate':
        case 'typos':
        case 'review':
        case 'export':
          go({ name: 'result', id: screen.id });
          return true;
        default:
          go({ name: 'home' });
          return true;
      }
    });
    return () => sub.remove();
  }, [screen, go, stopSending]);
}
