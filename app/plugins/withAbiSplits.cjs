// A universal APK carries the native libraries (Tesseract, ML Kit, React Native)
// for four CPU types and weighs over 200 MB. This plugin also builds one APK per
// CPU type for installing by hand; Google Play gets the App Bundle and splits it itself.
const { withAppBuildGradle } = require('expo/config-plugins');

const SPLITS = `
    splits {
        abi {
            enable true
            reset()
            include "arm64-v8a", "armeabi-v7a", "x86_64"
            universalApk true
        }
    }
`;

function withAbiSplits(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes('splits {')) {
      cfg.modResults.contents = cfg.modResults.contents.replace(/^android \{\n/m, (start) => start + SPLITS);
    }
    return cfg;
  });
}

module.exports = withAbiSplits;
