import React from 'react'
import { getPerfMonitor } from './singleton'
import { recordRender } from './renderStore'

interface PerfProfilerProps {
  id?: string
  children: React.ReactNode
}

export function PerfProfiler({ id = 'PerfProfiler', children }: PerfProfilerProps) {
  const onRender = React.useCallback(
    (
      id: string,
      phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number
    ) => {
      try {
        recordRender(id, phase, actualDuration)
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
