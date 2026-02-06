export type { PerfSnapshot, FPSHistory, PerfConfig, PerfMonitor } from './specs/nitro-perf.nitro'

export interface PerfMetricsState {
  metrics: PerfSnapshot | null
  history: FPSHistory | null
  isRunning: boolean
}

export interface UsePerfMetricsOptions {
  /** Auto-start monitoring on mount. Default: true */
  autoStart?: boolean
  /** Update interval in milliseconds. Default: 500 */
  updateIntervalMs?: number
  /** Maximum FPS history samples to keep. Default: 60 */
  maxHistorySamples?: number
  /** Target FPS for dropped frame calculation. Default: 60 */
  targetFps?: number
}

export interface UsePerfMetricsReturn extends PerfMetricsState {
  start: () => void
  stop: () => void
  reset: () => void
}
