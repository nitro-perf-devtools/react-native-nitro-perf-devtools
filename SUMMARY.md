# Session Summary (2026-02-07)

## Objective
- Replace standard JS framerate profiling devtools with Nitro-based devtools in an Expo app.
- Diagnose why iOS simulator flow was failing and get runtime working.
- Move native fixes into an Expo config-plugin path (not manual one-off native edits).

## What I Actually Verified
- Used `agent-device` directly to inspect the simulator UI state.
- Confirmed the app was launchable and foregrounded as `Nitro Perf Example` (`com.nitroperf.example`).
- Captured real runtime failures from the redbox:
  - `No script URL provided ... unsanitizedScriptURLString = (null)` when Metro/bundle URL was unavailable.
  - `[runtime not ready] ... 'PlatformConstants' could not be found ... TurboModule interop: false` when Metro was running but TurboModule interop was not active.

## Key Changes Made
- Added an Expo config plugin for `react-native-nitro-perf`:
  - `packages/react-native-nitro-perf/app.plugin.js`
  - Sets `Info.plist` `ReactNativeReleaseLevel` (default `canary`).
  - Patches iOS `AppDelegate.swift` during prebuild to:
    - Insert `RCTEnableTurboModuleInterop(true)`.
    - Insert `RCTEnableTurboModuleInteropBridgeProxy(true)`.
    - Use `ExpoReactNativeFactoryObjC(delegate: ..., releaseLevel: RCTReleaseLevel.<...>)`.
- Registered plugin metadata in package:
  - `packages/react-native-nitro-perf/package.json`
  - Added:
    - `"app.plugin.js"` in `files`
    - `"expo": { "plugins": ["./app.plugin.js"] }`
- Wired plugin in example app config:
  - `example/app.json`
  - Added:
    - `"react-native-nitro-perf"` plugin with:
      - `"releaseLevel": "canary"`
      - `"enableTurboInterop": true`

## Validation Performed
- `npx expo config --type prebuild` succeeded and showed plugin registered.
- `npx expo prebuild --platform ios --clean --no-install` succeeded.
- Confirmed generated `example/ios/NitroPerfExample/AppDelegate.swift` contains plugin-injected interop + ObjC canary factory wiring.
- Ran `pod install` successfully after prebuild regeneration.

## Current Status
- Plugin-based approach is implemented and wired.
- iOS native project regenerated with plugin-applied `AppDelegate.swift`.
- Final full rebuild/runtime re-check was in progress when the run was interrupted by user.

## Intention Behind This Approach
- Keep fixes durable and reproducible for Expo-managed workflows.
- Avoid fragile/manual native file editing that gets overwritten on `expo prebuild`.
- Ensure Nitro/React Native runtime initialization gets the right release level + TurboModule interop at generation time.

## Remaining Immediate Step
- Re-run iOS build + launch and re-verify via `agent-device snapshot -i` that `PlatformConstants` redbox is gone.
