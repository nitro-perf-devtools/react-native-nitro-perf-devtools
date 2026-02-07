import { NitroModules } from 'react-native-nitro-modules'
import type { PerfMonitor } from './specs/nitro-perf.nitro'

let perfMonitorInstance: PerfMonitor | null = null
let jsFrameRafId: number | null = null

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

/**
 * Start the JS frame tracking rAF loop (singleton — only one loop runs
 * regardless of how many usePerfMetrics hooks are mounted).
 */
export function startJsFrameLoop(): void {
  if (jsFrameRafId !== null) return // already running
  const monitor = getPerfMonitor()
  const tick = () => {
    if (jsFrameRafId !== null) {
      monitor.reportJsFrameTick(performance.now())
      jsFrameRafId = requestAnimationFrame(tick)
    }
  }
  jsFrameRafId = requestAnimationFrame(tick)
}

/**
 * Stop the JS frame tracking rAF loop.
 */
export function stopJsFrameLoop(): void {
  if (jsFrameRafId !== null) {
    cancelAnimationFrame(jsFrameRafId)
    jsFrameRafId = null
  }
}
