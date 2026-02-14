export interface AIInsight {
  id: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  confidence: number
  recommendation: string
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
}

export function analyzePerformance(_input: AIAnalysisInput): AIInsight[] {
  return []
}

export function getMemoryLeakInsight(_input: AIAnalysisInput): AIInsight | null {
  return null
}

export function getThreadBottleneckInsight(_input: AIAnalysisInput): AIInsight | null {
  return null
}

export function getGCPressureInsight(_input: AIAnalysisInput): AIInsight | null {
  return null
}

export function getReRenderInsight(_input: AIAnalysisInput): AIInsight | null {
  return null
}
