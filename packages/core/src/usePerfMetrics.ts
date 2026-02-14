import { useState, useEffect, useCallback, useRef } from 'react'
import type { PerfSnapshot, FPSHistory, PerfMonitor } from './specs/nitro-perf.nitro'
import type { UsePerfMetricsOptions, UsePerfMetricsReturn } from './types'
import { getPerfMonitor, startJsFrameLoop, stopJsFrameLoop } from './singleton'

/**
 * React hook that provides real-time performance metrics.
 *
 * JS FPS is tracked via a single requestAnimationFrame loop managed
 * by the singleton module — multiple hooks share the same loop.
 */
export function usePerfMetrics(
  options: UsePerfMetricsOptions = {}
): UsePerfMetricsReturn {
  const {
    autoStart = true,
    updateIntervalMs = 500,
    maxHistorySamples = 60,
    targetFps = 60,
  } = options

  const [metrics, setMetrics] = useState<PerfSnapshot | null>(null)
  const [history, setHistory] = useState<FPSHistory | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const monitorRef = useRef<PerfMonitor | null>(null)

  // Get or create singleton monitor
  const getMonitor = useCallback((): PerfMonitor => {
    if (!monitorRef.current) {
      monitorRef.current = getPerfMonitor()
    }
    return monitorRef.current
  }, [])

  const start = useCallback(() => {
    const monitor = getMonitor()
    monitor.configure({
      updateIntervalMs,
      maxHistorySamples,
      targetFps,
    })
    monitor.start()
    startJsFrameLoop()
    setIsRunning(true)
  }, [getMonitor, updateIntervalMs, maxHistorySamples, targetFps])

  const stop = useCallback(() => {
    const monitor = getMonitor()
    monitor.stop()
    stopJsFrameLoop()
    setIsRunning(false)
  }, [getMonitor])

  const reset = useCallback(() => {
    const monitor = getMonitor()
    monitor.reset()
    setMetrics(null)
    setHistory(null)
  }, [getMonitor])

  useEffect(() => {
    const monitor = getMonitor()

    // Subscribe to native metric updates (snapshot only — no getHistory() here)
    const subId = monitor.subscribe((snapshot: PerfSnapshot) => {
      setMetrics(snapshot)
    })

    // Poll history on a slower cadence (FPSTracker only produces ~1 sample/sec)
    const historyTimer = setInterval(() => {
      if (monitor.isRunning) {
        setHistory(monitor.getHistory())
      }
    }, 2000)

    if (autoStart) {
      start()
    }

    return () => {
      monitor.unsubscribe(subId)
      clearInterval(historyTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    metrics,
    history,
    isRunning,
    start,
    stop,
    reset,
  }
}
