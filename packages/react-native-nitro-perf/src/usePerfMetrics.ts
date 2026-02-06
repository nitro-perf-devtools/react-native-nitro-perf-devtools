import { useState, useEffect, useCallback, useRef } from 'react'
import { Platform } from 'react-native'
import type { PerfSnapshot, FPSHistory, PerfMonitor } from './specs/nitro-perf.nitro'
import type { UsePerfMetricsOptions, UsePerfMetricsReturn } from './types'
import { getPerfMonitor } from './index'

/**
 * React hook that provides real-time performance metrics.
 *
 * On Android, automatically starts a requestAnimationFrame loop
 * calling reportJsFrameTick() since Choreographer can't natively
 * track JS thread FPS.
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
  const rafIdRef = useRef<number | null>(null)

  // Get or create singleton monitor
  const getMonitor = useCallback((): PerfMonitor => {
    if (!monitorRef.current) {
      monitorRef.current = getPerfMonitor()
    }
    return monitorRef.current
  }, [])

  // rAF loop for JS FPS tracking on Android
  const startJsFrameTracking = useCallback(() => {
    if (Platform.OS !== 'android') return

    const monitor = getMonitor()
    const tick = () => {
      if (monitorRef.current) {
        monitor.reportJsFrameTick(performance.now())
        rafIdRef.current = requestAnimationFrame(tick)
      }
    }
    rafIdRef.current = requestAnimationFrame(tick)
  }, [getMonitor])

  const stopJsFrameTracking = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    const monitor = getMonitor()
    monitor.configure({
      updateIntervalMs,
      maxHistorySamples,
      targetFps,
    })
    monitor.start()
    startJsFrameTracking()
    setIsRunning(true)
  }, [getMonitor, updateIntervalMs, maxHistorySamples, targetFps, startJsFrameTracking])

  const stop = useCallback(() => {
    const monitor = getMonitor()
    monitor.stop()
    stopJsFrameTracking()
    setIsRunning(false)
  }, [getMonitor, stopJsFrameTracking])

  const reset = useCallback(() => {
    const monitor = getMonitor()
    monitor.reset()
    setMetrics(null)
    setHistory(null)
  }, [getMonitor])

  useEffect(() => {
    const monitor = getMonitor()

    // Subscribe to native metric updates
    const subId = monitor.subscribe((snapshot: PerfSnapshot) => {
      setMetrics(snapshot)
      setHistory(monitor.getHistory())
    })

    if (autoStart) {
      start()
    }

    return () => {
      monitor.unsubscribe(subId)
      stopJsFrameTracking()
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
