import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge'
import { MetricCards } from './components/MetricCards'
import { FPSChart } from './components/FPSChart'
import { MemoryChart } from './components/MemoryChart'
import { StutterTimeline } from './components/StutterTimeline'
import { FrameTimeHeatmap } from './components/FrameTimeHeatmap'
import { FPSDistribution } from './components/FPSDistribution'
import { FrameBudgetTimeline } from './components/FrameBudgetTimeline'
import { MemoryLeakDetector } from './components/MemoryLeakDetector'
import { PerformanceScore } from './components/PerformanceScore'
import { ThresholdAlerts } from './components/ThresholdAlerts'
import { BottleneckAnalysis } from './components/BottleneckAnalysis'
import { SessionRecorder } from './components/SessionRecorder'
import { CorrelationView } from './components/CorrelationView'
import { ThreadDivergence } from './components/ThreadDivergence'
import { GCPressureMeter } from './components/GCPressureMeter'
import { StressTestAdvisor } from './components/StressTestAdvisor'
import { AIInsights } from './components/AIInsights'

class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: '' }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 32, textAlign: 'center' }}>
          <div style={{ color: '#F44336', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Component Error
          </div>
          <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
            {this.state.error}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: '' })}
            style={{
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

interface PerfSnapshot {
  uiFps: number
  jsFps: number
  ramBytes: number
  jsHeapUsedBytes: number
  jsHeapTotalBytes: number
  droppedFrames: number
  stutterCount: number
  timestamp: number
  longTaskCount: number
  longTaskTotalMs: number
  slowEventCount: number
  maxEventDurationMs: number
  renderCount: number
  lastRenderDurationMs: number
}

interface ComponentRenderStats {
  componentId: string
  renderCount: number
  totalDurationMs: number
  avgDurationMs: number
  maxDurationMs: number
  lastDurationMs: number
  mountCount: number
  updateCount: number
  nestedUpdateCount: number
}

interface ArchInfo {
  isFabric: boolean
  isBridgeless: boolean
  jsEngine: 'hermes' | 'v8' | 'jsc'
  reactNativeVersion: string
}

interface StartupTiming {
  available: boolean
  nativeInitMs?: number
  bundleLoadMs?: number
  ttiMs?: number
}

interface FPSHistory {
  uiFpsSamples: number[]
  jsFpsSamples: number[]
  uiFpsMin: number
  uiFpsMax: number
  jsFpsMin: number
  jsFpsMax: number
}

interface PerfEvents extends Record<string, unknown> {
  'perf-snapshot': PerfSnapshot
  'perf-history': FPSHistory
  'request-snapshot': Record<string, never>
  'request-history': Record<string, never>
  'start-monitor': Record<string, never>
  'stop-monitor': Record<string, never>
  'reset-monitor': Record<string, never>
  'export-session': Record<string, never>
  'clear-data': Record<string, never>
  'session-data': { snapshots: PerfSnapshot[]; history: FPSHistory }
  'request-arch-info': Record<string, never>
  'arch-info': ArchInfo
  'request-startup-timing': Record<string, never>
  'startup-timing': StartupTiming
  'ai-insights-enabled': { enabled: boolean }
  'component-render-stats': ComponentRenderStats[]
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

interface FrameTimeEntry {
  timestamp: number
  frameTimeMs: number
  budgetMs: number
}

interface AlertEntry {
  id: string
  level: 'warning' | 'critical'
  message: string
  timestamp: number
  value: number
}

const MAX_MEMORY_POINTS = 120
const MAX_FRAME_TIMES = 300
const MAX_STUTTER_EVENTS = 500

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'new-arch', label: 'New Arch' },
  { id: 'fps', label: 'FPS Analysis' },
  { id: 'memory', label: 'Memory' },
  { id: 'stutters', label: 'Stutters' },
  { id: 'session', label: 'Session' },
  { id: 'ai-insights', label: 'AI Insights' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function Panel() {
  const plugin = useRozeniteDevToolsClient<PerfEvents>({
    pluginId: 'nitro-perf',
  })

  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [metrics, setMetrics] = useState<PerfSnapshot | null>(null)
  const [history, setHistory] = useState<FPSHistory | null>(null)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [memoryData, setMemoryData] = useState<MemoryDataPoint[]>([])
  const [stutterEvents, setStutterEvents] = useState<StutterEvent[]>([])
  const [frameTimes, setFrameTimes] = useState<FrameTimeEntry[]>([])
  const [alerts, setAlerts] = useState<AlertEntry[]>([])
  const [fpsData, setFpsData] = useState<{ uiFps: number; jsFps: number }[]>([])
  const [archInfo, setArchInfo] = useState<ArchInfo | null>(null)
  const [startupTiming, setStartupTiming] = useState<StartupTiming | null>(null)
  const [aiInsightsEnabled, setAiInsightsEnabled] = useState(false)
  const [componentRenderStats, setComponentRenderStats] = useState<ComponentRenderStats[]>([])

  const prevStutterCount = useRef(0)
  const prevSnapshotTs = useRef(0)
  const alertIdCounter = useRef(0)

  // Compute memory trend (MB/min) from last 30 data points
  const memoryTrend = useMemo(() => {
    if (memoryData.length < 5) return 0
    const recent = memoryData.slice(-30)
    const first = recent[0]
    const last = recent[recent.length - 1]
    const elapsedMin = (last.timestamp - first.timestamp) / 60000
    if (elapsedMin <= 0) return 0
    return (last.ramMB - first.ramMB) / elapsedMin
  }, [memoryData])

  // Compute memory rate (MB/sec and MB/min) from recent data
  const memoryRatePerSec = useMemo(() => {
    if (memoryData.length < 2) return 0
    const recent = memoryData.slice(-10)
    const first = recent[0]
    const last = recent[recent.length - 1]
    const elapsedSec = (last.timestamp - first.timestamp) / 1000
    if (elapsedSec <= 0) return 0
    return (last.ramMB - first.ramMB) / elapsedSec
  }, [memoryData])

  const memoryRatePerMin = useMemo(() => {
    return memoryTrend
  }, [memoryTrend])

  // Compute stutter rate (per minute) from last 60s
  const stutterRate = useMemo(() => {
    if (stutterEvents.length === 0) return 0
    const now = Date.now()
    const recentStutters = stutterEvents.filter((e) => now - e.timestamp < 60000)
    return recentStutters.length
  }, [stutterEvents])

  // Check thresholds and generate alerts
  const checkAlerts = useCallback((snapshot: PerfSnapshot) => {
    const rules = [
      { metric: 'UI FPS', value: snapshot.uiFps, warnBelow: 45, critBelow: 30 },
      { metric: 'JS FPS', value: snapshot.jsFps, warnBelow: 45, critBelow: 30 },
      { metric: 'RAM', value: snapshot.ramBytes / (1024 * 1024), warnAbove: 500, critAbove: 800 },
      { metric: 'INP', value: snapshot.maxEventDurationMs, warnAbove: 200, critAbove: 500 },
      { metric: 'Long Tasks', value: snapshot.longTaskCount, warnAbove: 10, critAbove: 50 },
    ]

    for (const rule of rules) {
      if ('critBelow' in rule && rule.critBelow !== undefined && rule.value < rule.critBelow) {
        setAlerts((prev) => [...prev.slice(-200), {
          id: `alert-${++alertIdCounter.current}`,
          level: 'critical',
          message: `${rule.metric} critically low`,
          timestamp: snapshot.timestamp,
          value: rule.value,
        }])
      } else if ('warnBelow' in rule && rule.warnBelow !== undefined && rule.value < rule.warnBelow) {
        setAlerts((prev) => [...prev.slice(-200), {
          id: `alert-${++alertIdCounter.current}`,
          level: 'warning',
          message: `${rule.metric} below threshold`,
          timestamp: snapshot.timestamp,
          value: rule.value,
        }])
      }
      if ('critAbove' in rule && rule.critAbove !== undefined && rule.value > rule.critAbove) {
        setAlerts((prev) => [...prev.slice(-200), {
          id: `alert-${++alertIdCounter.current}`,
          level: 'critical',
          message: `${rule.metric} critically high`,
          timestamp: snapshot.timestamp,
          value: rule.value,
        }])
      } else if ('warnAbove' in rule && rule.warnAbove !== undefined && rule.value > rule.warnAbove) {
        setAlerts((prev) => [...prev.slice(-200), {
          id: `alert-${++alertIdCounter.current}`,
          level: 'warning',
          message: `${rule.metric} above threshold`,
          timestamp: snapshot.timestamp,
          value: rule.value,
        }])
      }
    }
  }, [])

  // Listen for snapshots
  useEffect(() => {
    if (!plugin) return

    plugin.onMessage('perf-snapshot', (snapshot: PerfSnapshot) => {
      setMetrics(snapshot)

      // Track FPS data for correlation
      setFpsData((prev) => {
        const item = { uiFps: snapshot.uiFps, jsFps: snapshot.jsFps }
        if (prev.length >= MAX_MEMORY_POINTS) {
          const trimmed = prev.slice(1)
          trimmed.push(item)
          return trimmed
        }
        return [...prev, item]
      })

      // Derive frame times from consecutive snapshots
      if (prevSnapshotTs.current > 0) {
        const frameTimeMs = snapshot.timestamp - prevSnapshotTs.current
        if (frameTimeMs > 0 && frameTimeMs < 5000) {
          setFrameTimes((prev) => {
            const item = { timestamp: snapshot.timestamp, frameTimeMs, budgetMs: 16.67 }
            if (prev.length >= MAX_FRAME_TIMES) {
              const trimmed = prev.slice(1)
              trimmed.push(item)
              return trimmed
            }
            return [...prev, item]
          })
        }
      }
      prevSnapshotTs.current = snapshot.timestamp

      // Track memory over time
      setMemoryData((prev) => {
        const item = {
          timestamp: snapshot.timestamp,
          ramMB: snapshot.ramBytes / (1024 * 1024),
          heapUsedMB: snapshot.jsHeapUsedBytes / (1024 * 1024),
          heapTotalMB: snapshot.jsHeapTotalBytes / (1024 * 1024),
        }
        if (prev.length >= MAX_MEMORY_POINTS) {
          const trimmed = prev.slice(1)
          trimmed.push(item)
          return trimmed
        }
        return [...prev, item]
      })

      // Track stutter events (capped)
      if (snapshot.stutterCount > prevStutterCount.current) {
        setStutterEvents((prev) => {
          const item = { timestamp: snapshot.timestamp, droppedFrames: snapshot.droppedFrames }
          if (prev.length >= MAX_STUTTER_EVENTS) {
            const trimmed = prev.slice(1)
            trimmed.push(item)
            return trimmed
          }
          return [...prev, item]
        })
      }
      prevStutterCount.current = snapshot.stutterCount

      // Check alert thresholds
      checkAlerts(snapshot)
    })

    plugin.onMessage('perf-history', (h: FPSHistory) => {
      setHistory(h)
    })

    plugin.onMessage('arch-info', (info: ArchInfo) => {
      setArchInfo(info)
    })

    plugin.onMessage('startup-timing', (timing: StartupTiming) => {
      setStartupTiming(timing)
    })

    plugin.onMessage('ai-insights-enabled', ({ enabled }) => {
      setAiInsightsEnabled(enabled)
    })

    plugin.onMessage('component-render-stats', (stats: ComponentRenderStats[]) => {
      setComponentRenderStats(stats)
    })

    // Request arch info and startup timing on connect
    plugin.send('request-arch-info', {} as Record<string, never>)
    plugin.send('request-startup-timing', {} as Record<string, never>)
  }, [plugin, checkAlerts])

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
    setFrameTimes([])
    setAlerts([])
    setFpsData([])
    setComponentRenderStats([])
    prevStutterCount.current = 0
    prevSnapshotTs.current = 0
  }, [plugin])

  const handleClearAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  const handleClearData = useCallback(() => {
    plugin?.send('clear-data', {} as Record<string, never>)
    setHistory(null)
    setMemoryData([])
    setStutterEvents([])
    setFrameTimes([])
    setAlerts([])
    setFpsData([])
    setComponentRenderStats([])
    prevStutterCount.current = 0
    prevSnapshotTs.current = 0
  }, [plugin])

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#121212',
      color: '#fff',
      height: '100vh',
      padding: 20,
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
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
            onClick={handleClearData}
            style={{
              background: '#1a1a2e',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear Data
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

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid #333',
        marginBottom: 16,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'transparent',
              color: activeTab === tab.id ? '#4CAF50' : '#888',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #4CAF50' : '2px solid transparent',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
            {tab.id === 'stutters' && stutterEvents.length > 0 && (
              <span style={{
                background: '#F44336',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 8,
                marginLeft: 6,
              }}>
                {stutterEvents.length}
              </span>
            )}
            {tab.id === 'overview' && alerts.length > 0 && (
              <span style={{
                background: alerts.some((a) => a.level === 'critical') ? '#F44336' : '#FF9800',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 8,
                marginLeft: 6,
              }}>
                {alerts.length}
              </span>
            )}
          </button>
        ))}
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

      {/* ==================== OVERVIEW TAB ==================== */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <MetricCards metrics={metrics} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <PerformanceScore
              metrics={metrics}
              memoryTrend={memoryTrend}
              stutterRate={stutterRate}
            />
            <BottleneckAnalysis
              metrics={metrics}
              history={history}
              memoryTrend={memoryTrend}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FPSChart history={history} />
            <MemoryChart dataPoints={memoryData} />
          </div>
          <ThresholdAlerts alerts={alerts} onClearAlerts={handleClearAlerts} />
        </div>
      )}

      {/* ==================== DIAGNOSTICS TAB ==================== */}
      {activeTab === 'diagnostics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <StressTestAdvisor
            metrics={metrics}
            memoryTrend={memoryTrend}
            stutterRate={stutterRate}
            fpsData={fpsData}
          />
          <ThreadDivergence fpsData={fpsData} />
          <GCPressureMeter memoryData={memoryData} />
        </div>
      )}

      {/* ==================== NEW ARCH TAB ==================== */}
      {activeTab === 'new-arch' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Architecture Info */}
          <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              Architecture Info
            </div>
            {archInfo ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={tdStyle}>Fabric</td>
                    <td style={{ ...tdStyle, color: archInfo.isFabric ? '#4CAF50' : '#888', fontWeight: 600 }}>
                      {archInfo.isFabric ? 'Enabled' : 'Disabled'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={tdStyle}>Bridgeless</td>
                    <td style={{ ...tdStyle, color: archInfo.isBridgeless ? '#4CAF50' : '#888', fontWeight: 600 }}>
                      {archInfo.isBridgeless ? 'Enabled' : 'Disabled'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={tdStyle}>JS Engine</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{archInfo.jsEngine.toUpperCase()}</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}>React Native</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{archInfo.reactNativeVersion}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div style={{ color: '#888', fontSize: 12, textAlign: 'center', padding: 12 }}>
                Waiting for arch info...
              </div>
            )}
          </div>

          {/* Startup Timing */}
          <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              Startup Timing
            </div>
            {startupTiming?.available ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {startupTiming.nativeInitMs !== undefined && (
                    <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                      <td style={tdStyle}>Native Init</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{startupTiming.nativeInitMs.toFixed(0)}ms</td>
                    </tr>
                  )}
                  {startupTiming.bundleLoadMs !== undefined && (
                    <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                      <td style={tdStyle}>Bundle Load</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{startupTiming.bundleLoadMs.toFixed(0)}ms</td>
                    </tr>
                  )}
                  {startupTiming.ttiMs !== undefined && (
                    <tr>
                      <td style={tdStyle}>TTI</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: startupTiming.ttiMs > 3000 ? '#F44336' : startupTiming.ttiMs > 1500 ? '#FF9800' : '#4CAF50' }}>
                        {startupTiming.ttiMs.toFixed(0)}ms
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div style={{ color: '#888', fontSize: 12, textAlign: 'center', padding: 12 }}>
                {startupTiming ? 'Startup timing not available on this RN version' : 'Waiting for startup timing...'}
              </div>
            )}
          </div>

          {/* New Arch Metrics */}
          <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              Runtime Metrics
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  <th style={thStyle}>Metric</th>
                  <th style={thStyle}>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={tdStyle}>Long Tasks</td>
                  <td style={{
                    ...tdStyle,
                    color: (metrics?.longTaskCount ?? 0) > 0 ? '#FF9800' : '#4CAF50',
                    fontWeight: 600,
                  }}>
                    {metrics?.longTaskCount ?? 0} ({Math.round(metrics?.longTaskTotalMs ?? 0)}ms total)
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={tdStyle}>Slow Events</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {metrics?.slowEventCount ?? 0}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={tdStyle}>Worst INP</td>
                  <td style={{
                    ...tdStyle,
                    color: (metrics?.maxEventDurationMs ?? 0) > 200 ? '#F44336' : (metrics?.maxEventDurationMs ?? 0) > 100 ? '#FF9800' : '#4CAF50',
                    fontWeight: 600,
                  }}>
                    {Math.round(metrics?.maxEventDurationMs ?? 0)}ms
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={tdStyle}>Render Count</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {metrics?.renderCount ?? 0}
                  </td>
                </tr>
                <tr>
                  <td style={tdStyle}>Last Render</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {(metrics?.lastRenderDurationMs ?? 0).toFixed(1)}ms
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== FPS ANALYSIS TAB ==================== */}
      {activeTab === 'fps' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FPSChart history={history} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FPSDistribution
              fpsSamples={[
                ...(history?.uiFpsSamples ?? []),
                ...(history?.jsFpsSamples ?? []),
              ]}
            />
            <FrameBudgetTimeline frameTimes={frameTimes} />
          </div>
          <FrameTimeHeatmap frameTimes={frameTimes} />
          {/* FPS Stats */}
          {history && (
            <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                FPS Statistics
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
                  <tr>
                    <td style={tdStyle}>JS FPS</td>
                    <td style={tdStyle}>{history.jsFpsMin}</td>
                    <td style={tdStyle}>{history.jsFpsMax}</td>
                    <td style={tdStyle}>{metrics ? Math.round(metrics.jsFps) : '--'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== MEMORY TAB ==================== */}
      {activeTab === 'memory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <MemoryChart dataPoints={memoryData} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <MemoryLeakDetector dataPoints={memoryData} />
            <CorrelationView memoryData={memoryData} fpsData={fpsData} />
          </div>
          {/* Memory Stats */}
          <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              Memory Statistics
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
                  <td style={tdStyle}>RAM (MB)</td>
                  <td style={tdStyle}>
                    {memoryData.length > 0 ? Math.min(...memoryData.map((d) => d.ramMB)).toFixed(1) : '--'}
                  </td>
                  <td style={tdStyle}>
                    {memoryData.length > 0 ? Math.max(...memoryData.map((d) => d.ramMB)).toFixed(1) : '--'}
                  </td>
                  <td style={tdStyle}>
                    {metrics ? (metrics.ramBytes / (1024 * 1024)).toFixed(1) : '--'}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={tdStyle}>JS Heap Used (MB)</td>
                  <td style={tdStyle}>
                    {memoryData.length > 0 ? Math.min(...memoryData.map((d) => d.heapUsedMB)).toFixed(1) : '--'}
                  </td>
                  <td style={tdStyle}>
                    {memoryData.length > 0 ? Math.max(...memoryData.map((d) => d.heapUsedMB)).toFixed(1) : '--'}
                  </td>
                  <td style={tdStyle}>
                    {metrics ? (metrics.jsHeapUsedBytes / (1024 * 1024)).toFixed(1) : '--'}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={tdStyle}>Rate (MB/s)</td>
                  <td style={tdStyle} colSpan={2} />
                  <td style={{
                    ...tdStyle,
                    color: Math.abs(memoryRatePerSec) > 0.1 ? '#FF9800' : '#4CAF50',
                    fontWeight: 600,
                  }}>
                    {memoryRatePerSec >= 0 ? '+' : ''}{memoryRatePerSec.toFixed(3)}
                  </td>
                </tr>
                <tr>
                  <td style={tdStyle}>Rate (MB/min)</td>
                  <td style={tdStyle} colSpan={2} />
                  <td style={{
                    ...tdStyle,
                    color: memoryRatePerMin > 1 ? '#F44336' : memoryRatePerMin > 0.2 ? '#FF9800' : '#4CAF50',
                    fontWeight: 600,
                  }}>
                    {memoryRatePerMin >= 0 ? '+' : ''}{memoryRatePerMin.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== STUTTERS TAB ==================== */}
      {activeTab === 'stutters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <StutterTimeline events={stutterEvents} />

          {/* Stutter event log */}
          <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              Stutter Event Log
              <span style={{ color: '#888', fontSize: 11, marginLeft: 12, fontWeight: 400 }}>
                {stutterEvents.length} event{stutterEvents.length !== 1 ? 's' : ''}
                {' '} — Rate: {stutterRate}/min
              </span>
            </div>
            {stutterEvents.length === 0 ? (
              <div style={{ color: '#4CAF50', fontSize: 12, textAlign: 'center', padding: 12 }}>
                No stutters detected
              </div>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #333' }}>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Time</th>
                      <th style={thStyle}>Dropped Frames</th>
                      <th style={thStyle}>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stutterEvents.slice().reverse().map((event, i) => {
                      const severity = event.droppedFrames >= 10 ? 'Severe' : event.droppedFrames >= 4 ? 'Moderate' : 'Minor'
                      const color = event.droppedFrames >= 10 ? '#F44336' : event.droppedFrames >= 4 ? '#FF9800' : '#FFC107'
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #2a2a2a' }}>
                          <td style={tdStyle}>{stutterEvents.length - i}</td>
                          <td style={tdStyle}>{new Date(event.timestamp).toLocaleTimeString()}</td>
                          <td style={tdStyle}>{event.droppedFrames}</td>
                          <td style={{ ...tdStyle, color, fontWeight: 600 }}>{severity}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Stats */}
          {history && (
            <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
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
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={tdStyle}>Total Dropped</td>
                    <td style={tdStyle} colSpan={2} />
                    <td style={tdStyle}>{metrics?.droppedFrames ?? '--'}</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}>Total Stutters</td>
                    <td style={tdStyle} colSpan={2} />
                    <td style={{
                      ...tdStyle,
                      color: (metrics?.stutterCount ?? 0) > 0 ? '#F44336' : '#4CAF50',
                      fontWeight: 600,
                    }}>
                      {metrics?.stutterCount ?? '--'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== SESSION TAB ==================== */}
      {activeTab === 'session' && (
        <SessionRecorder
          metrics={metrics}
          isMonitoring={isMonitoring}
          memoryData={memoryData}
          stutterEvents={stutterEvents}
        />
      )}

      {/* ==================== AI INSIGHTS TAB ==================== */}
      {activeTab === 'ai-insights' && (
        <ErrorBoundary fallback={null}>
          <AIInsights
            metrics={metrics}
            history={history}
            memoryData={memoryData}
            stutterEvents={stutterEvents}
            frameTimes={frameTimes}
            fpsData={fpsData}
            componentRenderStats={componentRenderStats}
            archInfo={archInfo}
          />
        </ErrorBoundary>
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
