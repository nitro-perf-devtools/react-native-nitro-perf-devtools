# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

react-native-nitro-perf is a hybrid performance monitor for React Native that tracks UI FPS, JS FPS, RAM, JS heap, dropped frames, and stutter detection. It uses [Nitro Modules](https://github.com/nicklockwood/NitroModules) for synchronous JSI calls between JS and C++.

The library ships as two npm packages in a monorepo:
- **react-native-nitro-perf** — the core Nitro module (C++ + TS)
- **nitro-perf-devtools** — a Rozenite DevTools plugin for browser-based performance charts

## Common Commands

```bash
# Install dependencies (npm workspaces)
npm install

# TypeScript type-checking (whole monorepo)
npm run typecheck

# Lint
npm run lint

# Build the core package (react-native-builder-bob)
npm run build

# Run Nitrogen codegen (generates C++ bindings from TypeScript specs)
npm run codegen

# Run example app
npm run example:start          # Metro bundler
npm run example:ios            # iOS simulator
npm run example:android        # Android emulator
npm run example:prebuild       # Expo prebuild (generates ios/android native projects)

# Package-level commands
cd packages/react-native-nitro-perf
npx nitrogen                   # Run codegen directly
bob build                      # Build directly
rm -rf lib nitrogen/generated  # Clean build artifacts
```

## Architecture

```
React App (JS/TS)
├── usePerfMetrics() hook — auto-starts monitor, subscribes to updates, returns reactive state
├── <PerfOverlay /> — draggable floating widget (compact/expanded views)
└── Dev menu integration — toggle overlay from RN dev menu

Nitro Modules Bridge (JSI, synchronous)
└── HybridPerfMonitor (C++ core, singleton HybridObject)
    ├── FPSTracker (x2: UI thread + JS thread)
    │   └── Ring buffer, 1-second window frame counting (matches RCTFPSGraph.mm algorithm)
    ├── PlatformMetrics (abstract, platform-specific implementations)
    │   ├── iOS: CADisplayLink (UI+JS FPS), task_info/Mach APIs (RAM)
    │   └── Android: Choreographer via JNI (UI FPS), /proc/self/status (RAM)
    └── Timer thread — periodically notifies subscribers

DevTools (browser)
└── Rozenite plugin bridge (CDP) → Panel with Recharts (FPS line, memory area, stutter timeline)
```

**Key architectural detail**: On iOS, both UI and JS FPS are tracked natively via CADisplayLink. On Android, UI FPS uses Choreographer→JNI→C++, but JS FPS is tracked from the JS side using `requestAnimationFrame` → `reportJsFrameTick()`.

## Key Source Paths

- **Nitro spec** (defines the C++ bindings): `packages/react-native-nitro-perf/src/specs/nitro-perf.nitro.ts`
- **C++ core**: `packages/react-native-nitro-perf/cpp/` — HybridPerfMonitor, FPSTracker, PlatformMetrics
- **iOS native**: `packages/react-native-nitro-perf/cpp/PlatformMetrics_iOS.mm`
- **Android native**: `packages/react-native-nitro-perf/cpp/PlatformMetrics_Android.cpp` + `android/src/main/java/com/nitroperf/PerfMetricsProvider.kt`
- **Nitrogen config**: `packages/react-native-nitro-perf/nitro.json` — maps `PerfMonitor` → `HybridPerfMonitor`, namespace `nitroperf`
- **Podspec**: `packages/react-native-nitro-perf/NitroPerf.podspec` (iOS 13+, C++20)
- **Android build**: `packages/react-native-nitro-perf/android/build.gradle` + `CMakeLists.txt` (SDK 24+, C++20)

## Nitrogen Codegen Workflow

When changing the Nitro spec (`specs/nitro-perf.nitro.ts`):
1. Run `npm run codegen` (or `npx nitrogen` in the package directory)
2. This generates C++ bridge code in `nitrogen/generated/`
3. Generated files are gitignored (`nitrogen/generated/` in `.gitignore`)
4. The `nitro.json` autolinking config maps the TS `PerfMonitor` interface to the C++ `HybridPerfMonitor` class

## Build System

- **Monorepo**: npm workspaces (`packages/*` + `example`)
- **TS → JS**: react-native-builder-bob (outputs CommonJS, ESM, and TypeScript declarations)
- **C++ → native**: CMake (Android NDK) and CocoaPods (iOS)
- **Example app**: Expo 55 (React Native 0.83)
- **CI**: GitHub Actions — typecheck, lint, iOS build (macos-14), Android build (Java 17 + Gradle)

## Stutter Detection

A "stutter" is defined as a 1-second window with 4+ dropped frames (frames below target FPS). This is tracked in `FPSTracker.cpp` and surfaced through `PerfSnapshot.stutterCount`.
