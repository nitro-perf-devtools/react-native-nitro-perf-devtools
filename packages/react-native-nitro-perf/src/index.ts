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
} from './types'

// Re-export hooks and utilities
export { usePerfMetrics } from './usePerfMetrics'
export { PerfOverlay } from './PerfOverlay'
export { getPerfMonitor } from './singleton'
export {
  registerDevMenuItem,
  setPerfOverlayVisible,
  isPerfOverlayVisible,
} from './devMenuIntegration'
