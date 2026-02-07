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

- **Real-time FPS line chart** — UI + JS thread frame rates
- **Memory usage area chart** — RAM + JS heap
- **Stutter event timeline** — visual markers for stutter events
- **Statistics table** — Min/Max/Current values
- **Controls** — Start/Stop/Reset from the browser
