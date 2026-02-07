# @nitroperf/core

Hybrid performance monitor for React Native — UI FPS, JS FPS, RAM, JS heap, dropped frames, and stutter detection, powered by [Nitro Modules](https://github.com/nicklockwood/NitroModules).

## Demo
<img width="301" height="655" alt="Simulator Screenshot - iPhone 17 Pro - 2026-02-07 at 10 06 27" src="https://github.com/user-attachments/assets/d6d92347-bda6-46be-911e-f816bb421771" />


## Architecture

```
┌──────────────────────────────────┐
│  Nitro HybridObject (C++)        │
│  CADisplayLink / Choreographer   │
│  FPSTracker ring buffers         │
│  Memory via Mach/proc APIs       │
├──────────┬───────────────────────┤
│          │                       │
▼          ▼                       ▼
RN Overlay    usePerfMetrics()     Rozenite DevTools
(on-device)   (React hook)         ──► CDP bridge ──► Panel (Recharts)
```

**Three consumption modes:**
1. **On-device overlay** — draggable floating widget showing FPS + RAM
2. **React hook** — `usePerfMetrics()` returns reactive performance state
3. **Rozenite DevTools panel** — rich web charts (FPS line chart, memory area chart, stutter timeline)

## Quick Start

```bash
# Install
npm install @nitroperf/core react-native-nitro-modules

# iOS
cd ios && pod install

# Optional: Rozenite DevTools panel
npm install @nitroperf/devtools
```

```tsx
import { PerfOverlay, usePerfMetrics, registerDevMenuItem } from '@nitroperf/core';

function App() {
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => { registerDevMenuItem(setShowOverlay); }, []);

  return (
    <View style={{ flex: 1 }}>
      <YourApp />
      <PerfOverlay visible={showOverlay} onClose={() => setShowOverlay(false)} />
    </View>
  );
}
```

## API Reference

### `getPerfMonitor(): PerfMonitor`

Returns the singleton Nitro HybridObject. All methods are synchronous JSI calls.

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

### `usePerfMetrics(options?): UsePerfMetricsReturn`

React hook that auto-starts the monitor and returns reactive state.

```typescript
const { metrics, history, isRunning, start, stop, reset } = usePerfMetrics({
  autoStart: true,        // default: true
  updateIntervalMs: 500,  // default: 500
  maxHistorySamples: 60,  // default: 60
  targetFps: 60,          // default: 60
});
```

### `<PerfOverlay />`

Draggable floating widget with compact and expanded views.

| Prop | Type | Description |
|------|------|-------------|
| `visible` | `boolean` | Show/hide the overlay |
| `onClose` | `() => void` | Called when close button tapped |
| `initialPosition` | `{ x, y }` | Starting position |

### `registerDevMenuItem(onToggle)`

Adds "Toggle Nitro Perf Monitor" to the React Native Dev Menu.

### `setPerfOverlayVisible(visible: boolean)`

Programmatically control overlay visibility.

## PerfSnapshot

```typescript
interface PerfSnapshot {
  uiFps: number            // UI thread frames per second
  jsFps: number            // JS thread frames per second
  ramBytes: number         // Process resident memory
  jsHeapUsedBytes: number  // JS heap used (Hermes)
  jsHeapTotalBytes: number // JS heap total (Hermes)
  droppedFrames: number    // Total dropped frames
  stutterCount: number     // Seconds with 4+ dropped frames
  timestamp: number        // Millisecond timestamp
}
```

## Rozenite DevTools

<img alt="Rozenite DevTools Panel — performance score, FPS charts, memory usage, bottleneck analysis, and alerts" src="docs/static/img/devtools-panel.png" />

For a rich browser-based debugging experience:

```tsx
import { useNitroPerfDevTools } from '@nitroperf/devtools';

function App() {
  useNitroPerfDevTools(); // Bridges metrics to DevTools panel
  return <YourApp />;
}
```

Start with `WITH_ROZENITE=true npm start`, then open DevTools and navigate to the "Performance" tab.

Features:
- Real-time FPS line chart (UI + JS)
- Memory usage area chart (RAM + JS heap)
- Stutter event timeline
- Min/Max/Current statistics table
- Start/Stop/Reset controls

## How It Works

### iOS
- **UI FPS**: `CADisplayLink` on `NSRunLoopCommonModes`
- **JS FPS**: `CADisplayLink` on JS thread (bridge) or JS-side `requestAnimationFrame` (Fabric)
- **RAM**: `task_info(TASK_VM_INFO)` → `phys_footprint`

### Android
- **UI FPS**: `Choreographer.FrameCallback` → JNI → C++ FPSTracker
- **JS FPS**: JS-side `requestAnimationFrame` → `reportJsFrameTick()`
- **RAM**: `/proc/self/status` → `VmRSS`

### FPS Algorithm
Same approach as React Native's built-in `RCTFPSGraph.mm`: count frame callbacks per 1-second window, compute `round(frameCount / elapsed)`. Ring buffer stores last N seconds of samples.

## Project Structure

```
packages/
  core/                         # Nitro module (npm: @nitroperf/core)
    cpp/                        # Shared C++ (FPSTracker, PlatformMetrics, HybridPerfMonitor)
    src/                        # TypeScript (specs, hook, overlay, dev menu)
    ios/                        # iOS-specific files
    android/                    # Android build + Kotlin Choreographer helper
  devtools/                     # Rozenite plugin (npm: @nitroperf/devtools)
    src/                        # DevTools panel (React + Recharts)
    react-native.ts             # App-side bridge hook
```

## Requirements

- React Native >= 0.73
- react-native-nitro-modules >= 0.19.0
- iOS 13+
- Android SDK 24+

## License

MIT
