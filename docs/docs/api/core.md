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
| `configure(config)` | Set update interval, history size, target FPS |
| `reset()` | Clear all tracked data |

## `PerfSnapshot`

The metrics snapshot returned by `getMetrics()` and provided to subscribers:

```typescript
interface PerfSnapshot {
  uiFps: number;            // UI thread frames per second
  jsFps: number;            // JS thread frames per second
  ramBytes: number;         // Process resident memory
  jsHeapUsedBytes: number;  // JS heap used (Hermes)
  jsHeapTotalBytes: number; // JS heap total (Hermes)
  droppedFrames: number;    // Total dropped frames
  stutterCount: number;     // Seconds with 4+ dropped frames
  timestamp: number;        // Millisecond timestamp
}
```

## `PerfConfig`

Configuration options for `configure()`:

```typescript
interface PerfConfig {
  updateIntervalMs?: number;  // How often to notify subscribers (default: 500)
  maxHistorySamples?: number; // Ring buffer size (default: 60)
  targetFps?: number;         // Target frame rate (default: 60)
}
```
