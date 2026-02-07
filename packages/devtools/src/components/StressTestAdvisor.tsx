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

interface StressTestAdvisorProps {
  metrics: PerfSnapshot | null
  memoryTrend: number  // MB/min
  stutterRate: number  // stutters/min
  fpsData: { uiFps: number; jsFps: number }[]
}

type Severity = 'healthy' | 'warning' | 'critical'

interface Recommendation {
  severity: Severity
  icon: string
  title: string
  description: string
}

const severityColors: Record<Severity, string> = {
  healthy: '#4CAF50',
  warning: '#FF9800',
  critical: '#F44336',
}

const severityIcons: Record<Severity, string> = {
  healthy: '\u2705',
  warning: '\u26A0\uFE0F',
  critical: '\uD83D\uDED1',
}

function getRecentSamples(fpsData: { uiFps: number; jsFps: number }[]): { uiFps: number; jsFps: number }[] {
  return fpsData.slice(-10)
}

function avgOf(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function countBelow(values: number[], threshold: number): number {
  return values.filter((v) => v < threshold).length
}

export function StressTestAdvisor({ metrics, memoryTrend, stutterRate, fpsData }: StressTestAdvisorProps) {
  const recommendations = useMemo<Recommendation[]>(() => {
    if (!metrics) return []

    const recent = getRecentSamples(fpsData)
    const recentUiFps = recent.map((d) => d.uiFps)
    const recentJsFps = recent.map((d) => d.jsFps)
    const avgUi = avgOf(recentUiFps)
    const avgJs = avgOf(recentJsFps)
    const uiBelowCount = countBelow(recentUiFps, 45)
    const jsBelowCount = countBelow(recentJsFps, 45)
    const sampleCount = recent.length
    const consistentThreshold = Math.max(1, Math.floor(sampleCount * 0.6))

    const heapUsageRatio = metrics.jsHeapTotalBytes > 0
      ? metrics.jsHeapUsedBytes / metrics.jsHeapTotalBytes
      : 0

    const result: Recommendation[] = []

    // 1. UI Thread Saturation: UI FPS consistently <45 while JS FPS >50
    if (uiBelowCount >= consistentThreshold && avgJs > 50) {
      result.push({
        severity: avgUi < 30 ? 'critical' : 'warning',
        icon: '\uD83D\uDDA5\uFE0F',
        title: 'UI Thread Saturation',
        description:
          'The UI thread is saturated. This typically happens with heavy Reanimated worklets, complex layouts, or shadow calculations. Try reducing the number of animated views or simplifying transforms.',
      })
    }

    // 2. JS Thread Saturation: JS FPS consistently <45 while UI FPS >50
    if (jsBelowCount >= consistentThreshold && avgUi > 50) {
      result.push({
        severity: avgJs < 30 ? 'critical' : 'warning',
        icon: '\u2699\uFE0F',
        title: 'JS Thread Saturation',
        description:
          'The JS thread is saturated. This indicates heavy React reconciliation, frequent state updates, or expensive computations. Profile with React DevTools to find hot components.',
      })
    }

    // 3. Both Threads Overloaded
    if (uiBelowCount >= consistentThreshold && jsBelowCount >= consistentThreshold) {
      result.push({
        severity: 'critical',
        icon: '\uD83D\uDD25',
        title: 'Full Pipeline Stall',
        description:
          'Both UI and JS threads are consistently below 45 FPS. The entire render pipeline is under strain. Consider reducing component count, disabling animations, and profiling with systrace.',
      })
    }

    // 4. GC Thrashing: Heap usage >70% AND stutterRate >3/min
    if (heapUsageRatio > 0.7 && stutterRate > 3) {
      result.push({
        severity: 'critical',
        icon: '\uD83D\uDDD1\uFE0F',
        title: 'GC Thrashing',
        description:
          'GC pressure is causing stutters. The JS heap is near capacity and frequent garbage collection is interrupting frame delivery. Reduce object allocation per frame.',
      })
    }

    // 5. Memory Leak: memoryTrend > 2 MB/min sustained
    if (memoryTrend > 2) {
      result.push({
        severity: memoryTrend > 5 ? 'critical' : 'warning',
        icon: '\uD83D\uDCA7',
        title: 'Memory Leak Suspected',
        description:
          `Possible memory leak detected. RAM is growing steadily at ${memoryTrend.toFixed(1)} MB/min. Check for retained subscriptions, growing arrays, or cached data that isn't being released.`,
      })
    }

    // 6. High Dropped Frame Rate
    if (metrics.droppedFrames > 0) {
      const elapsedSeconds = Math.max(1, metrics.timestamp / 1000)
      const dropsPerMinute = (metrics.droppedFrames / elapsedSeconds) * 60
      if (dropsPerMinute > 10) {
        result.push({
          severity: dropsPerMinute > 30 ? 'critical' : 'warning',
          icon: '\uD83D\uDCC9',
          title: 'Excessive Frame Drops',
          description:
            `Dropping ~${Math.round(dropsPerMinute)} frames/min. Users will perceive noticeable jank. Check for synchronous bridge calls, large state updates, or unoptimized list rendering.`,
        })
      }
    }

    // 7. Heap Fragmentation / Near Capacity
    if (heapUsageRatio > 0.85 && stutterRate <= 3) {
      result.push({
        severity: 'warning',
        icon: '\uD83E\uDDE0',
        title: 'Heap Near Capacity',
        description:
          `JS heap is at ${(heapUsageRatio * 100).toFixed(0)}% utilization (${(metrics.jsHeapUsedBytes / (1024 * 1024)).toFixed(0)} / ${(metrics.jsHeapTotalBytes / (1024 * 1024)).toFixed(0)} MB). While stutters are still low, the engine may soon start aggressive GC. Consider reducing retained objects.`,
      })
    }

    // 8. FPS Instability (high variance)
    if (recentUiFps.length >= 5) {
      const uiVariance = recentUiFps.reduce((sum, v) => sum + Math.pow(v - avgUi, 2), 0) / recentUiFps.length
      const jsVariance = recentJsFps.reduce((sum, v) => sum + Math.pow(v - avgJs, 2), 0) / recentJsFps.length
      const uiStdDev = Math.sqrt(uiVariance)
      const jsStdDev = Math.sqrt(jsVariance)

      if (uiStdDev > 12 || jsStdDev > 12) {
        result.push({
          severity: 'warning',
          icon: '\uD83C\uDF0A',
          title: 'FPS Instability',
          description:
            `Frame rate is highly variable (UI stddev: ${uiStdDev.toFixed(1)}, JS stddev: ${jsStdDev.toFixed(1)}). This suggests intermittent heavy work or competing background tasks. Look for periodic timers, network callbacks, or batched state updates.`,
        })
      }
    }

    // 9. Smooth Performance: Both FPS >55, memoryTrend <0.5, stutterRate <1
    if (avgUi > 55 && avgJs > 55 && memoryTrend < 0.5 && stutterRate < 1) {
      result.push({
        severity: 'healthy',
        icon: '\u2705',
        title: 'Smooth Performance',
        description:
          'Performance looks healthy. Both threads are running smoothly with stable memory.',
      })
    }

    // If no patterns matched at all, provide a neutral status
    if (result.length === 0) {
      result.push({
        severity: 'healthy',
        icon: '\uD83D\uDD0D',
        title: 'Monitoring Active',
        description:
          'No significant issues detected yet. Continue running the stress test to collect more data for analysis.',
      })
    }

    return result
  }, [metrics, memoryTrend, stutterRate, fpsData])

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Stress Test Advisor
      </div>

      {!metrics ? (
        <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 20 }}>
          Start monitoring to see recommendations
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recommendations.map((rec, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                background: `${severityColors[rec.severity]}08`,
                border: `1px solid ${severityColors[rec.severity]}30`,
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              {/* Left color bar */}
              <div
                style={{
                  width: 4,
                  flexShrink: 0,
                  background: severityColors[rec.severity],
                }}
              />

              {/* Card content */}
              <div style={{ padding: '10px 14px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{rec.icon}</span>
                  <span
                    style={{
                      color: severityColors[rec.severity],
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {rec.title}
                  </span>
                </div>
                <div style={{ color: '#aaa', fontSize: 12, lineHeight: 1.5 }}>
                  {rec.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
