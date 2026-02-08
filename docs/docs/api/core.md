---
sidebar_position: 1
---

# Core API

## `getPerfMonitor(): PerfMonitor`

Returns the singleton Nitro HybridObject. All methods are synchronous JSI calls.

```typescript
import { getPerfMonitor } from '@nitroperf/core';

const monitor = getPerfMonitor();
monitor.start();
```

### Methods

| Method | Description |
|--------|-------------|
| `start()` | Start collecting metrics |
| `stop()` | Stop collecting metrics |
| `isRunning` | Whether the monitor is active |
| `getMetrics()` | Synchronous snapshot: FPS, RAM, heap, drops, stutters |
| `getHistory()` | FPS history ring buffer with min/max |
| `subscribe(cb)` | Register for periodic updates, returns subscription ID |
| `unsubscribe(id)` | Remove a subscription |
| `reportJsFrameTick(ts)` | Feed JS-side rAF timestamps (Android/Fabric) |
| `reportLongTask(durationMs)` | Report a long task (>50ms) detected by PerformanceObserver |
| `reportSlowEvent(durationMs)` | Report a slow event (>100ms) for INP tracking |
| `reportRender(actualDurationMs)` | Report a React Profiler render duration |
| `reportJsHeap(usedBytes, totalBytes)` | Report JS heap usage from Hermes or V8 |
| `configure(config)` | Set update interval, history size, target FPS |
| `reset()` | Clear all tracked data |

## `PerfSnapshot`

The metrics snapshot returned by `getMetrics()` and provided to subscribers:

```typescript
interface PerfSnapshot {
  uiFps: number;              // UI thread frames per second
  jsFps: number;              // JS thread frames per second
  ramBytes: number;           // Process resident memory
  jsHeapUsedBytes: number;    // JS heap used (Hermes/V8)
  jsHeapTotalBytes: number;   // JS heap total (Hermes/V8)
  droppedFrames: number;      // Total dropped frames
  stutterCount: number;       // Seconds with 4+ dropped frames
  timestamp: number;          // Millisecond timestamp
  longTaskCount: number;      // Cumulative tasks >50ms
  longTaskTotalMs: number;    // Cumulative ms spent in long tasks
  slowEventCount: number;     // Cumulative events >100ms (INP proxy)
  maxEventDurationMs: number; // Worst event duration (resets on reset())
  renderCount: number;        // Cumulative React Profiler renders
  lastRenderDurationMs: number; // Most recent render actualDuration
}
```

## `getArchInfo(): ArchInfo`

Returns information about the React Native architecture. Result is cached after first call.

```typescript
import { getArchInfo } from '@nitroperf/core';

const info = getArchInfo();
// { isFabric: true, isBridgeless: true, jsEngine: 'hermes', reactNativeVersion: '0.83.0' }
```

| Field | Type | Description |
|-------|------|-------------|
| `isFabric` | `boolean` | Whether Fabric renderer is active |
| `isBridgeless` | `boolean` | Whether running in bridgeless mode |
| `jsEngine` | `'hermes' \| 'v8' \| 'jsc'` | Detected JavaScript engine |
| `reactNativeVersion` | `string` | React Native version string |

## `getStartupTiming(): StartupTiming`

Returns app startup timing data. Tries W3C Performance API marks (RN 0.82+) first, then falls back to the legacy `__PERFORMANCE_LOGGER`.

```typescript
import { getStartupTiming } from '@nitroperf/core';

const timing = getStartupTiming();
if (timing.available) {
  console.log(`Native init: ${timing.nativeInitMs}ms`);
  console.log(`Bundle load: ${timing.bundleLoadMs}ms`);
  console.log(`TTI: ${timing.ttiMs}ms`);
}
```

| Field | Type | Description |
|-------|------|-------------|
| `available` | `boolean` | Whether timing data was found |
| `nativeInitMs` | `number?` | Time for native module initialization |
| `bundleLoadMs` | `number?` | Time to load and execute the JS bundle |
| `ttiMs` | `number?` | Time to interactive |

## `PerfConfig`

Configuration options for `configure()`:

```typescript
interface PerfConfig {
  updateIntervalMs?: number;  // How often to notify subscribers (default: 500)
  maxHistorySamples?: number; // Ring buffer size (default: 60)
  targetFps?: number;         // Target frame rate (default: 60)
}
```
