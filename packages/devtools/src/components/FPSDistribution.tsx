import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface FPSDistributionProps {
  fpsSamples: number[]
}

const BINS = [
  { label: '0-10', min: 0, max: 10, color: '#B71C1C' },
  { label: '10-20', min: 10, max: 20, color: '#F44336' },
  { label: '20-30', min: 20, max: 30, color: '#FF5722' },
  { label: '30-40', min: 30, max: 40, color: '#FF9800' },
  { label: '40-50', min: 40, max: 50, color: '#FFC107' },
  { label: '50-55', min: 50, max: 55, color: '#8BC34A' },
  { label: '55-60', min: 55, max: 60, color: '#4CAF50' },
  { label: '60+', min: 60, max: Infinity, color: '#1B5E20' },
]

export function FPSDistribution({ fpsSamples }: FPSDistributionProps) {
  const data = useMemo(() => {
    const total = fpsSamples.length || 1
    return BINS.map((bin) => {
      const count = fpsSamples.filter(
        (fps) => fps >= bin.min && (bin.max === Infinity ? true : fps < bin.max)
      ).length
      return {
        name: bin.label,
        count,
        percentage: parseFloat(((count / total) * 100).toFixed(1)),
        color: bin.color,
      }
    })
  }, [fpsSamples])

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        FPS Distribution
        <span style={{ color: '#888', fontSize: 11, marginLeft: 12, fontWeight: 400 }}>
          {fpsSamples.length} samples
        </span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="name"
            stroke="#666"
            tick={{ fontSize: 10 }}
          />
          <YAxis
            stroke="#666"
            tick={{ fontSize: 10 }}
            label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ background: '#2a2a2a', border: '1px solid #444', borderRadius: 4 }}
            labelStyle={{ color: '#888' }}
            formatter={(value: number) => [`${value}%`, 'Time']}
          />
          <Bar dataKey="percentage" isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {fpsSamples.length === 0 && (
        <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 20 }}>
          No FPS data yet
        </div>
      )}
    </div>
  )
}
