export interface StartupTiming {
  available: boolean
  nativeInitMs?: number
  bundleLoadMs?: number
  ttiMs?: number
}

let cached: StartupTiming | null = null

export function getStartupTiming(): StartupTiming {
  if (cached) return cached

  // Try W3C Performance API marks (RN 0.82+)
  try {
    const entries = performance.getEntriesByType('mark')
    if (entries.length > 0) {
      const findMark = (name: string) =>
        entries.find((e) => e.name === name)?.startTime

      const nativeInit = findMark('nativeModuleInit') ?? findMark('nativeLaunch')
      const bundleLoad = findMark('bundleLoad') ?? findMark('runJSBundle')
      const tti = findMark('contentAppeared') ?? findMark('tti')

      if (nativeInit !== undefined || bundleLoad !== undefined || tti !== undefined) {
        cached = {
          available: true,
          nativeInitMs: nativeInit,
          bundleLoadMs: bundleLoad,
          ttiMs: tti,
        }
        return cached
      }
    }
  } catch (_e) {
    // performance API not available
  }

  // Fallback: React Native's legacy performance logger
  try {
    const logger = (globalThis as any).__PERFORMANCE_LOGGER
    if (logger?.getTimespans) {
      const spans = logger.getTimespans()
      cached = {
        available: true,
        nativeInitMs: spans.nativeModuleInit?.totalTime,
        bundleLoadMs: spans.ScriptExecution?.totalTime ?? spans.runJSBundle?.totalTime,
        ttiMs: spans.contentAppeared?.totalTime,
      }
      return cached
    }
  } catch (_e) {
    // Legacy logger not available
  }

  cached = { available: false }
  return cached
}
