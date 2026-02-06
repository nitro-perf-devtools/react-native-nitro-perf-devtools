import React from 'react'

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

function getFpsColor(fps: number): string {
  if (fps >= 55) return '#4CAF50'
  if (fps >= 40) return '#FF9800'
  return '#F44336'
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB'
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MetricCard({
  label,
  value,
  color,
  subtitle,
}: {
  label: string
  value: string
  color?: string
  subtitle?: string
}) {
  return (
    <div style={{
      background: '#1e1e1e',
      borderRadius: 8,
      padding: '16px 20px',
      flex: '1 1 140px',
      minWidth: 140,
    }}>
      <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{
        color: color ?? '#fff',
        fontSize: 28,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{subtitle}</div>
      )}
    </div>
  )
}

export function MetricCards({ metrics }: { metrics: PerfSnapshot | null }) {
  if (!metrics) {
    return (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard label="UI FPS" value="--" />
        <MetricCard label="JS FPS" value="--" />
        <MetricCard label="RAM" value="--" />
        <MetricCard label="JS Heap" value="--" />
        <MetricCard label="Dropped" value="--" />
        <MetricCard label="Stutters" value="--" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <MetricCard
        label="UI FPS"
        value={String(Math.round(metrics.uiFps))}
        color={getFpsColor(metrics.uiFps)}
      />
      <MetricCard
        label="JS FPS"
        value={String(Math.round(metrics.jsFps))}
        color={getFpsColor(metrics.jsFps)}
      />
      <MetricCard
        label="RAM"
        value={formatBytes(metrics.ramBytes)}
      />
      <MetricCard
        label="JS Heap"
        value={formatBytes(metrics.jsHeapUsedBytes)}
        subtitle={`/ ${formatBytes(metrics.jsHeapTotalBytes)}`}
      />
      <MetricCard
        label="Dropped Frames"
        value={String(Math.round(metrics.droppedFrames))}
        color={metrics.droppedFrames > 0 ? '#FF9800' : '#4CAF50'}
      />
      <MetricCard
        label="Stutters"
        value={String(Math.round(metrics.stutterCount))}
        color={metrics.stutterCount > 0 ? '#F44336' : '#4CAF50'}
      />
    </div>
  )
}
