import React, { useMemo } from 'react'

interface FrameTimeEntry {
  timestamp: number
  frameTimeMs: number
  budgetMs: number
}

interface FrameTimeHeatmapProps {
  frameTimes: FrameTimeEntry[]
  columns?: number
}

function getFrameColor(frameTimeMs: number, budgetMs: number): string {
  const ratio = frameTimeMs / budgetMs
  if (ratio <= 0.5) return '#1B5E20'   // well under budget
  if (ratio <= 0.75) return '#4CAF50'  // under budget
  if (ratio <= 1.0) return '#8BC34A'   // near budget
  if (ratio <= 1.5) return '#FF9800'   // over budget
  if (ratio <= 2.0) return '#F44336'   // way over
  return '#B71C1C'                      // severe
}

export function FrameTimeHeatmap({ frameTimes, columns = 30 }: FrameTimeHeatmapProps) {
  const cells = useMemo(() => {
    return frameTimes.slice(-300).map((ft, i) => ({
      ...ft,
      color: getFrameColor(ft.frameTimeMs, ft.budgetMs),
      index: i,
    }))
  }, [frameTimes])

  const rows = useMemo(() => {
    const result: typeof cells[] = []
    for (let i = 0; i < cells.length; i += columns) {
      result.push(cells.slice(i, i + columns))
    }
    return result
  }, [cells, columns])

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Frame Time Heatmap
        <span style={{ color: '#888', fontSize: 11, marginLeft: 12, fontWeight: 400 }}>
          Last {cells.length} frames ({columns} per row)
        </span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        {[
          { label: '< 50%', color: '#1B5E20' },
          { label: '< 75%', color: '#4CAF50' },
          { label: '< 100%', color: '#8BC34A' },
          { label: '< 150%', color: '#FF9800' },
          { label: '> 150%', color: '#F44336' },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ color: '#888', fontSize: 10 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 2 }}>
            {row.map((cell, ci) => (
              <div
                key={ci}
                title={`${cell.frameTimeMs.toFixed(1)}ms / ${cell.budgetMs.toFixed(1)}ms budget (${((cell.frameTimeMs / cell.budgetMs) * 100).toFixed(0)}%)`}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: cell.color,
                  cursor: 'default',
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {frameTimes.length === 0 && (
        <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 20 }}>
          No frame data yet
        </div>
      )}
    </div>
  )
}
