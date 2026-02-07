import React, { useMemo } from 'react'

interface PerfSnapshot {
  uiFps: number
  jsFps: number
  ramBytes: number
  jsHeapUsedBytes: number
  jsHeapTotalBytes: number
  droppedFrames: number
  stutterCount: number
  timestamp: number
}

interface FPSHistory {
  uiFpsSamples: number[]
  jsFpsSamples: number[]
  uiFpsMin: number
  uiFpsMax: number
  jsFpsMin: number
  jsFpsMax: number
}

interface BottleneckAnalysisProps {
  metrics: PerfSnapshot | null
  history: FPSHistory | null
  memoryTrend: number
}

interface Suggestion {
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
}

const severityColors: Record<string, string> = {
  info: '#2196F3',
  warning: '#FF9800',
  critical: '#F44336',
}

const severityIcons: Record<string, string> = {
  info: '\u2139',
  warning: '\u26A0',
  critical: '\uD83D\uDD34',
}

export function BottleneckAnalysis({ metrics, history, memoryTrend }: BottleneckAnalysisProps) {
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!metrics) return []

    const result: Suggestion[] = []
    const uiLow = metrics.uiFps < 45
    const jsLow = metrics.jsFps < 45
    const uiCritical = metrics.uiFps < 30
    const jsCritical = metrics.jsFps < 30
    const ramHigh = metrics.ramBytes > 500 * 1024 * 1024
    const memGrowing = memoryTrend > 1

    if (uiLow && !jsLow) {
      result.push({
        severity: uiCritical ? 'critical' : 'warning',
        title: 'UI Thread Bottleneck',
        description: 'UI FPS is low while JS FPS is normal. This suggests heavy native view rendering, complex layouts, or expensive onLayout callbacks. Consider simplifying view hierarchies or using removeClippedSubviews.',
      })
    }

    if (jsLow && !uiLow) {
      result.push({
        severity: jsCritical ? 'critical' : 'warning',
        title: 'JS Thread Bottleneck',
        description: 'JS FPS is low while UI FPS is normal. This indicates heavy JavaScript computation, synchronous operations, or excessive re-renders. Consider moving work to background threads with InteractionManager or using useMemo/useCallback.',
      })
    }

    if (uiLow && jsLow) {
      result.push({
        severity: 'critical',
        title: 'Both Threads Overloaded',
        description: 'Both UI and JS threads are struggling. This may indicate too many components, excessive bridge calls, or large list rendering without virtualization. Consider profiling with React DevTools and Flipper.',
      })
    }

    if (memGrowing) {
      result.push({
        severity: memoryTrend > 3 ? 'critical' : 'warning',
        title: 'Memory Pressure Detected',
        description: `Memory is growing at ${memoryTrend.toFixed(1)} MB/min. Check for retained references, uncleaned subscriptions, or growing caches. Use the Memory tab to track trends.`,
      })
    }

    if (ramHigh) {
      result.push({
        severity: metrics.ramBytes > 800 * 1024 * 1024 ? 'critical' : 'warning',
        title: 'High Memory Usage',
        description: `RAM usage is ${(metrics.ramBytes / (1024 * 1024)).toFixed(0)} MB. On memory-constrained devices, this may trigger OOM kills. Consider reducing image cache sizes, paginating data, or unloading offscreen content.`,
      })
    }

    if (metrics.stutterCount > 0 && history) {
      const avgUi = history.uiFpsSamples.length > 0
        ? history.uiFpsSamples.reduce((a, b) => a + b, 0) / history.uiFpsSamples.length
        : 60

      if (avgUi > 50) {
        result.push({
          severity: 'info',
          title: 'Intermittent Stutters',
          description: 'Average FPS is good but stutters are occurring. This often indicates GC pauses, lazy module loading, or navigation transitions. Consider preloading screens and using InteractionManager.runAfterInteractions.',
        })
      }
    }

    if (result.length === 0) {
      result.push({
        severity: 'info',
        title: 'Performance Looks Good',
        description: 'No significant bottlenecks detected. All metrics are within normal ranges.',
      })
    }

    return result
  }, [metrics, history, memoryTrend])

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Bottleneck Analysis
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {suggestions.map((s, i) => (
          <div
            key={i}
            style={{
              background: `${severityColors[s.severity]}10`,
              border: `1px solid ${severityColors[s.severity]}40`,
              borderRadius: 6,
              padding: '10px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>{severityIcons[s.severity]}</span>
              <span style={{ color: severityColors[s.severity], fontSize: 13, fontWeight: 600 }}>
                {s.title}
              </span>
            </div>
            <div style={{ color: '#aaa', fontSize: 12, lineHeight: 1.5 }}>
              {s.description}
            </div>
          </div>
        ))}
      </div>

      {!metrics && (
        <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 20 }}>
          Start monitoring to see analysis
        </div>
      )}
    </div>
  )
}
