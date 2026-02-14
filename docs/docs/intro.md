---
sidebar_position: 1
slug: /
---

# Introduction

**@nitroperf/core** is a hybrid performance monitor for React Native that tracks UI FPS, JS FPS, RAM, JS heap, dropped frames, stutter detection, long tasks, slow events (INP proxy), and React render profiling, powered by [Nitro Modules](https://github.com/mrousavy/nitro).

## Three Consumption Modes

1. **On-device overlay** — draggable floating widget showing FPS + RAM
2. **React hook** — `usePerfMetrics()` returns reactive performance state
3. **Rozenite DevTools panel** — rich web charts (FPS line chart, memory area chart, stutter timeline)

<div style={{textAlign: 'center'}}>
  <img src="/img/overlay-compact.png" alt="NitroPerf overlay showing real-time performance metrics" width="300" />
</div>

## AI Insights

<div style={{textAlign: 'center'}}>
  <img src="/img/ai-insights.png" alt="AI Insights — LLM-powered performance analysis with per-component recommendations" style={{maxWidth: '100%', borderRadius: 8}} />
</div>

LLM-powered performance analysis with per-component render tracking. Choose from Claude, Gemini, OpenAI, xAI, or any OpenAI-compatible API to get actionable, code-level fixes from your runtime metrics.

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
        OBS["PerformanceObserver"]
        HEAP["Heap Polling"]
        PROF["React Profiler"]
        RAF --> FPS2
        OBS -->|"reportLongTask/reportSlowEvent"| HM
        HEAP -->|"reportJsHeap"| HM
        PROF -->|"reportRender"| HM
    end

    subgraph CONSUMERS["Consumers"]
        OV["PerfOverlay - On Device"]
        HOOK["usePerfMetrics - React Hook"]
        DT["Rozenite DevTools Panel"]
    end

    subgraph AI["AI Insights (DevTools)"]
        HEU["Heuristic Engine"]
        LLM["LLM Analysis"]
        CLAUDE["Claude API"]
        OPENAI["OpenAI API"]
        GEMINI["Gemini API"]
        LLM --> CLAUDE
        LLM --> OPENAI
        LLM --> GEMINI
    end

    HM --> OV
    HM --> HOOK
    HM -->|"CDP Bridge"| DT
    DT -->|"PerfSnapshot"| HEU
    DT -->|"PerfSnapshot + Component Stats"| LLM
```

## Requirements

- React Native >= 0.73
- react-native-nitro-modules >= 0.19.0
- iOS 13+
- Android SDK 24+
