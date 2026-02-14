// Re-export types
export type {
  PerfSnapshot,
  FPSHistory,
  PerfConfig,
  PerfMonitor,
} from './specs/nitro-perf.nitro'

export type {
  UsePerfMetricsOptions,
  UsePerfMetricsReturn,
  PerfMetricsState,
  ArchInfo,
  StartupTiming,
} from './types'

// Re-export hooks and utilities
export { usePerfMetrics } from './usePerfMetrics'
export { PerfOverlay } from './PerfOverlay'
export { getPerfMonitor, startJsFrameLoop, stopJsFrameLoop } from './singleton'
export {
  registerDevMenuItem,
  setPerfOverlayVisible,
  isPerfOverlayVisible,
} from './devMenuIntegration'
export { PerfProfiler } from './PerfProfiler'
export { getArchInfo } from './archDetection'
export { getStartupTiming } from './startupTiming'
export { getComponentRenderStats, resetComponentRenderStats } from './renderStore'
export type { ComponentRenderStats } from './renderStore'
