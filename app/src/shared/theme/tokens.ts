// «Стол корректора» по макету: тёплая бумага и чернила, малиновый акцент для «сверить»,
// зелёный для «сверено», синий для сервера. Интерфейс — Golos Text, распознанный текст —
// IBM Plex Mono, чтобы различались 0/О и 1/l/I.
export const colors = {
  paper: '#F4F1EA',
  paperDeep: '#E6E0D2',
  card: '#FFFFFF',
  line: '#DDD6C6',
  ink: '#1C1B19',
  inkMuted: '#5C5850',
  accent: '#B8336A',
  accentSoft: '#F6DCE6',
  accentText: '#8A1F4B',
  done: '#2F6B4F',
  doneSoft: '#DCEADF',
  doneText: '#1F4A36',
  server: '#1F3F66',
  serverSoft: '#DDE6F2',
  onInk: '#F4F1EA',
  camera: '#141311',
  accentHighlight: 'rgba(184,51,106,0.24)',
  lineHighlight: 'rgba(47,111,168,0.18)',
  sheetHandle: '#C9C1B0',
  scrim: '#8F8A80',
  onCameraMuted: '#D9D3C6',
  onCameraFill: 'rgba(255,255,255,0.14)',
  onCameraLine: 'rgba(255,255,255,0.4)',
} as const;

export const fonts = {
  ui: 'GolosText_400Regular',
  uiMedium: 'GolosText_500Medium',
  uiSemibold: 'GolosText_600SemiBold',
  uiBold: 'GolosText_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const type = {
  title: { fontFamily: fonts.uiBold, fontSize: 34, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.uiBold, fontSize: 26 },
  body: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 21 },
  button: { fontFamily: fonts.uiSemibold, fontSize: 17 },
  caption: { fontFamily: fonts.ui, fontSize: 13 },
  recognized: { fontFamily: fonts.monoMedium, fontSize: 22, lineHeight: 30 },
} as const;

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 32 } as const;

export const radius = { chip: 999, field: 14, button: 18, card: 20, sheet: 32 } as const;

export const touch = { primary: 56 } as const;
