---
sidebar_position: 2
---

# usePerfMetrics

React hook that auto-starts the performance monitor and returns reactive state.

## Usage

```typescript
import { usePerfMetrics } from '@nitroperf/core';

const { metrics, history, isRunning, start, stop, reset } = usePerfMetrics(options);
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoStart` | `boolean` | `true` | Automatically start monitoring on mount |
| `updateIntervalMs` | `number` | `500` | How often metrics update (milliseconds) |
| `maxHistorySamples` | `number` | `60` | Number of history samples to retain |
| `targetFps` | `number` | `60` | Target frame rate for drop detection |

## Return Value

| Field | Type | Description |
|-------|------|-------------|
| `metrics` | `PerfSnapshot` | Current performance snapshot |
| `history` | `FPSHistory` | Ring buffer of recent FPS samples with min/max |
| `isRunning` | `boolean` | Whether the monitor is currently active |
| `start` | `() => void` | Start the monitor |
| `stop` | `() => void` | Stop the monitor |
| `reset` | `() => void` | Clear all tracked data |

## Example

```tsx
function PerformanceDebugger() {
  const { metrics, isRunning, start, stop } = usePerfMetrics({
    updateIntervalMs: 1000,
    targetFps: 120, // For ProMotion displays
  });

  return (
    <View>
      <Text>Status: {isRunning ? 'Running' : 'Stopped'}</Text>
      <Text>UI FPS: {metrics.uiFps}</Text>
      <Text>JS FPS: {metrics.jsFps}</Text>
      <Text>RAM: {(metrics.ramBytes / 1024 / 1024).toFixed(1)} MB</Text>
      <Button title={isRunning ? 'Stop' : 'Start'} onPress={isRunning ? stop : start} />
    </View>
  );
}
```
