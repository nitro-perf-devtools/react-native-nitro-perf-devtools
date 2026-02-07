---
sidebar_position: 1
slug: /
---

# Introduction

**@nitroperf/core** is a hybrid performance monitor for React Native that tracks UI FPS, JS FPS, RAM, JS heap, dropped frames, and stutter detection, powered by [Nitro Modules](https://github.com/mrousavy/nitro).

## Three Consumption Modes

1. **On-device overlay** — draggable floating widget showing FPS + RAM
2. **React hook** — `usePerfMetrics()` returns reactive performance state
3. **Rozenite DevTools panel** — rich web charts (FPS line chart, memory area chart, stutter timeline)

<div style={{textAlign: 'center'}}>
  <img src="/img/overlay-compact.png" alt="NitroPerf overlay showing real-time performance metrics" width="300" />
</div>

## Architecture

```mermaid
graph TB
    subgraph CPP["C++ Core (Nitro HybridObject)"]
        HM["HybridPerfMonitor"]
        FPS1["FPSTracker - UI Thread"]
        FPS2["FPSTracker - JS Thread"]
        PM["PlatformMetrics"]
        HM --> FPS1
        HM --> FPS2
        HM --> PM
    end

    subgraph IOS["iOS Native"]
        CDL["CADisplayLink"]
        TI["task_info / Mach APIs"]
        CDL --> FPS1
        CDL --> FPS2
        TI --> PM
    end

    subgraph ANDROID["Android Native"]
        CH["Choreographer via JNI"]
        PROC["/proc/self/status"]
        CH --> FPS1
        PROC --> PM
    end

    subgraph JS["JavaScript"]
        RAF["requestAnimationFrame"]
        RAF --> FPS2
    end

    subgraph CONSUMERS["Consumers"]
        OV["PerfOverlay - On Device"]
        HOOK["usePerfMetrics - React Hook"]
        DT["Rozenite DevTools Panel"]
    end

    HM --> OV
    HM --> HOOK
    HM -->|"CDP Bridge"| DT
```

## Requirements

- React Native >= 0.73
- react-native-nitro-modules >= 0.19.0
- iOS 13+
- Android SDK 24+
