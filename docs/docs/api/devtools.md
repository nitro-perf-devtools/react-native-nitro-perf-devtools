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
  useNitroPerfDevTools({ enableAIInsights: true }); // Bridges metrics to DevTools panel with AI analysis
  return <YourApp />;
}
```

Start your Metro bundler with Rozenite enabled:

```bash
WITH_ROZENITE=true npm start
```

Then open DevTools and navigate to the **Performance** tab.

![Rozenite DevTools Panel](/img/devtools-panel.png)

### Features

The DevTools panel provides eight tabs for comprehensive performance analysis:

#### Diagnostics Tab

- **Stress Test Advisor** -- AI-powered analysis that examines current metrics and provides actionable recommendations for load testing, memory profiling, and identifying bottlenecks.
- **Thread Divergence** -- Compares UI FPS and JS FPS over time to identify when the JS thread falls behind the UI thread, indicating JS-side bottlenecks.
- **GC Pressure Meter** -- Monitors JS heap utilization and detects garbage collection events by watching for sudden drops in heap usage.

#### New Arch Tab

- **Architecture Info** -- Displays the current React Native architecture: Fabric enabled/disabled, Bridgeless mode, JS engine (Hermes/V8/JSC), and RN version.
- **Startup Timing** -- Shows native initialization time, JS bundle load time, and time-to-interactive (TTI) when available (RN 0.82+).
- **Runtime Metrics** -- Long task count and total duration, slow event count (INP proxy), worst event duration with color-coded severity (>200ms red), render count and last render duration from React Profiler.

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

#### AI Insights Tab

- **Heuristic Analysis** -- Rule-based insights that run locally without an API key. Detects memory leaks, thread bottlenecks, GC pressure, render storms, slow events, frame budget violations, and component hotspots.
- **LLM Analysis** -- Connect your own API key for deep, component-specific performance analysis. Built-in support for Claude, Gemini, OpenAI, and xAI — plus a "Custom" option for any OpenAI-compatible API (Together, Groq, Fireworks, Kimi, Minimax, etc.). The LLM receives all metrics including per-component render breakdowns and returns actionable code-level fixes.
- **Auto Mode** -- Toggle continuous analysis every 15 seconds for hands-free monitoring.
- **Timeline View** -- Insights displayed as expandable cards on a severity-colored timeline with copy-to-clipboard support.

#### Session Tab

- **Session Recording** -- Capture performance sessions with start and stop controls. All metric data during a session is buffered for later analysis.
- **Export** -- Download recorded sessions as JSON or CSV files for external analysis in spreadsheets, databases, or custom tooling.
- **Session Comparison** -- Load two recorded sessions side by side and view metric deltas, making it easy to measure the impact of optimizations or detect regressions between builds.
