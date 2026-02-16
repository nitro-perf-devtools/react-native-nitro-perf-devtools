---
slug: ai-insights
title: "AI Insights: LLM-Powered Performance Analysis"
tags: [feature, ai, devtools]
---

# AI Insights: LLM-Powered Performance Analysis

NitroPerf now includes an **AI Insights** tab in the DevTools panel that combines rule-based heuristics with LLM-powered analysis to give you actionable, component-specific performance recommendations.

<!-- truncate -->

## What it does

The AI Insights tab analyzes your live runtime metrics — FPS, memory, long tasks, slow events, and per-component render stats — and returns concrete code-level fixes. No vague advice like "consider memoization." Instead, you get insights like:

> **ProductList: 47 unnecessary re-renders**
> Wrap `<ProductList>` with `React.memo()` since it re-rendered 47 times with 12ms avg but receives the same props from its parent.

## Choose your LLM provider

AI Insights ships with built-in presets and a fully customizable option — bring your own API key:

- **Claude** (Anthropic) — Claude Sonnet with tool use for structured output
- **Gemini** (Google) — Gemini 2.0 Flash with function declarations
- **OpenAI** — GPT-4.1 via function calling
- **xAI** — Grok-3 via OpenAI-compatible API
- **Custom** — Any OpenAI-compatible endpoint (Together, Groq, Fireworks, Kimi, Minimax, etc.)

Each provider's API key is stored separately in your browser's localStorage and sent directly to the provider's API. Switch between providers without losing your keys. The Custom option lets you enter any endpoint URL and model name.

## Per-component render tracking

Wrap components with `<PerfProfiler>` to track individual render durations:

```tsx
import { PerfProfiler } from '@nitroperf/core';

<PerfProfiler id="ProductList">
  <ProductList items={items} />
</PerfProfiler>
```

The AI receives per-component render counts, average/max durations, mount vs update ratios, and nested update counts — enabling it to pinpoint exactly which components need optimization and why.

## How to enable it

```tsx
import { useNitroPerfDevTools } from '@nitroperf/devtools';

function App() {
  useNitroPerfDevTools({ enableAIInsights: true });
  return <YourApp />;
}
```

Open the DevTools panel, navigate to the AI Insights tab, select your provider, enter your API key, and click Analyze. Toggle **Auto** for continuous analysis every 15 seconds.
