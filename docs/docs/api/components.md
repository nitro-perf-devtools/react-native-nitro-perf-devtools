---
sidebar_position: 3
---

# Components

## `<PerfOverlay />`

Draggable floating widget with compact and expanded views showing real-time performance metrics.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `visible` | `boolean` | Show/hide the overlay |
| `onClose` | `() => void` | Called when close button is tapped |
| `initialPosition` | `{ x: number, y: number }` | Starting position on screen |

### Example

```tsx
import { PerfOverlay } from '@nitroperf/core';

<PerfOverlay
  visible={showOverlay}
  onClose={() => setShowOverlay(false)}
  initialPosition={{ x: 20, y: 60 }}
/>
```

## `registerDevMenuItem(onToggle)`

Adds a "Toggle Nitro Perf Monitor" entry to the React Native Dev Menu.

```tsx
import { registerDevMenuItem } from '@nitroperf/core';
import { useEffect, useState } from 'react';

function App() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    registerDevMenuItem(setVisible);
  }, []);

  return (
    <>
      <YourApp />
      <PerfOverlay visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}
```

## `setPerfOverlayVisible(visible: boolean)`

Programmatically control overlay visibility from anywhere in your app.

```typescript
import { setPerfOverlayVisible } from '@nitroperf/core';

// Show the overlay
setPerfOverlayVisible(true);

// Hide the overlay
setPerfOverlayVisible(false);
```
