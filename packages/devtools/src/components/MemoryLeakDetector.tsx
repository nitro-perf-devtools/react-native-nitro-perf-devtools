import React, { useMemo } from 'react'

interface MemoryDataPoint {
  timestamp: number
  ramMB: number
  heapUsedMB: number
  heapTotalMB: number
}

interface MemoryLeakDetectorProps {
  dataPoints: MemoryDataPoint[]
}

function linearRegression(points: { x: number; y: number }[]): { slope: number; r2: number } {
  const n = points.length
  if (n < 2) return { slope: 0, r2: 0 }

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0
  for (const p of points) {
    sumX += p.x
    sumY += p.y
    sumXY += p.x * p.y
    sumX2 += p.x * p.x
    sumY2 += p.y * p.y
  }

  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { slope: 0, r2: 0 }

  const slope = (n * sumXY - sumX * sumY) / denom
  const ssRes = points.reduce((sum, p) => {
    const predicted = (sumY / n) + slope * (p.x - sumX / n)
    return sum + (p.y - predicted) ** 2
  }, 0)
  const ssTot = points.reduce((sum, p) => sum + (p.y - sumY / n) ** 2, 0)
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot

  return { slope, r2 }
}

export function MemoryLeakDetector({ dataPoints }: MemoryLeakDetectorProps) {
  const analysis = useMemo(() => {
    if (dataPoints.length < 5) return null

    const startTime = dataPoints[0].timestamp
    const ramPoints = dataPoints.map((d) => ({ x: (d.timestamp - startTime) / 60000, y: d.ramMB }))
    const heapPoints = dataPoints.map((d) => ({ x: (d.timestamp - startTime) / 60000, y: d.heapUsedMB }))

    const ramTrend = linearRegression(ramPoints)
    const heapTrend = linearRegression(heapPoints)

    // Slope is in MB/minute
    const ramGrowthRate = ramTrend.slope
    const heapGrowthRate = heapTrend.slope

    const isRamLeaking = ramGrowthRate > 1 && dataPoints.length > 30
    const isHeapLeaking = heapGrowthRate > 0.5 && dataPoints.length > 30

    return {
      ramGrowthRate,
      heapGrowthRate,
      ramR2: ramTrend.r2,
      heapR2: heapTrend.r2,
      isRamLeaking,
      isHeapLeaking,
      hasEnoughData: dataPoints.length > 30,
    }
  }, [dataPoints])

  function getTrendIcon(rate: number): string {
    if (rate > 1) return '\u2B06'
    if (rate > 0.2) return '\u2197'
    if (rate > -0.2) return '\u2192'
    if (rate > -1) return '\u2198'
    return '\u2B07'
  }

  function getTrendColor(rate: number): string {
    if (rate > 1) return '#F44336'
    if (rate > 0.2) return '#FF9800'
    if (rate > -0.2) return '#4CAF50'
    return '#2196F3'
  }

  // Mini sparkline
  const sparkline = useMemo(() => {
    const recent = dataPoints.slice(-30)
    if (recent.length < 2) return null
    const min = Math.min(...recent.map((d) => d.ramMB))
    const max = Math.max(...recent.map((d) => d.ramMB))
    const range = max - min || 1
    return recent.map((d) => ((d.ramMB - min) / range) * 20)
  }, [dataPoints])

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Memory Leak Detector
      </div>

      {!analysis && (
        <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 20 }}>
          Collecting data... ({dataPoints.length}/30 samples needed)
        </div>
      )}

      {analysis && (
        <>
          {/* Warning banner */}
          {(analysis.isRamLeaking || analysis.isHeapLeaking) && (
            <div style={{
              background: '#F4433620',
              border: '1px solid #F44336',
              borderRadius: 6,
              padding: '10px 14px',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>{'\u26A0'}</span>
              <div>
                <div style={{ color: '#F44336', fontSize: 13, fontWeight: 600 }}>
                  Potential Memory Leak Detected
                </div>
                <div style={{ color: '#FF8A80', fontSize: 11 }}>
                  {analysis.isRamLeaking && `RAM growing at ${analysis.ramGrowthRate.toFixed(1)} MB/min. `}
                  {analysis.isHeapLeaking && `JS Heap growing at ${analysis.heapGrowthRate.toFixed(1)} MB/min.`}
                </div>
              </div>
            </div>
          )}

          {/* Trend indicators */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>RAM Trend</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20, color: getTrendColor(analysis.ramGrowthRate) }}>
                  {getTrendIcon(analysis.ramGrowthRate)}
                </span>
                <div>
                  <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {analysis.ramGrowthRate >= 0 ? '+' : ''}{analysis.ramGrowthRate.toFixed(2)} MB/min
                  </div>
                  <div style={{ color: '#666', fontSize: 10 }}>
                    R² = {analysis.ramR2.toFixed(3)}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>JS Heap Trend</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20, color: getTrendColor(analysis.heapGrowthRate) }}>
                  {getTrendIcon(analysis.heapGrowthRate)}
                </span>
                <div>
                  <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {analysis.heapGrowthRate >= 0 ? '+' : ''}{analysis.heapGrowthRate.toFixed(2)} MB/min
                  </div>
                  <div style={{ color: '#666', fontSize: 10 }}>
                    R² = {analysis.heapR2.toFixed(3)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mini sparkline */}
          {sparkline && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', height: 24, gap: 1 }}>
              {sparkline.map((h, i) => (
                <div key={i} style={{
                  flex: 1,
                  height: Math.max(2, h),
                  background: getTrendColor(analysis.ramGrowthRate),
                  borderRadius: 1,
                  opacity: 0.6 + (i / sparkline.length) * 0.4,
                }} />
              ))}
            </div>
          )}

          {!analysis.hasEnoughData && (
            <div style={{ color: '#888', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
              More data needed for reliable detection (30+ seconds)
            </div>
          )}
        </>
      )}
    </div>
  )
}
