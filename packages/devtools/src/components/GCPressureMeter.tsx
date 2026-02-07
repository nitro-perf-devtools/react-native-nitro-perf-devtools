import React, { useMemo } from 'react'

interface MemoryDataPoint {
  timestamp: number
  ramMB: number
  heapUsedMB: number
  heapTotalMB: number
}

interface GCPressureMeterProps {
  memoryData: MemoryDataPoint[]
}

interface GCEvent {
  timestamp: number
  freedMB: number
  index: number
}

function getUtilizationColor(pct: number): string {
  if (pct >= 80) return '#F44336'
  if (pct >= 60) return '#FF9800'
  return '#4CAF50'
}

function getChurnColor(mbPerSec: number): string {
  if (mbPerSec > 5) return '#F44336'
  if (mbPerSec >= 1) return '#FF9800'
  return '#4CAF50'
}

export function GCPressureMeter({ memoryData }: GCPressureMeterProps) {
  // Current heap utilization
  const utilization = useMemo(() => {
    if (memoryData.length === 0) return null
    const latest = memoryData[memoryData.length - 1]
    if (latest.heapTotalMB === 0) return null
    const pct = (latest.heapUsedMB / latest.heapTotalMB) * 100
    return {
      percentage: Math.min(pct, 100),
      usedMB: latest.heapUsedMB,
      totalMB: latest.heapTotalMB,
    }
  }, [memoryData])

  // Detect GC events: heapUsedMB drops by >5MB between consecutive samples
  const gcEvents = useMemo<GCEvent[]>(() => {
    const events: GCEvent[] = []
    for (let i = 1; i < memoryData.length; i++) {
      const drop = memoryData[i - 1].heapUsedMB - memoryData[i].heapUsedMB
      if (drop > 5) {
        events.push({
          timestamp: memoryData[i].timestamp,
          freedMB: drop,
          index: i,
        })
      }
    }
    return events
  }, [memoryData])

  // Heap churn rate: average heap growth rate between GC events (MB/sec)
  const churnRate = useMemo(() => {
    if (gcEvents.length === 0 || memoryData.length < 3) return null

    // Measure growth rate between consecutive GC events (or from start to first GC)
    const growthRates: number[] = []

    // Segments: start-of-data -> first GC, between GCs, last GC -> end-of-data
    const boundaries = [0, ...gcEvents.map((e) => e.index)]

    for (let b = 0; b < boundaries.length; b++) {
      const segStart = boundaries[b]
      const segEnd = b + 1 < boundaries.length ? boundaries[b + 1] : memoryData.length - 1
      if (segEnd <= segStart) continue

      const startPoint = memoryData[segStart]
      const endPoint = memoryData[segEnd]
      const elapsedSec = (endPoint.timestamp - startPoint.timestamp) / 1000
      if (elapsedSec <= 0) continue

      const growth = endPoint.heapUsedMB - startPoint.heapUsedMB
      if (growth > 0) {
        growthRates.push(growth / elapsedSec)
      }
    }

    if (growthRates.length === 0) return null
    return growthRates.reduce((a, b) => a + b, 0) / growthRates.length
  }, [memoryData, gcEvents])

  // Mini sparkline: last 30 heapUsedMB values
  const sparklinePoints = useMemo(() => {
    const recent = memoryData.slice(-30)
    if (recent.length < 2) return null

    const values = recent.map((d) => d.heapUsedMB)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const height = 40
    const padding = 4

    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * 100
      const y = padding + (1 - (v - min) / range) * (height - padding * 2)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })

    return points.join(' ')
  }, [memoryData])

  // SVG arc gauge parameters
  const gaugeRadius = 60
  const gaugeStroke = 10
  const gaugeCx = 80
  const gaugeCy = 70
  const startAngle = Math.PI // 180 degrees (left)
  const endAngle = 2 * Math.PI // 360 degrees (right)

  function describeArc(pct: number): string {
    const angle = startAngle + (pct / 100) * (endAngle - startAngle)
    const startX = gaugeCx + gaugeRadius * Math.cos(startAngle)
    const startY = gaugeCy + gaugeRadius * Math.sin(startAngle)
    const endX = gaugeCx + gaugeRadius * Math.cos(angle)
    const endY = gaugeCy + gaugeRadius * Math.sin(angle)
    const largeArc = pct > 50 ? 1 : 0
    return `M ${startX} ${startY} A ${gaugeRadius} ${gaugeRadius} 0 ${largeArc} 1 ${endX} ${endY}`
  }

  // Early return for insufficient data
  if (memoryData.length < 3) {
    return (
      <div style={{
        background: '#1e1e1e',
        borderRadius: 8,
        padding: 16,
      }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          GC Pressure
        </div>
        <div style={{ color: '#888', fontSize: 12, textAlign: 'center', padding: 20 }}>
          Collecting heap data...
        </div>
      </div>
    )
  }

  const pct = utilization?.percentage ?? 0
  const arcColor = getUtilizationColor(pct)

  return (
    <div style={{
      background: '#1e1e1e',
      borderRadius: 8,
      padding: 16,
    }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
        GC Pressure
      </div>

      {/* Heap Utilization Gauge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
        <div style={{ flexShrink: 0 }}>
          <svg width={160} height={90} viewBox="0 0 160 90">
            {/* Background arc (full semicircle) */}
            <path
              d={describeArc(100)}
              fill="none"
              stroke="#333"
              strokeWidth={gaugeStroke}
              strokeLinecap="round"
            />
            {/* Filled arc */}
            {pct > 0 && (
              <path
                d={describeArc(pct)}
                fill="none"
                stroke={arcColor}
                strokeWidth={gaugeStroke}
                strokeLinecap="round"
              />
            )}
            {/* Percentage text in center */}
            <text
              x={gaugeCx}
              y={gaugeCy - 8}
              textAnchor="middle"
              fill={arcColor}
              fontSize="22"
              fontWeight="700"
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            >
              {Math.round(pct)}%
            </text>
            {/* Label */}
            <text
              x={gaugeCx}
              y={gaugeCy + 10}
              textAnchor="middle"
              fill="#888"
              fontSize="9"
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            >
              Heap Utilization
            </text>
          </svg>
        </div>

        <div>
          <div style={{ color: '#aaa', fontSize: 12, marginBottom: 4 }}>
            Used: {utilization?.usedMB.toFixed(1)} MB / Total: {utilization?.totalMB.toFixed(1)} MB
          </div>

          {/* Heap Churn Rate */}
          {churnRate !== null && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>Heap Churn Rate</div>
              <div style={{
                color: getChurnColor(churnRate),
                fontSize: 16,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {churnRate.toFixed(2)} MB/s
              </div>
            </div>
          )}
          {churnRate === null && gcEvents.length === 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>Heap Churn Rate</div>
              <div style={{ color: '#666', fontSize: 12 }}>
                No GC events to calculate
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mini Sparkline */}
      {sparklinePoints && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Heap Used (recent)</div>
          <svg
            width="100%"
            height={40}
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            style={{ display: 'block' }}
          >
            <polyline
              points={sparklinePoints}
              fill="none"
              stroke="#4CAF50"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      )}

      {/* GC Events */}
      <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
        <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          {gcEvents.length} GC event{gcEvents.length !== 1 ? 's' : ''} detected
        </div>

        {gcEvents.length === 0 ? (
          <div style={{ color: '#888', fontSize: 12, textAlign: 'center', padding: 8 }}>
            No GC events detected yet
          </div>
        ) : (
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Freed</th>
                </tr>
              </thead>
              <tbody>
                {gcEvents.slice().reverse().map((event, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={tdStyle}>{gcEvents.length - i}</td>
                    <td style={tdStyle}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{
                      ...tdStyle,
                      color: '#4CAF50',
                      fontWeight: 600,
                    }}>
                      {event.freedMB.toFixed(1)} MB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  color: '#888',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
}

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  color: '#ccc',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
}
