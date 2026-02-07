import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRozeniteDevToolsPlugin } from '@rozenite/plugin-bridge'
import { MetricCards } from './components/MetricCards'
import { FPSChart } from './components/FPSChart'
import { MemoryChart } from './components/MemoryChart'
import { StutterTimeline } from './components/StutterTimeline'

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

interface FPSHistory {
  uiFpsSamples: number[]
  jsFpsSamples: number[]
  uiFpsMin: number
  uiFpsMax: number
  jsFpsMin: number
  jsFpsMax: number
}

interface PerfEvents {
  'perf-snapshot': PerfSnapshot
  'perf-history': FPSHistory
  'request-snapshot': Record<string, never>
  'request-history': Record<string, never>
  'start-monitor': Record<string, never>
  'stop-monitor': Record<string, never>
  'reset-monitor': Record<string, never>
}

interface MemoryDataPoint {
  timestamp: number
  ramMB: number
  heapUsedMB: number
  heapTotalMB: number
}

interface StutterEvent {
  timestamp: number
  droppedFrames: number
}

const MAX_MEMORY_POINTS = 120

export default function Panel() {
  const plugin = useRozeniteDevToolsPlugin<PerfEvents>({
    pluginId: 'nitro-perf',
  })

  const [metrics, setMetrics] = useState<PerfSnapshot | null>(null)
  const [history, setHistory] = useState<FPSHistory | null>(null)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [memoryData, setMemoryData] = useState<MemoryDataPoint[]>([])
  const [stutterEvents, setStutterEvents] = useState<StutterEvent[]>([])

  const prevStutterCount = useRef(0)

  // Listen for snapshots
  useEffect(() => {
    if (!plugin) return

    plugin.onMessage('perf-snapshot', (snapshot: PerfSnapshot) => {
      setMetrics(snapshot)

      // Track memory over time
      setMemoryData((prev) => {
        const next = [
          ...prev,
          {
            timestamp: snapshot.timestamp,
            ramMB: snapshot.ramBytes / (1024 * 1024),
            heapUsedMB: snapshot.jsHeapUsedBytes / (1024 * 1024),
            heapTotalMB: snapshot.jsHeapTotalBytes / (1024 * 1024),
          },
        ]
        return next.slice(-MAX_MEMORY_POINTS)
      })

      // Track stutter events
      if (snapshot.stutterCount > prevStutterCount.current) {
        setStutterEvents((prev) => [
          ...prev,
          { timestamp: snapshot.timestamp, droppedFrames: snapshot.droppedFrames },
        ])
      }
      prevStutterCount.current = snapshot.stutterCount
    })

    plugin.onMessage('perf-history', (h: FPSHistory) => {
      setHistory(h)
    })
  }, [plugin])

  const handleStart = useCallback(() => {
    plugin?.send('start-monitor', {} as Record<string, never>)
    setIsMonitoring(true)
  }, [plugin])

  const handleStop = useCallback(() => {
    plugin?.send('stop-monitor', {} as Record<string, never>)
    setIsMonitoring(false)
  }, [plugin])

  const handleReset = useCallback(() => {
    plugin?.send('reset-monitor', {} as Record<string, never>)
    setMetrics(null)
    setHistory(null)
    setMemoryData([])
    setStutterEvents([])
    prevStutterCount.current = 0
  }, [plugin])

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#121212',
      color: '#fff',
      minHeight: '100vh',
      padding: 20,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          Nitro Perf Monitor
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={isMonitoring ? handleStop : handleStart}
            style={{
              background: isMonitoring ? '#F44336' : '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isMonitoring ? 'Stop' : 'Start'}
          </button>
          <button
            onClick={handleReset}
            style={{
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Connection status */}
      {!plugin && (
        <div style={{
          background: '#1e1e1e',
          borderRadius: 8,
          padding: 20,
          textAlign: 'center',
          color: '#888',
          marginBottom: 20,
        }}>
          Waiting for app connection...
          <br />
          <span style={{ fontSize: 12 }}>
            Make sure useNitroPerfDevTools() is active in your app
          </span>
        </div>
      )}

      {/* Metric cards */}
      <div style={{ marginBottom: 20 }}>
        <MetricCards metrics={metrics} />
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <FPSChart history={history} />
        <MemoryChart dataPoints={memoryData} />
      </div>

      {/* Stutter timeline */}
      <StutterTimeline events={stutterEvents} />

      {/* Stats table */}
      {history && (
        <div style={{
          background: '#1e1e1e',
          borderRadius: 8,
          padding: 16,
          marginTop: 16,
        }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            Statistics
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                <th style={thStyle}>Metric</th>
                <th style={thStyle}>Min</th>
                <th style={thStyle}>Max</th>
                <th style={thStyle}>Current</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={tdStyle}>UI FPS</td>
                <td style={tdStyle}>{history.uiFpsMin}</td>
                <td style={tdStyle}>{history.uiFpsMax}</td>
                <td style={tdStyle}>{metrics ? Math.round(metrics.uiFps) : '--'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={tdStyle}>JS FPS</td>
                <td style={tdStyle}>{history.jsFpsMin}</td>
                <td style={tdStyle}>{history.jsFpsMax}</td>
                <td style={tdStyle}>{metrics ? Math.round(metrics.jsFps) : '--'}</td>
              </tr>
              <tr>
                <td style={tdStyle}>RAM (MB)</td>
                <td style={tdStyle}>
                  {memoryData.length > 0
                    ? Math.min(...memoryData.map((d) => d.ramMB)).toFixed(1)
                    : '--'}
                </td>
                <td style={tdStyle}>
                  {memoryData.length > 0
                    ? Math.max(...memoryData.map((d) => d.ramMB)).toFixed(1)
                    : '--'}
                </td>
                <td style={tdStyle}>
                  {metrics ? (metrics.ramBytes / (1024 * 1024)).toFixed(1) : '--'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  color: '#888',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  color: '#ccc',
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
}
