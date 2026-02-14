---
sidebar_position: 2
---

# Quick Start

## On-Device Overlay

The fastest way to start monitoring is with `PerfOverlay`:

```tsx
import { PerfOverlay, registerDevMenuItem } from '@nitroperf/core';
import { useState, useEffect } from 'react';
import { View } from 'react-native';

function App() {
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    registerDevMenuItem(setShowOverlay);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <YourApp />
      <PerfOverlay
        visible={showOverlay}
        onClose={() => setShowOverlay(false)}
      />
    </View>
  );
}
```

## Using the React Hook

For custom UI or programmatic access:

```tsx
import { usePerfMetrics } from '@nitroperf/core';

function PerformanceDisplay() {
  const { metrics, history, isRunning, start, stop, reset } = usePerfMetrics({
    autoStart: true,
    updateIntervalMs: 500,
    maxHistorySamples: 60,
    targetFps: 60,
  });

  return (
    <View>
      <Text>UI FPS: {metrics.uiFps}</Text>
      <Text>JS FPS: {metrics.jsFps}</Text>
      <Text>RAM: {(metrics.ramBytes / 1024 / 1024).toFixed(1)} MB</Text>
      <Text>Dropped Frames: {metrics.droppedFrames}</Text>
      <Text>Stutters: {metrics.stutterCount}</Text>
    </View>
  );
}
```

## DevTools Panel

For browser-based monitoring with rich charts:

```tsx
import { useNitroPerfDevTools } from '@nitroperf/devtools';

function App() {
  useNitroPerfDevTools();
  return <YourApp />;
}
```

Start your app with:

```bash
WITH_ROZENITE=true npm start
```

Then open DevTools and navigate to the "Performance" tab.

## AI Insights

Enable AI-powered performance analysis in your DevTools panel:

```tsx
import { useNitroPerfDevTools } from '@nitroperf/devtools';

function App() {
  useNitroPerfDevTools({ enableAIInsights: true });
  return <YourApp />;
}
```

In the DevTools panel, switch to the **AI Insights** tab. You'll get heuristic-based insights immediately. For deeper LLM-powered analysis:

1. Choose a provider (Claude, Gemini, OpenAI, xAI, or Custom for any OpenAI-compatible API)
2. Enter your API key
3. Click "Analyze" to get component-specific, actionable recommendations

Your API key is stored locally in your browser and sent directly to the provider's API. Toggle **Auto** for continuous analysis every 15 seconds.
