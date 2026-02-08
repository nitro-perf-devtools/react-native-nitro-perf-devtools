import React from 'react'
import { getPerfMonitor } from './singleton'

interface PerfProfilerProps {
  id?: string
  children: React.ReactNode
}

export function PerfProfiler({ id = 'PerfProfiler', children }: PerfProfilerProps) {
  const onRender = React.useCallback(
    (
      _id: string,
      _phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number
    ) => {
      try {
        const monitor = getPerfMonitor()
        if (typeof (monitor as any).reportRender === 'function') {
          monitor.reportRender(actualDuration)
        }
      } catch (_e) {
        // Monitor may not be initialized or method unavailable
      }
    },
    []
  )

  return (
    <React.Profiler id={id} onRender={onRender}>
      {children}
    </React.Profiler>
  )
}
