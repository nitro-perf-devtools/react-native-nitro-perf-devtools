import type { PerfMonitor } from './specs/nitro-perf.nitro'

let longTaskObserver: PerformanceObserver | null = null
let eventObserver: PerformanceObserver | null = null
let heapTimer: ReturnType<typeof setInterval> | null = null

/**
 * Check whether the native module exposes the new report methods.
 * This returns false when JS is updated but the native binary is stale.
 */
function hasNewMethods(monitor: PerfMonitor): boolean {
  return (
    typeof (monitor as any).reportLongTask === 'function' &&
    typeof (monitor as any).reportSlowEvent === 'function' &&
    typeof (monitor as any).reportJsHeap === 'function'
  )
}

export function startObservers(monitor: PerfMonitor): void {
  stopObservers()

  // Bail out entirely if the native binary doesn't have the new methods yet
  if (!hasNewMethods(monitor)) {
    return
  }

  // Long Task observer (tasks > 50ms)
  try {
    if (typeof PerformanceObserver !== 'undefined') {
      longTaskObserver = new PerformanceObserver((list) => {
        try {
          for (const entry of list.getEntries()) {
            monitor.reportLongTask(entry.duration)
          }
        } catch (_e) {
          // Native method unavailable
        }
      })
      longTaskObserver.observe({ type: 'longtask', buffered: true })
    }
  } catch (_e) {
    // PerformanceObserver or longtask type not available
  }

  // Event Timing observer (slow events > 100ms, INP proxy)
  try {
    if (typeof PerformanceObserver !== 'undefined') {
      eventObserver = new PerformanceObserver((list) => {
        try {
          for (const entry of list.getEntries()) {
            const duration = (entry as any).duration ?? 0
            if (duration > 100) {
              monitor.reportSlowEvent(duration)
            }
          }
        } catch (_e) {
          // Native method unavailable
        }
      })
      eventObserver.observe({ type: 'event', buffered: true })
    }
  } catch (_e) {
    // event type not available
  }

  // JS Heap polling (every 2s)
  heapTimer = setInterval(() => {
    try {
      // Try HermesInternal first (Hermes engine)
      const hermes = (globalThis as any).HermesInternal
      if (hermes?.getRuntimeProperties) {
        const props = hermes.getRuntimeProperties()
        const used = props['Heap Allocated'] ?? props['js_heapUsed'] ?? 0
        const total = props['Heap Size'] ?? props['js_heapTotal'] ?? 0
        if (used > 0 || total > 0) {
          monitor.reportJsHeap(used, total)
          return
        }
      }

      // Fallback: performance.memory (V8/JSC)
      const mem = (performance as any).memory
      if (mem) {
        monitor.reportJsHeap(mem.usedJSHeapSize ?? 0, mem.totalJSHeapSize ?? 0)
      }
    } catch (_e) {
      // Heap APIs not available
    }
  }, 2000)
}

export function stopObservers(): void {
  if (longTaskObserver) {
    longTaskObserver.disconnect()
    longTaskObserver = null
  }
  if (eventObserver) {
    eventObserver.disconnect()
    eventObserver = null
  }
  if (heapTimer !== null) {
    clearInterval(heapTimer)
    heapTimer = null
  }
}
