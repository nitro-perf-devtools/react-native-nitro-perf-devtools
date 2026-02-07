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

interface PerformanceScoreProps {
  metrics: PerfSnapshot | null
  memoryTrend: number  // MB/min growth rate
  stutterRate: number  // stutters per minute
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#4CAF50'
  if (score >= 60) return '#8BC34A'
  if (score >= 40) return '#FF9800'
  if (score >= 20) return '#F44336'
  return '#B71C1C'
}

export function PerformanceScore({ metrics, memoryTrend, stutterRate }: PerformanceScoreProps) {
  const { score, breakdown } = useMemo(() => {
    if (!metrics) return { score: 0, breakdown: [] }

    // UI FPS: 30->0pts, 60->100pts
    const uiFpsScore = clamp(((metrics.uiFps - 30) / 30) * 100, 0, 100)
    // JS FPS: 30->0pts, 60->100pts
    const jsFpsScore = clamp(((metrics.jsFps - 30) / 30) * 100, 0, 100)
    // Memory stability: 0 growth->100, >2MB/min->0
    const memScore = clamp((1 - Math.abs(memoryTrend) / 2) * 100, 0, 100)
    // Stutter rate: 0/min->100, >5/min->0
    const stutterScore = clamp((1 - stutterRate / 5) * 100, 0, 100)
    // Dropped frames: 0%->100, >10%->0
    const dropRate = metrics.droppedFrames / Math.max(1, metrics.timestamp / 1000 * 60)
    const dropScore = clamp((1 - dropRate / 10) * 100, 0, 100)

    const weights = [
      { label: 'UI FPS', score: uiFpsScore, weight: 0.30, color: '#2196F3' },
      { label: 'JS FPS', score: jsFpsScore, weight: 0.25, color: '#4CAF50' },
      { label: 'Memory', score: memScore, weight: 0.20, color: '#FF9800' },
      { label: 'Stutters', score: stutterScore, weight: 0.15, color: '#9C27B0' },
      { label: 'Dropped', score: dropScore, weight: 0.10, color: '#F44336' },
    ]

    const totalScore = weights.reduce((sum, w) => sum + w.score * w.weight, 0)

    return { score: Math.round(totalScore), breakdown: weights }
  }, [metrics, memoryTrend, stutterRate])

  // SVG gauge
  const radius = 60
  const stroke = 8
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const scoreColor = getScoreColor(score)

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Performance Score
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {/* Gauge */}
        <div style={{ position: 'relative', width: radius * 2 + stroke * 2, height: radius * 2 + stroke * 2 }}>
          <svg width={radius * 2 + stroke * 2} height={radius * 2 + stroke * 2}>
            {/* Background circle */}
            <circle
              cx={radius + stroke}
              cy={radius + stroke}
              r={radius}
              fill="none"
              stroke="#333"
              strokeWidth={stroke}
            />
            {/* Progress arc */}
            <circle
              cx={radius + stroke}
              cy={radius + stroke}
              r={radius}
              fill="none"
              stroke={scoreColor}
              strokeWidth={stroke}
              strokeDasharray={`${progress} ${circumference - progress}`}
              strokeDashoffset={circumference * 0.25}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          </svg>
          {/* Center text */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ color: scoreColor, fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {metrics ? score : '--'}
            </span>
            <span style={{ color: '#888', fontSize: 10 }}>/ 100</span>
          </div>
        </div>

        {/* Breakdown */}
        <div style={{ flex: 1 }}>
          {breakdown.map((item) => (
            <div key={item.label} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#aaa', fontSize: 11 }}>
                  {item.label} ({(item.weight * 100).toFixed(0)}%)
                </span>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(item.score)}
                </span>
              </div>
              <div style={{ height: 4, background: '#333', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${item.score}%`,
                  background: item.color,
                  borderRadius: 2,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
