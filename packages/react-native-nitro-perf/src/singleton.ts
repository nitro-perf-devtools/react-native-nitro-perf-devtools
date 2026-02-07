import { NitroModules } from 'react-native-nitro-modules'
import type { PerfMonitor } from './specs/nitro-perf.nitro'

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
