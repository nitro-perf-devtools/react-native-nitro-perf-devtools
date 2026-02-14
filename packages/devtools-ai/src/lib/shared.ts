import type { AIInsight } from './aiInsights'

export interface LLMAnalysisInput {
  metrics: {
    uiFps: number
    jsFps: number
    ramBytes: number
    jsHeapUsedBytes: number
    jsHeapTotalBytes: number
    droppedFrames: number
    stutterCount: number
    longTaskCount: number
    longTaskTotalMs: number
    slowEventCount: number
    maxEventDurationMs: number
    renderCount: number
    lastRenderDurationMs: number
  }
  history?: {
    uiFpsSamples: number[]
    jsFpsSamples: number[]
    uiFpsMin: number
    uiFpsMax: number
    jsFpsMin: number
    jsFpsMax: number
  }
  memoryTrendMBPerMin?: number
  stutterRate?: number
  componentStats?: Array<{
    componentId: string
    renderCount: number
    totalDurationMs: number
    avgDurationMs: number
    maxDurationMs: number
    lastDurationMs: number
    mountCount: number
    updateCount: number
    nestedUpdateCount: number
  }>
  archInfo?: {
    isFabric: boolean
    isBridgeless: boolean
    jsEngine: string
    reactNativeVersion: string
  }
}

export const SYSTEM_PROMPT = `You are a React Native performance expert analyzing live runtime metrics. Your insights will be displayed as cards in a DevTools panel — each one must be immediately actionable by a developer.

RULES FOR EVERY INSIGHT:
- Reference specific component names from the data (e.g., "ProductList" not "some component")
- Include the actual numbers from the metrics (e.g., "47 re-renders in 3.2s" not "many re-renders")
- The recommendation MUST be a concrete code change, not general advice. Write it as a mini code snippet or a step-by-step fix the developer can apply RIGHT NOW
- Bad: "Consider using React.memo" — Good: "Wrap <ProductList> with React.memo() since it re-rendered 47 times with 12ms avg but receives the same props from its parent"
- Bad: "Optimize your renders" — Good: "Move the inline style={{ ... }} object in <CartItem> to a StyleSheet.create() call or a module-level constant to prevent identity changes triggering re-renders"
- If you don't have enough data to give a specific fix, say exactly what data is missing and what the developer should check

REACT NATIVE ARCHITECTURE CONTEXT:
- Bridgeless mode is the DEFAULT since RN 0.76. If the app is on RN 0.76+ and isBridgeless is true, do NOT recommend "enabling Bridgeless" — it's already on.
- Fabric is the new renderer, default since RN 0.76. If isFabric is true, the app is already using the new renderer.
- Hermes is the default JS engine since RN 0.70. If jsEngine is "hermes", that's expected and optimal.
- Do NOT recommend architecture changes that are already in place. Only suggest architecture changes if the data shows the app is on an older config (e.g., isBridgeless: false on RN < 0.76).
- Focus insights on code-level fixes the developer can make, not architecture migrations they've already done.

WHAT TO LOOK FOR:
1. Components with high render count + high avg duration = likely missing memoization. Suggest React.memo, useMemo, or useCallback with specific props/deps
2. Components with many "update" phases vs "mount" phases = unnecessary re-renders from parent. Suggest where to break the render chain
3. Memory growing >0.5 MB/min = potential leak. Suggest checking specific lifecycle patterns (subscriptions, intervals, event listeners)
4. JS FPS drops while UI FPS stays high = JS thread blocking. Correlate with long tasks and identify the likely culprit
5. High stutter count + specific components re-rendering = render storm during animation. Suggest InteractionManager.runAfterInteractions or LayoutAnimation

Only report issues actually present in the data. Do not report "everything looks fine" — if metrics are healthy, find optimization opportunities instead (e.g., "FPS is 60 but <HeavyList> averages 8ms renders — adding getItemLayout would reduce this to <1ms").

Limit to 3-5 insights maximum. Quality over quantity.`

export function buildUserMessage(input: LLMAnalysisInput): string {
  const sections: string[] = []

  const m = input.metrics
  sections.push(`## Current Metrics
- UI FPS: ${Math.round(m.uiFps)} | JS FPS: ${Math.round(m.jsFps)}
- RAM: ${(m.ramBytes / (1024 * 1024)).toFixed(1)} MB
- JS Heap: ${(m.jsHeapUsedBytes / (1024 * 1024)).toFixed(1)} / ${(m.jsHeapTotalBytes / (1024 * 1024)).toFixed(1)} MB
- Dropped Frames: ${m.droppedFrames} | Stutters: ${m.stutterCount}
- Long Tasks: ${m.longTaskCount} (${m.longTaskTotalMs.toFixed(0)}ms total)
- Slow Events: ${m.slowEventCount} | Worst INP: ${m.maxEventDurationMs.toFixed(0)}ms
- Renders: ${m.renderCount} | Last Render: ${m.lastRenderDurationMs.toFixed(1)}ms`)

  if (input.history) {
    const h = input.history
    sections.push(`## FPS History
- UI FPS range: ${h.uiFpsMin} - ${h.uiFpsMax} (${h.uiFpsSamples.length} samples)
- JS FPS range: ${h.jsFpsMin} - ${h.jsFpsMax} (${h.jsFpsSamples.length} samples)`)
  }

  if (input.memoryTrendMBPerMin !== undefined) {
    sections.push(`## Memory Trend
- Growth rate: ${input.memoryTrendMBPerMin >= 0 ? '+' : ''}${input.memoryTrendMBPerMin.toFixed(2)} MB/min`)
  }

  if (input.stutterRate !== undefined) {
    sections.push(`## Stutter Rate
- ${input.stutterRate} stutters/min`)
  }

  if (input.archInfo) {
    const a = input.archInfo
    sections.push(`## Architecture
- Fabric: ${a.isFabric ? 'Yes' : 'No'} | Bridgeless: ${a.isBridgeless ? 'Yes' : 'No'}
- JS Engine: ${a.jsEngine} | RN Version: ${a.reactNativeVersion}`)
  }

  if (input.componentStats && input.componentStats.length > 0) {
    const rows = input.componentStats.slice(0, 20).map(c =>
      `| ${c.componentId} | ${c.renderCount} | ${c.avgDurationMs.toFixed(1)}ms | ${c.maxDurationMs.toFixed(1)}ms | ${c.mountCount} | ${c.updateCount} |`
    )
    sections.push(`## Per-Component Render Stats
| Component | Renders | Avg Duration | Max Duration | Mounts | Updates |
|-----------|---------|-------------|-------------|--------|---------|
${rows.join('\n')}`)
  }

  sections.push('Analyze these metrics and report any performance issues, root causes, and recommendations.')

  return sections.join('\n\n')
}

export const insightSchema = {
  type: 'object' as const,
  properties: {
    insights: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          severity: { type: 'string' as const, enum: ['info', 'warning', 'critical'] },
          title: { type: 'string' as const, description: 'Concise title with the component name and metric, e.g. "ProductList: 47 unnecessary re-renders"' },
          description: { type: 'string' as const, description: 'Root cause analysis with specific numbers from the metrics. Reference component names, render counts, durations, and correlations.' },
          confidence: { type: 'number' as const, description: 'Confidence percentage 0-100' },
          recommendation: { type: 'string' as const, description: 'A specific, copy-pasteable code fix or step-by-step instruction. Include the exact React API to use (React.memo, useMemo, useCallback, etc.) with the specific component/prop names.' },
          category: { type: 'string' as const, enum: ['memory', 'cpu', 'render', 'architecture'] },
        },
        required: ['severity', 'title', 'description', 'confidence', 'recommendation', 'category'],
      },
    },
  },
  required: ['insights'],
}

export function parseInsightsArray(
  raw: Array<{ severity: string; title: string; description: string; confidence: number; recommendation: string; category: string }>,
  prefix: string
): AIInsight[] {
  let idCounter = 0
  return raw.map(insight => ({
    id: `${prefix}-${++idCounter}`,
    severity: insight.severity as AIInsight['severity'],
    title: insight.title,
    description: insight.description,
    confidence: insight.confidence,
    recommendation: insight.recommendation,
    category: insight.category as AIInsight['category'],
  }))
}
