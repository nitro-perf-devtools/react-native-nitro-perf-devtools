export interface AIInsight {
  id: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  confidence: number
  recommendation: string
  category: 'memory' | 'cpu' | 'render' | 'architecture'
}

export interface ComponentRenderStats {
  componentId: string
  renderCount: number
  totalDurationMs: number
  avgDurationMs: number
  maxDurationMs: number
  lastDurationMs: number
  mountCount: number
  updateCount: number
  nestedUpdateCount: number
}

export interface AIAnalysisInput {
  metrics: {
    uiFps: number
    jsFps: number
    ramBytes: number
    jsHeapUsedBytes: number
    jsHeapTotalBytes: number
    droppedFrames: number
    stutterCount: number
    timestamp: number
    longTaskCount: number
    longTaskTotalMs: number
    slowEventCount: number
    maxEventDurationMs: number
    renderCount: number
    lastRenderDurationMs: number
  } | null
  history: {
    uiFpsSamples: number[]
    jsFpsSamples: number[]
    uiFpsMin: number
    uiFpsMax: number
    jsFpsMin: number
    jsFpsMax: number
  } | null
  memoryData: Array<{
    timestamp: number
    ramMB: number
    heapUsedMB: number
    heapTotalMB: number
  }>
  stutterEvents: Array<{
    timestamp: number
    droppedFrames: number
  }>
  frameTimes: Array<{
    timestamp: number
    frameTimeMs: number
    budgetMs: number
  }>
  fpsData: Array<{ uiFps: number; jsFps: number }>
  componentStats?: ComponentRenderStats[]
}

let heuristicIdCounter = 0

function generateHeuristicId(): string {
  return `heuristic-${++heuristicIdCounter}`
}

export function analyzePerformance(input: AIAnalysisInput): AIInsight[] {
  const insights: AIInsight[] = []

  const memoryLeak = getMemoryLeakInsight(input)
  if (memoryLeak) insights.push(memoryLeak)

  const threadBottleneck = getThreadBottleneckInsight(input)
  if (threadBottleneck) insights.push(threadBottleneck)

  const gcPressure = getGCPressureInsight(input)
  if (gcPressure) insights.push(gcPressure)

  const reRender = getReRenderInsight(input)
  if (reRender) insights.push(reRender)

  const eventBlocking = getEventBlockingInsight(input)
  if (eventBlocking) insights.push(eventBlocking)

  const frameBudget = getFrameBudgetInsight(input)
  if (frameBudget) insights.push(frameBudget)

  const threadDivergence = getThreadDivergenceInsight(input)
  if (threadDivergence) insights.push(threadDivergence)

  const componentHotspot = getComponentHotspotInsight(input)
  if (componentHotspot) insights.push(componentHotspot)

  return insights.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

export function getMemoryLeakInsight(input: AIAnalysisInput): AIInsight | null {
  const { metrics, memoryData } = input

  if (!metrics || memoryData.length < 10) return null

  const recent = memoryData.slice(-30)
  if (recent.length < 10) return null

  const first = recent[0]
  const last = recent[recent.length - 1]
  const growthMB = last.ramMB - first.ramMB
  const elapsedMin = (last.timestamp - first.timestamp) / 60000

  if (elapsedMin <= 0) return null

  const growthRateMBPerMin = growthMB / elapsedMin

  if (growthRateMBPerMin > 3) {
    return {
      id: generateHeuristicId(),
      severity: 'critical',
      title: 'Memory Leak Detected',
      description: `Memory is growing at ${growthRateMBPerMin.toFixed(1)} MB/min. Over the last ${elapsedMin.toFixed(0)} minutes, RAM increased by ${growthMB.toFixed(1)} MB.`,
      confidence: Math.min(95, 70 + growthRateMBPerMin * 5),
      recommendation: 'Check for: (1) Uncleaned subscriptions or event listeners, (2) Growing caches without eviction, (3) Large objects retained in closures, (4) Images or media not being released. Use the Memory tab to track heap growth patterns.',
      category: 'memory',
    }
  }

  if (growthRateMBPerMin > 1) {
    return {
      id: generateHeuristicId(),
      severity: 'warning',
      title: 'Elevated Memory Growth',
      description: `Memory is growing at ${growthRateMBPerMin.toFixed(1)} MB/min. This could indicate a slow memory leak.`,
      confidence: Math.min(80, 50 + growthRateMBPerMin * 10),
      recommendation: 'Monitor over a longer period. Check for accumulated objects in state or caches. Consider adding memory cleanup in useEffect return statements.',
      category: 'memory',
    }
  }

  return null
}

export function getThreadBottleneckInsight(input: AIAnalysisInput): AIInsight | null {
  const { metrics } = input

  if (!metrics) return null

  const { uiFps, jsFps } = metrics

  if (uiFps < 30 && jsFps >= 45) {
    return {
      id: generateHeuristicId(),
      severity: 'critical',
      title: 'UI Thread Bottleneck',
      description: `UI FPS is critically low (${Math.round(uiFps)}) while JS thread is healthy (${Math.round(jsFps)}). The native rendering is blocked.`,
      confidence: 90,
      recommendation: 'This typically indicates: (1) Complex view hierarchies with deep nesting, (2) Expensive onLayout calculations, (3) Heavy animations, (4) Large FlatList without optimization. Consider using React.memo, simplifying layouts, or using removeClippedSubviews.',
      category: 'cpu',
    }
  }

  if (uiFps < 45 && jsFps >= 45) {
    return {
      id: generateHeuristicId(),
      severity: 'warning',
      title: 'UI Thread Pressure',
      description: `UI FPS (${Math.round(uiFps)}) is below target while JS thread is normal (${Math.round(jsFps)}).`,
      confidence: 75,
      recommendation: 'Review native rendering load. Check for: unnecessary re-renders, complex layouts, or onLayout callbacks. Consider using FlatList optimization props like removeClippedSubviews.',
      category: 'cpu',
    }
  }

  if (jsFps < 30 && uiFps >= 45) {
    return {
      id: generateHeuristicId(),
      severity: 'critical',
      title: 'JS Thread Bottleneck',
      description: `JS FPS is critically low (${Math.round(jsFps)}) while UI thread is healthy (${Math.round(uiFps)}). JavaScript execution is overloaded.`,
      confidence: 90,
      recommendation: 'This indicates heavy JS computation. Check for: (1) Synchronous operations blocking the thread, (2) Large data processing in main thread, (3) Excessive re-renders. Consider using InteractionManager, Worker threads, or useMemo/useCallback optimizations.',
      category: 'cpu',
    }
  }

  if (jsFps < 45 && uiFps >= 45) {
    return {
      id: generateHeuristicId(),
      severity: 'warning',
      title: 'JS Thread Pressure',
      description: `JS FPS (${Math.round(jsFps)}) is below target while UI thread is normal (${Math.round(uiFps)}).`,
      confidence: 70,
      recommendation: 'Review JS-side operations. Check for expensive computations, data transformations, or state updates that could be optimized.',
      category: 'cpu',
    }
  }

  if (uiFps < 30 && jsFps < 30) {
    return {
      id: generateHeuristicId(),
      severity: 'critical',
      title: 'Both Threads Overloaded',
      description: `Both UI (${Math.round(uiFps)}) and JS (${Math.round(jsFps)}) threads are critically slow. This indicates severe system-wide performance degradation.`,
      confidence: 95,
      recommendation: 'This is likely caused by: (1) Bridge serialization overhead in bridged mode, (2) Excessive component re-renders, (3) Large lists rendering without virtualization, (4) Memory pressure causing GC pauses. Profile with React DevTools and check for re-render storms.',
      category: 'cpu',
    }
  }

  return null
}

export function getGCPressureInsight(input: AIAnalysisInput): AIInsight | null {
  const { metrics, memoryData, fpsData } = input

  if (!metrics || memoryData.length < 10 || fpsData.length < 10) return null

  const recentMemory = memoryData.slice(-20)
  const recentFps = fpsData.slice(-20)

  const heapValues = recentMemory.map(d => d.heapUsedMB)
  const heapVariance = calculateVariance(heapValues)
  const heapOscillation = heapVariance > 10

  const fpsDrops = recentFps.filter(f => f.jsFps < 40).length
  const fpsDropRatio = fpsDrops / recentFps.length

  if (heapOscillation && fpsDropRatio > 0.3) {
    const avgJsFps = recentFps.reduce((a, b) => a + b.jsFps, 0) / recentFps.length
    return {
      id: generateHeuristicId(),
      severity: 'warning',
      title: 'GC Pressure Detected',
      description: `JS heap is oscillating significantly (variance: ${heapVariance.toFixed(1)} MB) while JS FPS drops occur ${(fpsDropRatio * 100).toFixed(0)}% of the time. This indicates Garbage Collection pauses.`,
      confidence: 75,
      recommendation: 'GC pressure often comes from: (1) Creating many temporary objects in render, (2) Large data structures being recreated, (3) Closures retaining large objects. Use useMemo for expensive computations and avoid creating objects in render methods.',
      category: 'memory',
    }
  }

  return null
}

export function getReRenderInsight(input: AIAnalysisInput): AIInsight | null {
  const { metrics } = input

  if (!metrics) return null

  const { renderCount, lastRenderDurationMs, jsFps } = metrics

  if (renderCount > 100 && lastRenderDurationMs > 16 && jsFps < 50) {
    return {
      id: generateHeuristicId(),
      severity: 'warning',
      title: 'Re-render Storm',
      description: `High render count (${renderCount} renders) with long render durations (${lastRenderDurationMs.toFixed(1)}ms) is causing JS thread pressure.`,
      confidence: 80,
      recommendation: 'Use React.memo() on pure components, implement useMemo/useCallback for expensive computations, and check if context providers are causing unnecessary re-renders. Profile with React DevTools to identify wasteful renders.',
      category: 'render',
    }
  }

  if (renderCount > 200) {
    return {
      id: generateHeuristicId(),
      severity: 'info',
      title: 'High Render Count',
      description: `${renderCount} component renders detected. This is elevated but may be normal during initial load.`,
      confidence: 60,
      recommendation: 'If this persists after initial load, consider using React.memo and auditing your component tree for unnecessary re-renders.',
      category: 'render',
    }
  }

  return null
}

export function getEventBlockingInsight(input: AIAnalysisInput): AIInsight | null {
  const { metrics } = input

  if (!metrics) return null

  const { slowEventCount, maxEventDurationMs } = metrics

  if (maxEventDurationMs > 500) {
    return {
      id: generateHeuristicId(),
      severity: 'critical',
      title: 'Event Handler Blocking',
      description: `Events are taking up to ${maxEventDurationMs.toFixed(0)}ms to process (target: <100ms). ${slowEventCount} slow events detected.`,
      confidence: 85,
      recommendation: 'Long event handlers block the main thread. Move expensive operations to: (1) InteractionManager.runAfterInteractions(), (2) Background threads, (3) Use requestIdleCallback for non-critical work. Break up large operations into smaller chunks using requestAnimationFrame.',
      category: 'cpu',
    }
  }

  if (maxEventDurationMs > 200 || slowEventCount > 5) {
    return {
      id: generateHeuristicId(),
      severity: 'warning',
      title: 'Slow Event Processing',
      description: `Events are taking ${maxEventDurationMs.toFixed(0)}ms on average (target: <100ms). ${slowEventCount} slow events detected.`,
      confidence: 70,
      recommendation: 'Review event handlers (onPress, onChange, etc.) for expensive operations. Consider deferring non-critical work using setTimeout or InteractionManager.',
      category: 'cpu',
    }
  }

  return null
}

export function getFrameBudgetInsight(input: AIAnalysisInput): AIInsight | null {
  const { frameTimes } = input

  if (frameTimes.length < 10) return null

  const recent = frameTimes.slice(-60)
  const overBudget = recent.filter(f => f.frameTimeMs > 16.67).length
  const overBudgetRatio = overBudget / recent.length

  if (overBudgetRatio > 0.5) {
    return {
      id: generateHeuristicId(),
      severity: 'critical',
      title: 'Frame Budget Violations',
      description: `${(overBudgetRatio * 100).toFixed(0)}% of frames are exceeding the 16.67ms budget. Average frame time: ${(recent.reduce((a, b) => a + b.frameTimeMs, 0) / recent.length).toFixed(1)}ms.`,
      confidence: 90,
      recommendation: 'Frame budget violations cause visible jank. Check for: heavy layouts (measurements in onLayout), complex styles requiring rasterization, or synchronous bridge calls. Use the FPS Analysis tab to identify patterns.',
      category: 'cpu',
    }
  }

  if (overBudgetRatio > 0.25) {
    return {
      id: generateHeuristicId(),
      severity: 'warning',
      title: 'Frequent Frame Drops',
      description: `${(overBudgetRatio * 100).toFixed(0)}% of frames are exceeding the 16.67ms budget.`,
      confidence: 75,
      recommendation: 'Review expensive operations during render. Consider deferring non-critical work and optimizing component re-renders.',
      category: 'cpu',
    }
  }

  return null
}

export function getThreadDivergenceInsight(input: AIAnalysisInput): AIInsight | null {
  const { fpsData } = input

  if (fpsData.length < 10) return null

  const recent = fpsData.slice(-20)
  const avgUi = recent.reduce((a, b) => a + b.uiFps, 0) / recent.length
  const avgJs = recent.reduce((a, b) => a + b.jsFps, 0) / recent.length

  const divergence = Math.abs(avgUi - avgJs)
  const divergenceRatio = divergence / Math.max(avgUi, avgJs)

  if (divergenceRatio > 0.3 && divergence > 15) {
    const isUiSlow = avgUi < avgJs
    return {
      id: generateHeuristicId(),
      severity: 'warning',
      title: 'Thread Divergence',
      description: `UI thread (${avgUi.toFixed(0)} FPS) and JS thread (${avgJs.toFixed(0)} FPS) are diverging by ${divergence.toFixed(0)} FPS. ${isUiSlow ? 'UI thread is the bottleneck.' : 'JS thread is the bottleneck.'}`,
      confidence: 70,
      recommendation: isUiSlow
        ? 'UI thread is overloaded with native work. Check for: complex view hierarchies, excessive animations, or onLayout calculations.'
        : 'JS thread is doing more work than UI thread. Check for: heavy JS computations, state updates, or re-renders that don\'t need visual changes.',
      category: 'architecture',
    }
  }

  return null
}

export function getComponentHotspotInsight(input: AIAnalysisInput): AIInsight | null {
  const { componentStats } = input

  if (!componentStats || componentStats.length === 0) return null

  const hotComponents = componentStats.filter(
    c => c.renderCount > 20 && c.avgDurationMs > 8
  )

  if (hotComponents.length === 0) return null

  const worst = hotComponents[0] // already sorted by renderCount desc

  if (worst.avgDurationMs > 16) {
    return {
      id: generateHeuristicId(),
      severity: 'critical',
      title: 'Component Render Hotspot',
      description: `"${worst.componentId}" has rendered ${worst.renderCount} times with an average duration of ${worst.avgDurationMs.toFixed(1)}ms (max: ${worst.maxDurationMs.toFixed(1)}ms). This exceeds the 16.67ms frame budget.${hotComponents.length > 1 ? ` ${hotComponents.length - 1} other component(s) also show high render activity.` : ''}`,
      confidence: 85,
      recommendation: `Optimize "${worst.componentId}": (1) Wrap with React.memo() if it receives object/array props, (2) Use useMemo for expensive computations inside it, (3) Check if parent re-renders are causing unnecessary updates, (4) Consider splitting into smaller components.`,
      category: 'render',
    }
  }

  return {
    id: generateHeuristicId(),
    severity: 'warning',
    title: 'Frequent Component Re-renders',
    description: `"${worst.componentId}" has rendered ${worst.renderCount} times (avg: ${worst.avgDurationMs.toFixed(1)}ms, max: ${worst.maxDurationMs.toFixed(1)}ms).${hotComponents.length > 1 ? ` ${hotComponents.length} components show elevated render activity.` : ''}`,
    confidence: 70,
    recommendation: `Review "${worst.componentId}" for unnecessary re-renders. Check: (1) Are props changing on every render? (2) Is it subscribed to a frequently-updating context? (3) Would React.memo help?`,
    category: 'render',
  }
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length
}
