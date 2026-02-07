import React, { useMemo } from 'react'
import {
  ScatterChart,
  Scatter,
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

interface CorrelationViewProps {
  memoryData: MemoryDataPoint[]
  fpsData: { uiFps: number; jsFps: number }[]
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 3) return 0

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0
  for (let i = 0; i < n; i++) {
    sumX += x[i]
    sumY += y[i]
    sumXY += x[i] * y[i]
    sumX2 += x[i] * x[i]
    sumY2 += y[i] * y[i]
  }

  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}

export function CorrelationView({ memoryData, fpsData }: CorrelationViewProps) {
  const { uiData, jsData, uiCorr, jsCorr } = useMemo(() => {
    const len = Math.min(memoryData.length, fpsData.length)
    const ui: { ram: number; fps: number }[] = []
    const js: { ram: number; fps: number }[] = []
    const ramArr: number[] = []
    const uiFpsArr: number[] = []
    const jsFpsArr: number[] = []

    for (let i = 0; i < len; i++) {
      const ram = memoryData[i].ramMB
      ui.push({ ram, fps: fpsData[i].uiFps })
      js.push({ ram, fps: fpsData[i].jsFps })
      ramArr.push(ram)
      uiFpsArr.push(fpsData[i].uiFps)
      jsFpsArr.push(fpsData[i].jsFps)
    }

    return {
      uiData: ui,
      jsData: js,
      uiCorr: pearsonCorrelation(ramArr, uiFpsArr),
      jsCorr: pearsonCorrelation(ramArr, jsFpsArr),
    }
  }, [memoryData, fpsData])

  function getCorrLabel(r: number): string {
    const abs = Math.abs(r)
    if (abs > 0.7) return 'Strong'
    if (abs > 0.4) return 'Moderate'
    if (abs > 0.2) return 'Weak'
    return 'None'
  }

  function getCorrColor(r: number): string {
    const abs = Math.abs(r)
    if (abs > 0.7) return '#F44336'
    if (abs > 0.4) return '#FF9800'
    return '#4CAF50'
  }

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        FPS vs Memory Correlation
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <span style={{ fontSize: 11 }}>
          <span style={{ color: '#888' }}>UI FPS r = </span>
          <span style={{ color: getCorrColor(uiCorr), fontWeight: 600 }}>
            {uiCorr.toFixed(3)} ({getCorrLabel(uiCorr)})
          </span>
        </span>
        <span style={{ fontSize: 11 }}>
          <span style={{ color: '#888' }}>JS FPS r = </span>
          <span style={{ color: getCorrColor(jsCorr), fontWeight: 600 }}>
            {jsCorr.toFixed(3)} ({getCorrLabel(jsCorr)})
          </span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="ram"
            type="number"
            name="RAM"
            unit=" MB"
            stroke="#666"
            tick={{ fontSize: 10 }}
            label={{ value: 'RAM (MB)', position: 'insideBottom', offset: -5, fill: '#666', fontSize: 10 }}
          />
          <YAxis
            dataKey="fps"
            type="number"
            name="FPS"
            stroke="#666"
            tick={{ fontSize: 10 }}
            domain={[0, 70]}
            label={{ value: 'FPS', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ background: '#2a2a2a', border: '1px solid #444', borderRadius: 4 }}
            cursor={{ strokeDasharray: '3 3', stroke: '#555' }}
          />
          <Legend />
          <Scatter name="UI FPS" data={uiData} fill="#2196F3" isAnimationActive={false} />
          <Scatter name="JS FPS" data={jsData} fill="#4CAF50" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>

      {uiData.length < 5 && (
        <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 12 }}>
          {uiData.length === 0 ? 'No data yet' : 'Collecting more data points for correlation analysis...'}
        </div>
      )}
    </div>
  )
}
