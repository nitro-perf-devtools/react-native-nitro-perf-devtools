---
sidebar_position: 4
---

# DevTools

## @nitroperf/devtools

A [Rozenite](https://rozenite.com) DevTools plugin that provides browser-based performance charts via the Chrome DevTools Protocol (CDP).

### Installation

```bash
npm install @nitroperf/devtools
```

### Setup

```tsx
import { useNitroPerfDevTools } from '@nitroperf/devtools';

function App() {
  useNitroPerfDevTools(); // Bridges metrics to DevTools panel
  return <YourApp />;
}
```

Start your Metro bundler with Rozenite enabled:

```bash
WITH_ROZENITE=true npm start
```

Then open DevTools and navigate to the **Performance** tab.

### Features

The DevTools panel provides five tabs for comprehensive performance analysis:

#### Overview Tab

- **Metric Cards** -- Real-time display of UI FPS, JS FPS, RAM, JS Heap, Dropped Frames, and Stutters with at-a-glance status indicators.
- **Performance Score** -- A weighted 0-100 health gauge that combines all metrics into a single score. Weights: UI FPS 30%, JS FPS 25%, Memory 20%, Stutters 15%, Dropped Frames 10%.
- **Bottleneck Analysis** -- Automated diagnostics that identify whether the UI thread, JS thread, or memory pressure is the primary bottleneck, along with actionable suggestions for improvement.
- **Threshold Alerts** -- Configurable alerts that trigger when metrics cross warning or critical thresholds, helping you catch regressions early.

#### FPS Analysis Tab

- **FPS Line Chart** -- Real-time UI and JS FPS plotted over time with min/max range bands for visual variance tracking.
- **FPS Distribution** -- Histogram showing the proportion of time spent in each FPS bucket (0-60+), making it easy to see how consistently your app hits target frame rates.
- **Frame Budget Timeline** -- Per-frame duration bars rendered against the 16.67ms budget line. Over-budget frames are highlighted so you can spot individual janky frames.
- **Frame Time Heatmap** -- A grid visualization of individual frame times, color-coded by budget utilization. Quickly identify clusters of slow frames and patterns in frame timing.

#### Memory Analysis Tab

- **Memory Area Chart** -- RAM, JS Heap Used, and JS Heap Total plotted over time as stacked area layers, giving a clear picture of memory consumption trends.
- **Memory Leak Detector** -- Uses linear regression on memory data to detect upward trends. Warns when the growth rate exceeds configurable thresholds, displaying the rate in MB/min along with an R-squared confidence value.
- **FPS vs Memory Correlation** -- Scatter plot comparing FPS against memory usage with a computed Pearson correlation coefficient, helping you determine whether memory pressure is contributing to FPS drops.

#### Stutter Analysis Tab

- **Stutter Timeline** -- A horizontal timeline with severity-colored markers. Stutters are classified as minor, moderate, or severe based on the number of dropped frames in the detection window.
- **Stutter Event Log** -- A timestamped table listing all detected stutter events with details including severity, dropped frame count, and the FPS at the time of the event.
- **Statistics** -- Summary statistics showing min, max, and current values for all tracked metrics.

#### Session Tab

- **Session Recording** -- Capture performance sessions with start and stop controls. All metric data during a session is buffered for later analysis.
- **Export** -- Download recorded sessions as JSON or CSV files for external analysis in spreadsheets, databases, or custom tooling.
- **Session Comparison** -- Load two recorded sessions side by side and view metric deltas, making it easy to measure the impact of optimizations or detect regressions between builds.
