import expoConfig from 'eslint-config-expo/flat.js';
import reactNative from 'eslint-plugin-react-native';

// Feature-Sliced layers from the bottom up: a layer imports only the layers below it,
// and slices of features, widgets and pages do not import each other.
const LAYERS = ['shared', 'entities', 'features', 'widgets', 'pages', 'app'];
const ISOLATED_SLICES = new Set(['features', 'widgets', 'pages']);

const layerRules = LAYERS.slice(0, -1).map((layer, i) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          ...LAYERS.slice(i + 1).map((upper) => ({
            group: [`**/${upper}/**`],
            message: `${layer} cannot import from ${upper}: a layer imports only the layers below it.`,
          })),
          ...(ISOLATED_SLICES.has(layer)
            ? [{ group: [`../../${layer}/**`, '../*/**', '!../../**'], message: `Slices of ${layer} do not import each other.` }]
            : []),
        ],
      },
    ],
  },
}));

export default [
  ...expoConfig,
  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-native': reactNative },
    rules: {
      'react-native/no-unused-styles': 'error',
      'react-native/no-inline-styles': 'error',
      'react-native/no-color-literals': 'error',
      'react-native/no-single-element-style-arrays': 'error',
    },
  },
  ...layerRules,
  { ignores: ['scripts/*', 'ios/*', 'android/*'] },
];
