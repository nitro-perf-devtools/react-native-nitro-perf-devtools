import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { analyzePerformance, analyzeWithClaude } from '@nitroperf/devtools-ai'

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

interface FPSHistory {
  uiFpsSamples: number[]
  jsFpsSamples: number[]
  uiFpsMin: number
  uiFpsMax: number
  jsFpsMin: number
  jsFpsMax: number
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

interface AIInsight {
  id: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  confidence: number
  recommendation: string
  category: 'memory' | 'cpu' | 'render' | 'architecture'
}

interface AIAnalysisInput {
  metrics: PerfSnapshot | null
  history: FPSHistory | null
  memoryData: MemoryDataPoint[]
  stutterEvents: StutterEvent[]
  frameTimes: FrameTimeEntry[]
  fpsData: { uiFps: number; jsFps: number }[]
  componentStats?: ComponentRenderStats[]
}

interface AIInsightsProps {
  metrics: PerfSnapshot | null
  history: FPSHistory | null
  memoryData: MemoryDataPoint[]
  stutterEvents: StutterEvent[]
  frameTimes: FrameTimeEntry[]
  fpsData: { uiFps: number; jsFps: number }[]
  componentRenderStats: ComponentRenderStats[]
  archInfo: ArchInfo | null
}

const severityColors: Record<string, string> = {
  info: '#2196F3',
  warning: '#FF9800',
  critical: '#F44336',
}

const severityIcons: Record<string, string> = {
  info: '\u2139',
  warning: '\u26A0',
  critical: '\uD83D\uDD34',
}

const API_KEY_STORAGE_KEY = 'nitroperf-claude-api-key'
const COOLDOWN_MS = 5000

export function AIInsights({
  metrics,
  history,
  memoryData,
  stutterEvents,
  frameTimes,
  fpsData,
  componentRenderStats,
  archInfo,
}: AIInsightsProps) {
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem(API_KEY_STORAGE_KEY) || '' } catch { return '' }
  })
  const [claudeInsights, setClaudeInsights] = useState<AIInsight[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [claudeError, setClaudeError] = useState<string | null>(null)
  const [autoMode, setAutoMode] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showHeuristics, setShowHeuristics] = useState(true)
  const lastAnalysisTime = useRef(0)
  const claudeTimestamp = useRef(new Date())
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Persist API key
  const handleApiKeyChange = useCallback((key: string) => {
    setApiKey(key)
    try {
      if (key) {
        localStorage.setItem(API_KEY_STORAGE_KEY, key)
      } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY)
      }
    } catch {
      // localStorage unavailable
    }
  }, [])

  const heuristicInsights = useMemo((): AIInsight[] => {
    if (!metrics) return []

    return analyzePerformance({
      metrics,
      history,
      memoryData,
      stutterEvents,
      frameTimes,
      fpsData,
      componentStats: componentRenderStats,
    })
  }, [metrics, history, memoryData, stutterEvents, frameTimes, fpsData, componentRenderStats])

  const handleAnalyzeWithClaude = useCallback(async () => {
    if (!metrics || !apiKey.trim() || isAnalyzing) return

    const now = Date.now()
    if (now - lastAnalysisTime.current < COOLDOWN_MS) {
      setClaudeError(`Please wait ${Math.ceil((COOLDOWN_MS - (now - lastAnalysisTime.current)) / 1000)}s before analyzing again.`)
      return
    }

    setIsAnalyzing(true)
    setClaudeError(null)

    try {
      // Compute memory trend
      let memoryTrendMBPerMin: number | undefined
      if (memoryData.length >= 5) {
        const recent = memoryData.slice(-30)
        const first = recent[0]
        const last = recent[recent.length - 1]
        const elapsedMin = (last.timestamp - first.timestamp) / 60000
        if (elapsedMin > 0) {
          memoryTrendMBPerMin = (last.ramMB - first.ramMB) / elapsedMin
        }
      }

      // Compute stutter rate
      let stutterRate: number | undefined
      if (stutterEvents.length > 0) {
        const now = Date.now()
        stutterRate = stutterEvents.filter(e => now - e.timestamp < 60000).length
      }

      const result = await analyzeWithClaude(apiKey.trim(), {
        metrics: {
          uiFps: metrics.uiFps,
          jsFps: metrics.jsFps,
          ramBytes: metrics.ramBytes,
          jsHeapUsedBytes: metrics.jsHeapUsedBytes,
          jsHeapTotalBytes: metrics.jsHeapTotalBytes,
          droppedFrames: metrics.droppedFrames,
          stutterCount: metrics.stutterCount,
          longTaskCount: metrics.longTaskCount,
          longTaskTotalMs: metrics.longTaskTotalMs,
          slowEventCount: metrics.slowEventCount,
          maxEventDurationMs: metrics.maxEventDurationMs,
          renderCount: metrics.renderCount,
          lastRenderDurationMs: metrics.lastRenderDurationMs,
        },
        history: history || undefined,
        memoryTrendMBPerMin,
        stutterRate,
        componentStats: componentRenderStats.length > 0 ? componentRenderStats : undefined,
        archInfo: archInfo || undefined,
      })

      setClaudeInsights(result)
      claudeTimestamp.current = new Date()
      lastAnalysisTime.current = Date.now()
    } catch (err) {
      setClaudeError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }, [metrics, apiKey, isAnalyzing, memoryData, stutterEvents, history, componentRenderStats, archInfo])

  // Auto-analyze on interval
  useEffect(() => {
    if (autoMode && apiKey.trim() && metrics) {
      // Run immediately on toggle
      handleAnalyzeWithClaude()

      autoIntervalRef.current = setInterval(() => {
        handleAnalyzeWithClaude()
      }, 15000)
    }

    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current)
        autoIntervalRef.current = null
      }
    }
  }, [autoMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Merge heuristic + Claude insights with timestamps, sorted by severity
  const allInsights = useMemo(() => {
    const now = new Date()
    const hWithTs = showHeuristics ? heuristicInsights.map(i => ({ ...i, timestamp: now })) : []
    const cWithTs = claudeInsights.map(i => ({ ...i, timestamp: claudeTimestamp.current }))
    const merged = [...hWithTs, ...cWithTs]
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    return merged.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  }, [heuristicInsights, claudeInsights, showHeuristics])

  if (!metrics) {
    return (
      <div style={{
        background: '#1e1e1e',
        borderRadius: 8,
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{ color: '#888', fontSize: 14 }}>
          Start monitoring to see AI insights
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Claude API Section */}
      <div style={{
        background: '#1e1e1e',
        borderRadius: 8,
        padding: 16,
      }}>
        <div style={{
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ color: '#D4A574' }}>&#9733;</span>
          Claude AI Analysis
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="password"
            placeholder="Anthropic API key (sk-ant-...)"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            style={{
              flex: 1,
              background: '#0d0d0d',
              border: '1px solid #333',
              borderRadius: 6,
              padding: '8px 12px',
              color: '#ccc',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            onClick={handleAnalyzeWithClaude}
            disabled={isAnalyzing || !apiKey.trim()}
            style={{
              background: isAnalyzing ? '#333' : '#D4A574',
              color: isAnalyzing ? '#888' : '#000',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: isAnalyzing || !apiKey.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: !apiKey.trim() ? 0.5 : 1,
            }}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze with Claude'}
          </button>
          <button
            onClick={() => setAutoMode(!autoMode)}
            disabled={!apiKey.trim()}
            style={{
              background: autoMode ? '#4CAF50' : '#1a1a2e',
              color: autoMode ? '#000' : '#888',
              border: autoMode ? 'none' : '1px solid #333',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: !apiKey.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: !apiKey.trim() ? 0.5 : 1,
            }}
          >
            {autoMode ? 'Auto: ON' : 'Auto'}
          </button>
        </div>
        {claudeError && (
          <div style={{
            color: '#F44336',
            fontSize: 12,
            marginTop: 8,
          }}>
            {claudeError}
          </div>
        )}
        <div style={{
          color: '#555',
          fontSize: 11,
          marginTop: 8,
        }}>
          Your API key is stored locally in your browser and sent directly to the Anthropic API.
          {' '}<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#D4A574' }}>Get an API key</a>
        </div>
      </div>

      {/* Results header — always visible */}
      <div style={{
        background: '#1e1e1e',
        borderRadius: 8,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
          Analysis Results
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setShowHeuristics(!showHeuristics)}
            style={{
              background: showHeuristics ? '#ffffff10' : 'transparent',
              border: '1px solid #333',
              borderRadius: 4,
              color: showHeuristics ? '#aaa' : '#555',
              fontSize: 11,
              cursor: 'pointer',
              padding: '2px 8px',
            }}
          >
            Heuristics {showHeuristics ? 'ON' : 'OFF'}
          </button>
          {allInsights.length > 0 && (
            <button
              onClick={() => {
                if (expandedIds.size === allInsights.length) {
                  setExpandedIds(new Set())
                } else {
                  setExpandedIds(new Set(allInsights.map(i => i.title)))
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                fontSize: 11,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {expandedIds.size === allInsights.length ? 'Collapse all' : 'Expand all'}
            </button>
          )}
          <div style={{
            color: allInsights.some(i => i.severity === 'critical') ? '#F44336'
              : allInsights.some(i => i.severity === 'warning') ? '#FF9800'
              : '#4CAF50',
            fontSize: 13,
            fontWeight: 500,
          }}>
            {allInsights.length} issue{allInsights.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </div>

      {allInsights.length > 0 ? (
        <>
          <div style={{ maxWidth: 640, position: 'relative', paddingLeft: 72 }}>
            {/* Timeline line */}
            <div style={{
              position: 'absolute',
              left: 51,
              top: 0,
              bottom: 0,
              width: 2,
              background: '#2a2a2a',
            }} />

            {allInsights.map((insight, idx) => {
              const isClaude = insight.id.startsWith('claude-')
              const isExpanded = expandedIds.has(insight.title)
              const isLast = idx === allInsights.length - 1
              return (
                <div
                  key={insight.title}
                  style={{ position: 'relative', marginBottom: isLast ? 0 : 8 }}
                >
                  {/* Timestamp + dot */}
                  <div style={{
                    position: 'absolute',
                    left: -64,
                    top: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <div style={{
                      color: '#555',
                      fontSize: 9,
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                      width: 40,
                      textAlign: 'right',
                    }}>
                      {insight.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: severityColors[insight.severity],
                      border: '2px solid #121212',
                      zIndex: 1,
                      flexShrink: 0,
                    }} />
                  </div>

                  {/* Card */}
                  <div
                    onClick={() => {
                      setExpandedIds(prev => {
                        const next = new Set(prev)
                        if (next.has(insight.title)) next.delete(insight.title)
                        else next.add(insight.title)
                        return next
                      })
                    }}
                    style={{
                      background: `${severityColors[insight.severity]}10`,
                      border: `1px solid ${severityColors[insight.severity]}30`,
                      borderRadius: 8,
                      padding: '10px 14px',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13 }}>{severityIcons[insight.severity]}</span>
                      <span style={{
                        color: severityColors[insight.severity],
                        fontSize: 13,
                        fontWeight: 600,
                        flex: 1,
                      }}>
                        {insight.title}
                      </span>
                      {isClaude && (
                        <span style={{
                          color: '#D4A574',
                          fontSize: 10,
                          fontWeight: 600,
                          background: '#D4A57420',
                          padding: '1px 6px',
                          borderRadius: 3,
                          flexShrink: 0,
                        }}>
                          &#9733; Claude
                        </span>
                      )}
                      {isClaude && (
                        <span style={{ color: '#555', fontSize: 10, flexShrink: 0 }}>
                          {Math.round(insight.confidence)}% confidence
                        </span>
                      )}
                      <span style={{ color: '#555', fontSize: 10, flexShrink: 0 }}>
                        {isExpanded ? '\u25B2' : '\u25BC'}
                      </span>
                    </div>

                    {/* Expanded */}
                    {isExpanded && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ color: '#ccc', fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
                          {insight.description}
                        </div>
                        <div style={{
                          background: '#0d0d0d',
                          borderRadius: 6,
                          padding: '8px 12px',
                          marginBottom: 8,
                        }}>
                          <div style={{ color: '#666', fontSize: 10, fontWeight: 600, marginBottom: 3, textTransform: 'uppercase' }}>
                            Recommendation
                          </div>
                          <div style={{ color: '#aaa', fontSize: 11, lineHeight: 1.5 }}>
                            {insight.recommendation}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const text = `[${insight.severity.toUpperCase()}] ${insight.title}\n\n${insight.description}\n\nRecommendation: ${insight.recommendation}`
                            navigator.clipboard.writeText(text).then(() => {
                              setCopiedId(insight.title)
                              setTimeout(() => setCopiedId(null), 2000)
                            })
                          }}
                          style={{
                            background: copiedId === insight.title ? '#4CAF5030' : '#1a1a2e',
                            color: copiedId === insight.title ? '#4CAF50' : '#888',
                            border: `1px solid ${copiedId === insight.title ? '#4CAF5050' : '#333'}`,
                            borderRadius: 5,
                            padding: '4px 10px',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          {copiedId === insight.title ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div style={{
          background: '#1e1e1e',
          borderRadius: 8,
          padding: 32,
          textAlign: 'center',
        }}>
          <div style={{
            color: '#4CAF50',
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 8,
          }}>
            {!showHeuristics && heuristicInsights.length > 0
              ? 'Heuristics Hidden'
              : 'Performance Looks Good'}
          </div>
          <div style={{
            color: '#888',
            fontSize: 14,
          }}>
            {!showHeuristics && heuristicInsights.length > 0
              ? `${heuristicInsights.length} heuristic insight${heuristicInsights.length !== 1 ? 's' : ''} hidden. Toggle "Heuristics ON" above or try "Analyze with Claude".`
              : 'No significant performance issues detected. Try "Analyze with Claude" for deeper analysis.'}
          </div>
        </div>
      )}
    </div>
  )
}
