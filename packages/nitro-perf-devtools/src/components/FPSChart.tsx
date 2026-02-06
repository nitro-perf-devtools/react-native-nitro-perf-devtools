import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface FPSHistory {
  uiFpsSamples: number[]
  jsFpsSamples: number[]
  uiFpsMin: number
  uiFpsMax: number
  jsFpsMin: number
  jsFpsMax: number
}

export function FPSChart({
  history,
  targetFps = 60,
}: {
  history: FPSHistory | null
  targetFps?: number
}) {
  const data = useMemo(() => {
    if (!history) return []

    const maxLen = Math.max(
      history.uiFpsSamples.length,
      history.jsFpsSamples.length
    )

    return Array.from({ length: maxLen }, (_, i) => ({
      index: i,
      uiFps: history.uiFpsSamples[i] ?? null,
      jsFps: history.jsFpsSamples[i] ?? null,
    }))
  }, [history])

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        FPS Over Time
        {history && (
          <span style={{ color: '#888', fontSize: 11, marginLeft: 12, fontWeight: 400 }}>
            UI: {history.uiFpsMin}-{history.uiFpsMax} | JS: {history.jsFpsMin}-{history.jsFpsMax}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="index"
            stroke="#666"
            tick={{ fontSize: 10 }}
            label={{ value: 'Seconds', position: 'insideBottom', offset: -5, fill: '#666', fontSize: 10 }}
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
          />
          <Legend />
          <ReferenceLine
            y={targetFps}
            stroke="#555"
            strokeDasharray="3 3"
            label={{ value: `${targetFps} FPS`, fill: '#666', fontSize: 10, position: 'right' }}
          />
          <Line
            type="monotone"
            dataKey="uiFps"
            stroke="#2196F3"
            strokeWidth={2}
            dot={false}
            name="UI FPS"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="jsFps"
            stroke="#4CAF50"
            strokeWidth={2}
            dot={false}
            name="JS FPS"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
