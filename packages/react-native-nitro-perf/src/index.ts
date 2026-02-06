import { NitroModules } from 'react-native-nitro-modules'
import type { PerfMonitor } from './specs/nitro-perf.nitro'

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
export {
  registerDevMenuItem,
  setPerfOverlayVisible,
  isPerfOverlayVisible,
} from './devMenuIntegration'

// Singleton instance
let perfMonitorInstance: PerfMonitor | null = null

/**
 * Get the singleton PerfMonitor HybridObject.
 * Creates the native Nitro module on first call.
 */
export function getPerfMonitor(): PerfMonitor {
  if (!perfMonitorInstance) {
    perfMonitorInstance = NitroModules.createHybridObject<PerfMonitor>('PerfMonitor')
  }
  return perfMonitorInstance
}
