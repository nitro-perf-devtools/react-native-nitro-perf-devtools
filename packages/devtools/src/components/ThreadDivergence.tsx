import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface ThreadDivergenceProps {
  fpsData: { uiFps: number; jsFps: number }[]
}

interface ChartDataPoint {
  index: number
  uiFps: number
  jsFps: number
  divergenceTop: number
  divergenceBottom: number
  divergent: boolean
}

export function ThreadDivergence({ fpsData }: ThreadDivergenceProps) {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    return fpsData.map((d, i) => {
      const diff = Math.abs(d.uiFps - d.jsFps)
      const top = Math.max(d.uiFps, d.jsFps)
      const bottom = Math.min(d.uiFps, d.jsFps)
      return {
        index: i,
        uiFps: Math.round(d.uiFps),
        jsFps: Math.round(d.jsFps),
        divergenceTop: top,
        divergenceBottom: bottom,
        divergent: diff > 10,
      }
    })
  }, [fpsData])

  const currentDivergence = useMemo(() => {
    if (fpsData.length === 0) return 0
    const last = fpsData[fpsData.length - 1]
    return Math.round(last.uiFps - last.jsFps)
  }, [fpsData])

  const averageDivergence = useMemo(() => {
    if (fpsData.length === 0) return 0
    const sum = fpsData.reduce((acc, d) => acc + Math.abs(d.uiFps - d.jsFps), 0)
    return sum / fpsData.length
  }, [fpsData])

  const bottleneckLabel = useMemo(() => {
    if (fpsData.length === 0) return { text: 'Balanced', color: '#4CAF50' }
    const last = fpsData[fpsData.length - 1]
    const diff = last.uiFps - last.jsFps
    if (diff < -10) return { text: 'UI Bottleneck', color: '#F44336' }
    if (diff > 10) return { text: 'JS Bottleneck', color: '#FF9800' }
    return { text: 'Balanced', color: '#4CAF50' }
  }, [fpsData])

  const divergenceColor = useMemo(() => {
    const abs = Math.abs(currentDivergence)
    if (abs > 20) return '#F44336'
    if (abs > 10) return '#FF9800'
    return '#4CAF50'
  }, [currentDivergence])

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Thread Divergence
      </div>

      {fpsData.length === 0 ? (
        <div style={{ color: '#888', fontSize: 12, textAlign: 'center', padding: 40 }}>
          No data yet
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="divergenceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F44336" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#F44336" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="index"
                stroke="#666"
                tick={{ fontSize: 10 }}
                label={{ value: 'Samples', position: 'insideBottom', offset: -5, fill: '#666', fontSize: 10 }}
              />
              <YAxis
                domain={[0, 70]}
                stroke="#666"
                tick={{ fontSize: 10 }}
                label={{ value: 'FPS', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{ background: '#2a2a2a', border: '1px solid #444', borderRadius: 4 }}
                labelStyle={{ color: '#888' }}
                formatter={(value: number, name: string) => {
                  if (name === 'Divergence') return null
                  return [value, name]
                }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const point = chartData[label as number]
                  if (!point) return null
                  const diff = point.uiFps - point.jsFps
                  return (
                    <div style={{
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: 4,
                      padding: 8,
                      fontSize: 12,
                    }}>
                      <div style={{ color: '#888', marginBottom: 4 }}>Sample {label}</div>
                      <div style={{ color: '#2196F3' }}>UI FPS: {point.uiFps}</div>
                      <div style={{ color: '#4CAF50' }}>JS FPS: {point.jsFps}</div>
                      <div style={{ color: Math.abs(diff) > 10 ? '#F44336' : '#aaa', marginTop: 4 }}>
                        Divergence: {diff > 0 ? '+' : ''}{diff} FPS
                      </div>
                    </div>
                  )
                }}
              />
              <Legend />
              <ReferenceLine
                y={60}
                stroke="#555"
                strokeDasharray="3 3"
                label={{ value: '60 FPS', fill: '#666', fontSize: 10, position: 'right' }}
              />
              {/* Shaded divergence area — rendered as top area minus bottom area */}
              <Area
                type="monotone"
                dataKey="divergenceTop"
                stroke="none"
                fill="#F4433640"
                fillOpacity={1}
                isAnimationActive={false}
                name="Divergence"
                legendType="none"
              />
              <Area
                type="monotone"
                dataKey="divergenceBottom"
                stroke="none"
                fill="#1e1e1e"
                fillOpacity={1}
                isAnimationActive={false}
                legendType="none"
              />
              {/* UI FPS line */}
              <Area
                type="monotone"
                dataKey="uiFps"
                stroke="#2196F3"
                strokeWidth={2}
                fill="none"
                dot={false}
                name="UI FPS"
                isAnimationActive={false}
              />
              {/* JS FPS line */}
              <Area
                type="monotone"
                dataKey="jsFps"
                stroke="#4CAF50"
                strokeWidth={2}
                fill="none"
                dot={false}
                name="JS FPS"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Thread Health Summary */}
          <div style={{
            display: 'flex',
            gap: 24,
            marginTop: 12,
            padding: '10px 0',
            borderTop: '1px solid #333',
          }}>
            <div>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>Current Divergence</div>
              <div style={{ color: divergenceColor, fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {currentDivergence > 0 ? '+' : ''}{currentDivergence} FPS
              </div>
            </div>
            <div>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>Status</div>
              <div style={{ color: bottleneckLabel.color, fontSize: 16, fontWeight: 700 }}>
                {bottleneckLabel.text}
              </div>
            </div>
            <div>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>Avg Divergence</div>
              <div style={{ color: '#aaa', fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {averageDivergence.toFixed(1)} FPS
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
