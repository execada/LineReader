// iOS 27 SDK refuses to launch apps without the UIScene life cycle
// ("UIScene life cycle is required for apps built with this SDK").
// Expo SDK 57 ships ExpoAppSceneDelegate (objc name EXExpoAppSceneDelegate),
// but the prebuild template still starts React Native from the app delegate.
// This plugin registers the scene delegate and lets it start React Native.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const START_BLOCK = /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: 'EXExpoAppSceneDelegate' },
        ],
      },
    };
    return cfg;
  });
  return withAppDelegate(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes('ExpoReactNativeFactoryProvider')) {
      return cfg;
    }
    if (!START_BLOCK.test(src)) {
      throw new Error('withSceneLifecycle: AppDelegate template changed, cannot move React Native start to the scene delegate');
    }
    src = src.replace(START_BLOCK, '    // React Native is started by EXExpoAppSceneDelegate when the window scene connects.\n');
    src = src.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = withSceneLifecycle;
