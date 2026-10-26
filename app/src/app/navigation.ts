/** Which screen is open; screens of one text carry its id. */
export type Screen =
  | { name: 'home' }
  | { name: 'capture' }
  | { name: 'busy'; message: string; cancellable: boolean }
  | { name: 'result'; id: string }
  | { name: 'text'; id: string }
  | { name: 'translate'; id: string }
  | { name: 'typos'; id: string }
  | { name: 'review'; id: string }
  | { name: 'consent'; id: string }
  | { name: 'export'; id: string }
  | { name: 'settings' }
  | { name: 'privacy'; back: Screen }
  | { name: 'about'; back: Screen };
