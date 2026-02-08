import { type HybridObject } from 'react-native-nitro-modules'

export interface PerfSnapshot {
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
}

export interface FPSHistory {
  uiFpsSamples: number[]
  jsFpsSamples: number[]
  uiFpsMin: number
  uiFpsMax: number
  jsFpsMin: number
  jsFpsMax: number
}

export interface PerfConfig {
  updateIntervalMs: number
  maxHistorySamples: number
  targetFps: number
}

export interface PerfMonitor
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  start(): void
  stop(): void
  readonly isRunning: boolean
  getMetrics(): PerfSnapshot
  getHistory(): FPSHistory
  subscribe(cb: (m: PerfSnapshot) => void): number
  unsubscribe(id: number): void
  reportJsFrameTick(ts: number): void
  reportLongTask(durationMs: number): void
  reportSlowEvent(durationMs: number): void
  reportRender(actualDurationMs: number): void
  reportJsHeap(usedBytes: number, totalBytes: number): void
  configure(config: PerfConfig): void
  reset(): void
}
