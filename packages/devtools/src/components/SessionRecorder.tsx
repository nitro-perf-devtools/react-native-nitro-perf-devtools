import React, { useState, useEffect, useRef, useCallback } from 'react'

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

interface SessionRecorderProps {
  metrics: PerfSnapshot | null
  isMonitoring: boolean
  memoryData: MemoryDataPoint[]
  stutterEvents: StutterEvent[]
}

interface RecordedSession {
  id: string
  name: string
  startTime: number
  endTime: number
  snapshots: PerfSnapshot[]
  memoryData: MemoryDataPoint[]
  stutterEvents: StutterEvent[]
  summary: {
    duration: number
    avgUiFps: number
    avgJsFps: number
    minUiFps: number
    minJsFps: number
    peakRamMB: number
    totalStutters: number
    totalDroppedFrames: number
  }
}

type RecordingState = 'idle' | 'recording' | 'stopped'

function computeSummary(session: Omit<RecordedSession, 'summary'>): RecordedSession['summary'] {
  const snaps = session.snapshots
  const duration = session.endTime - session.startTime

  if (snaps.length === 0) {
    return { duration, avgUiFps: 0, avgJsFps: 0, minUiFps: 0, minJsFps: 0, peakRamMB: 0, totalStutters: 0, totalDroppedFrames: 0 }
  }

  const uiFpsValues = snaps.map((s) => s.uiFps)
  const jsFpsValues = snaps.map((s) => s.jsFps)
  const ramValues = session.memoryData.map((m) => m.ramMB)
  const lastSnap = snaps[snaps.length - 1]

  return {
    duration,
    avgUiFps: parseFloat((uiFpsValues.reduce((a, b) => a + b, 0) / uiFpsValues.length).toFixed(1)),
    avgJsFps: parseFloat((jsFpsValues.reduce((a, b) => a + b, 0) / jsFpsValues.length).toFixed(1)),
    minUiFps: Math.round(Math.min(...uiFpsValues)),
    minJsFps: Math.round(Math.min(...jsFpsValues)),
    peakRamMB: ramValues.length > 0 ? parseFloat(Math.max(...ramValues).toFixed(1)) : 0,
    totalStutters: lastSnap.stutterCount,
    totalDroppedFrames: lastSnap.droppedFrames,
  }
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function SessionRecorder({ metrics, isMonitoring, memoryData, stutterEvents }: SessionRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle')
  const [sessions, setSessions] = useState<RecordedSession[]>([])
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null)

  const recordingRef = useRef<{
    startTime: number
    snapshots: PerfSnapshot[]
    startMemIdx: number
    startStutterIdx: number
  } | null>(null)

  // Accumulate snapshots while recording
  useEffect(() => {
    if (state === 'recording' && metrics && recordingRef.current) {
      recordingRef.current.snapshots.push(metrics)
    }
  }, [metrics, state])

  const handleRecord = useCallback(() => {
    recordingRef.current = {
      startTime: Date.now(),
      snapshots: [],
      startMemIdx: memoryData.length,
      startStutterIdx: stutterEvents.length,
    }
    setState('recording')
  }, [memoryData.length, stutterEvents.length])

  const handleStop = useCallback(() => {
    if (!recordingRef.current) return
    const rec = recordingRef.current
    const endTime = Date.now()

    const sessionData: Omit<RecordedSession, 'summary'> = {
      id: `session-${Date.now()}`,
      name: `Session ${sessions.length + 1}`,
      startTime: rec.startTime,
      endTime,
      snapshots: rec.snapshots,
      memoryData: memoryData.slice(rec.startMemIdx),
      stutterEvents: stutterEvents.slice(rec.startStutterIdx),
    }

    const session: RecordedSession = {
      ...sessionData,
      summary: computeSummary(sessionData),
    }

    setSessions((prev) => [...prev.slice(-4), session])
    setState('stopped')
    recordingRef.current = null
  }, [sessions.length, memoryData, stutterEvents])

  const exportJSON = useCallback((session: RecordedSession) => {
    const data = {
      nitroperf_session: '1.0',
      recorded_at: new Date(session.startTime).toISOString(),
      duration_ms: session.summary.duration,
      summary: session.summary,
      snapshots: session.snapshots,
      memory_timeline: session.memoryData,
      stutter_events: session.stutterEvents,
    }
    downloadFile(JSON.stringify(data, null, 2), `${session.name.replace(/\s/g, '-')}.json`, 'application/json')
  }, [])

  const exportCSV = useCallback((session: RecordedSession) => {
    const headers = 'timestamp,uiFps,jsFps,ramMB,heapUsedMB,heapTotalMB,droppedFrames,stutterCount\n'
    const rows = session.snapshots.map((s) =>
      `${s.timestamp},${s.uiFps.toFixed(1)},${s.jsFps.toFixed(1)},${(s.ramBytes / 1048576).toFixed(1)},${(s.jsHeapUsedBytes / 1048576).toFixed(1)},${(s.jsHeapTotalBytes / 1048576).toFixed(1)},${s.droppedFrames},${s.stutterCount}`
    ).join('\n')
    downloadFile(headers + rows, `${session.name.replace(/\s/g, '-')}.csv`, 'text/csv')
  }, [])

  const compareSession = compareIds
    ? [sessions.find((s) => s.id === compareIds[0]), sessions.find((s) => s.id === compareIds[1])]
    : null

  const btnBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    color: '#fff',
  }

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Session Recording</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {state === 'idle' || state === 'stopped' ? (
            <button onClick={handleRecord} disabled={!isMonitoring} style={{
              ...btnBase,
              background: isMonitoring ? '#F44336' : '#555',
              cursor: isMonitoring ? 'pointer' : 'not-allowed',
            }}>
              ● Record
            </button>
          ) : (
            <button onClick={handleStop} style={{ ...btnBase, background: '#FF9800' }}>
              ■ Stop
            </button>
          )}
        </div>
      </div>

      {/* Recording indicator */}
      {state === 'recording' && (
        <div style={{
          background: '#F4433620',
          border: '1px solid #F44336',
          borderRadius: 6,
          padding: '8px 12px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ color: '#F44336', fontSize: 16, animation: 'pulse 1s infinite' }}>●</span>
          <span style={{ color: '#F44336', fontSize: 12, fontWeight: 600 }}>
            Recording... ({recordingRef.current?.snapshots.length ?? 0} samples)
          </span>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
        </div>
      )}

      {/* Session list */}
      {sessions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>
            Recorded Sessions
          </div>
          {sessions.map((session) => (
            <div key={session.id} style={{
              background: '#252525',
              borderRadius: 6,
              padding: '10px 12px',
              marginBottom: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{session.name}</span>
                <span style={{ color: '#888', fontSize: 10 }}>
                  {(session.summary.duration / 1000).toFixed(1)}s — {session.snapshots.length} samples
                </span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ color: '#aaa', fontSize: 11 }}>
                  UI: <b style={{ color: '#2196F3' }}>{session.summary.avgUiFps}</b> avg
                </span>
                <span style={{ color: '#aaa', fontSize: 11 }}>
                  JS: <b style={{ color: '#4CAF50' }}>{session.summary.avgJsFps}</b> avg
                </span>
                <span style={{ color: '#aaa', fontSize: 11 }}>
                  RAM: <b style={{ color: '#FF9800' }}>{session.summary.peakRamMB}</b> MB peak
                </span>
                <span style={{ color: '#aaa', fontSize: 11 }}>
                  Stutters: <b style={{ color: session.summary.totalStutters > 0 ? '#F44336' : '#4CAF50' }}>{session.summary.totalStutters}</b>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => exportJSON(session)} style={{ ...btnBase, background: '#333', padding: '4px 10px', fontSize: 11 }}>
                  Export JSON
                </button>
                <button onClick={() => exportCSV(session)} style={{ ...btnBase, background: '#333', padding: '4px 10px', fontSize: 11 }}>
                  Export CSV
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compare mode */}
      {sessions.length >= 2 && (
        <div>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>
            Compare Sessions
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <select
              onChange={(e) => setCompareIds((prev) => [e.target.value, prev?.[1] ?? sessions[1].id])}
              value={compareIds?.[0] ?? sessions[0].id}
              style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, padding: '4px 8px', fontSize: 11 }}
            >
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span style={{ color: '#888', fontSize: 12, alignSelf: 'center' }}>vs</span>
            <select
              onChange={(e) => setCompareIds((prev) => [prev?.[0] ?? sessions[0].id, e.target.value])}
              value={compareIds?.[1] ?? sessions[1].id}
              style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, padding: '4px 8px', fontSize: 11 }}
            >
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {compareSession && compareSession[0] && compareSession[1] && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#888', fontSize: 11 }}>Metric</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: '#888', fontSize: 11 }}>{compareSession[0].name}</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: '#888', fontSize: 11 }}>{compareSession[1].name}</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: '#888', fontSize: 11 }}>Diff</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Avg UI FPS', a: compareSession[0].summary.avgUiFps, b: compareSession[1].summary.avgUiFps, higher: true },
                  { label: 'Avg JS FPS', a: compareSession[0].summary.avgJsFps, b: compareSession[1].summary.avgJsFps, higher: true },
                  { label: 'Peak RAM (MB)', a: compareSession[0].summary.peakRamMB, b: compareSession[1].summary.peakRamMB, higher: false },
                  { label: 'Stutters', a: compareSession[0].summary.totalStutters, b: compareSession[1].summary.totalStutters, higher: false },
                  { label: 'Dropped Frames', a: compareSession[0].summary.totalDroppedFrames, b: compareSession[1].summary.totalDroppedFrames, higher: false },
                ].map((row) => {
                  const diff = row.b - row.a
                  const better = row.higher ? diff > 0 : diff < 0
                  return (
                    <tr key={row.label} style={{ borderBottom: '1px solid #2a2a2a' }}>
                      <td style={{ padding: '6px 8px', color: '#aaa', fontSize: 12 }}>{row.label}</td>
                      <td style={{ padding: '6px 8px', color: '#fff', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.a}</td>
                      <td style={{ padding: '6px 8px', color: '#fff', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.b}</td>
                      <td style={{
                        padding: '6px 8px',
                        color: diff === 0 ? '#888' : better ? '#4CAF50' : '#F44336',
                        fontSize: 12,
                        textAlign: 'right',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {sessions.length === 0 && state === 'idle' && (
        <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 16 }}>
          Start monitoring, then click Record to capture a performance session
        </div>
      )}
    </div>
  )
}
