import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'

interface FrameTimeEntry {
  timestamp: number
  frameTimeMs: number
  budgetMs: number
}

interface FrameBudgetTimelineProps {
  frameTimes: FrameTimeEntry[]
  maxFrames?: number
}

export function FrameBudgetTimeline({ frameTimes, maxFrames = 120 }: FrameBudgetTimelineProps) {
  const data = useMemo(() => {
    return frameTimes.slice(-maxFrames).map((ft, i) => ({
      index: i,
      frameTime: parseFloat(ft.frameTimeMs.toFixed(1)),
      budget: ft.budgetMs,
      overBudget: ft.frameTimeMs > ft.budgetMs,
    }))
  }, [frameTimes, maxFrames])

  const budgetMs = frameTimes.length > 0 ? frameTimes[0].budgetMs : 16.67
  const overBudgetCount = data.filter((d) => d.overBudget).length
  const overBudgetPct = data.length > 0 ? ((overBudgetCount / data.length) * 100).toFixed(1) : '0'

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
            Frame Budget
          </span>
          <span style={{ color: '#888', fontSize: 11, marginLeft: 12, fontWeight: 400 }}>
            {budgetMs.toFixed(1)}ms target
          </span>
        </div>
        <div style={{
          color: overBudgetCount > 0 ? '#F44336' : '#4CAF50',
          fontSize: 12,
          fontWeight: 600,
        }}>
          {overBudgetPct}% over budget ({overBudgetCount}/{data.length})
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="index"
            stroke="#666"
            tick={{ fontSize: 9 }}
          />
          <YAxis
            stroke="#666"
            tick={{ fontSize: 10 }}
            domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, budgetMs * 2)]}
            label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ background: '#2a2a2a', border: '1px solid #444', borderRadius: 4 }}
            labelStyle={{ color: '#888' }}
            formatter={(value: number) => [`${value}ms`]}
          />
          <ReferenceLine
            y={budgetMs}
            stroke="#FF9800"
            strokeDasharray="4 4"
            strokeWidth={2}
            label={{ value: `${budgetMs.toFixed(1)}ms`, fill: '#FF9800', fontSize: 10, position: 'right' }}
          />
          <Bar dataKey="frameTime" isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.overBudget ? '#F44336' : '#4CAF50'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {frameTimes.length === 0 && (
        <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 20 }}>
          No frame data yet
        </div>
      )}
    </div>
  )
}
