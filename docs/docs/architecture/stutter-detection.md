---
sidebar_position: 2
---

# Stutter Detection

## What is a Stutter?

A **stutter** is defined as a 1-second window in which **4 or more frames are dropped** (i.e., frames that took longer than the target frame interval to render).

This threshold was chosen because:
- A single dropped frame is often imperceptible
- 2-3 dropped frames may cause a brief hitch but are common during normal operation
- 4+ dropped frames in a single second creates a noticeable visual stutter that users can feel

## How It's Tracked

Stutter detection is implemented in `FPSTracker.cpp`:

1. Each frame callback records the time since the last frame
2. If the elapsed time exceeds the target frame interval (e.g., 16.67ms for 60 FPS), it counts as a dropped frame
3. At the end of each 1-second window, if the drop count >= 4, the `stutterCount` is incremented
4. The stutter count persists across the monitor's lifetime until `reset()` is called

## Reading Stutter Data

```typescript
import { getPerfMonitor } from '@nitroperf/core';

const monitor = getPerfMonitor();
const snapshot = monitor.getMetrics();

console.log(`Stutters detected: ${snapshot.stutterCount}`);
console.log(`Total dropped frames: ${snapshot.droppedFrames}`);
```

Or via the React hook:

```typescript
const { metrics } = usePerfMetrics();
// metrics.stutterCount — cumulative stutter events
// metrics.droppedFrames — cumulative dropped frames
```

## Use Cases

- **Performance regression testing** — Assert that `stutterCount` stays below a threshold during automated UI tests
- **Production monitoring** — Log stutter events to analytics to identify real-world performance issues
- **Development profiling** — Use the DevTools stutter timeline to correlate stutters with specific user interactions
