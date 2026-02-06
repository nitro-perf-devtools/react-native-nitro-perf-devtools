import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface MemoryDataPoint {
  timestamp: number
  ramMB: number
  heapUsedMB: number
  heapTotalMB: number
}

export function MemoryChart({
  dataPoints,
}: {
  dataPoints: MemoryDataPoint[]
}) {
  const data = useMemo(() => {
    return dataPoints.map((point, i) => ({
      index: i,
      ramMB: parseFloat(point.ramMB.toFixed(1)),
      heapUsedMB: parseFloat(point.heapUsedMB.toFixed(1)),
      heapTotalMB: parseFloat(point.heapTotalMB.toFixed(1)),
    }))
  }, [dataPoints])

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Memory Usage
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="index"
            stroke="#666"
            tick={{ fontSize: 10 }}
            label={{ value: 'Samples', position: 'insideBottom', offset: -5, fill: '#666', fontSize: 10 }}
          />
          <YAxis
            stroke="#666"
            tick={{ fontSize: 10 }}
            label={{ value: 'MB', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ background: '#2a2a2a', border: '1px solid #444', borderRadius: 4 }}
            labelStyle={{ color: '#888' }}
            formatter={(value: number) => [`${value} MB`]}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="ramMB"
            stroke="#FF9800"
            fill="#FF980033"
            strokeWidth={2}
            name="RAM"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="heapUsedMB"
            stroke="#9C27B0"
            fill="#9C27B033"
            strokeWidth={2}
            name="JS Heap Used"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="heapTotalMB"
            stroke="#673AB7"
            fill="#673AB733"
            strokeWidth={1}
            strokeDasharray="3 3"
            name="JS Heap Total"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
