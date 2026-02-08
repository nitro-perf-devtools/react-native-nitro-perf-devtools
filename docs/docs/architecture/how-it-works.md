---
sidebar_position: 1
---

# How It Works

NitroPerf uses a C++ core powered by [Nitro Modules](https://github.com/mrousavy/nitro) for synchronous JSI calls between JavaScript and native code. This means there is zero bridge overhead when reading metrics.

## iOS

| Metric | Implementation |
|--------|---------------|
| **UI FPS** | `CADisplayLink` on `NSRunLoopCommonModes` |
| **JS FPS** | `CADisplayLink` on JS thread (Bridge) or JS-side `requestAnimationFrame` (Fabric) |
| **RAM** | `task_info(TASK_VM_INFO)` → `phys_footprint` |

## Android

| Metric | Implementation |
|--------|---------------|
| **UI FPS** | `Choreographer.FrameCallback` → JNI → C++ FPSTracker |
| **JS FPS** | JS-side `requestAnimationFrame` → `reportJsFrameTick()` |
| **RAM** | `/proc/self/status` → `VmRSS` |

:::info Platform Difference
On iOS, both UI and JS FPS are tracked natively via `CADisplayLink`. On Android, UI FPS uses the Choreographer via JNI, but JS FPS must be tracked from the JavaScript side using `requestAnimationFrame` feeding timestamps to `reportJsFrameTick()`.
:::

## FPS Algorithm

NitroPerf uses the same approach as React Native's built-in `RCTFPSGraph.mm`:

1. Count frame callbacks received within a 1-second window
2. Compute FPS as `round(frameCount / elapsed)`
3. Store results in a ring buffer (last N seconds of samples)

This provides a stable, human-readable FPS value that matches what developers see in React Native's built-in performance monitor.

## JS Heap Metrics

JS heap metrics (`jsHeapUsedBytes`, `jsHeapTotalBytes`) are polled every 2 seconds from the JS side. On Hermes, `HermesInternal.getRuntimeProperties()` provides heap data. On V8/JSC, `performance.memory` is used as a fallback. Values are reported to C++ via `reportJsHeap()` and included in every `PerfSnapshot`.

## New Architecture Metrics

NitroPerf leverages W3C Performance APIs available in React Native 0.82+ to provide additional metrics:

### Long Tasks

`PerformanceObserver` with `type: 'longtask'` detects JavaScript tasks that block the thread for >50ms. Each detection calls `reportLongTask(duration)` which increments atomic counters in C++. Surfaced as `longTaskCount` and `longTaskTotalMs` in `PerfSnapshot`.

### Event Timing (INP Proxy)

`PerformanceObserver` with `type: 'event'` monitors event processing latency. Events taking >100ms are reported via `reportSlowEvent(duration)`. The worst duration is tracked via a compare-and-swap (CAS) atomic update. Surfaced as `slowEventCount` and `maxEventDurationMs`.

### React Profiler

The opt-in `<PerfProfiler>` component wraps `React.Profiler` and calls `reportRender(actualDuration)` on each render. Surfaced as `renderCount` and `lastRenderDurationMs`.

### Graceful Degradation

All observers are wrapped in try/catch and check for method existence on the native module at startup. If the native binary hasn't been rebuilt (JS updated via Metro hot reload but C++ unchanged), observers silently skip. This prevents crashes during development when the JS and native layers are out of sync.

## Architecture Detection

`getArchInfo()` detects the current React Native architecture at runtime:
- **Fabric** — checks `global.nativeFabricUIManager`
- **Bridgeless** — checks `__turboModuleProxy && !__fbBatchedBridge`
- **JS Engine** — checks `HermesInternal` / `_v8runtime` / defaults to JSC
- **RN Version** — reads `Platform.constants.reactNativeVersion`

## Startup Timing

`getStartupTiming()` captures app startup metrics:
1. First tries W3C `performance.getEntriesByType('mark')` for native init, bundle load, and TTI marks (RN 0.82+)
2. Falls back to `__PERFORMANCE_LOGGER.getTimespans()` for older RN versions
3. Returns `{ available: false }` if neither API exists
