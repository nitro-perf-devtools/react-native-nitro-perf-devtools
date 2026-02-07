const {
  createRunOncePlugin,
  withAppDelegate,
  withInfoPlist,
} = require("@expo/config-plugins");

const pkg = require("./package.json");

function withNitroPerfInfoPlist(config, props) {
  const releaseLevel = props?.releaseLevel ?? "canary";

  return withInfoPlist(config, (config) => {
    config.modResults.ReactNativeReleaseLevel = releaseLevel;
    return config;
  });
}

function withNitroPerfAppDelegate(config, props) {
  const enableTurboInterop = props?.enableTurboInterop ?? true;

  if (!enableTurboInterop) {
    return config;
  }

  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== "swift") {
      return config;
    }

    let contents = config.modResults.contents;

    if (!contents.includes("import React")) {
      contents = contents.replace("import Expo", "import Expo\nimport React");
    }

    if (!contents.includes("RCTEnableTurboModuleInterop(true)")) {
      const appLaunchSignature =
        "didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil\n  ) -> Bool {";
      const interopSnippet = [
        "didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil",
        "  ) -> Bool {",
        "    // @nitroperf/core: ensure Expo canary enables TM interop before RN init",
        "    RCTEnableTurboModuleInterop(true)",
        "    RCTEnableTurboModuleInteropBridgeProxy(true)",
      ].join("\n");

      contents = contents.replace(appLaunchSignature, interopSnippet);
    }

    // Revert any previous ObjC factory override back to the Swift subclass.
    // ExpoReactNativeFactory reads ReactNativeReleaseLevel from Info.plist
    // and provides critical overrides (createRCTRootViewFactory, recreateRootView).
    if (contents.includes("ExpoReactNativeFactoryObjC(delegate: delegate, releaseLevel:")) {
      contents = contents.replace(
        /let factory = ExpoReactNativeFactoryObjC\(delegate: delegate, releaseLevel: [^)]+\)/,
        "let factory = ExpoReactNativeFactory(delegate: delegate)"
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

const withNitroPerf = (config, props = {}) => {
  config = withNitroPerfInfoPlist(config, props);
  config = withNitroPerfAppDelegate(config, props);
  return config;
};

module.exports = createRunOncePlugin(withNitroPerf, pkg.name, pkg.version);
