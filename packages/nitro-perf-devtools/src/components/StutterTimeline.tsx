import React, { useMemo } from 'react'

interface StutterEvent {
  timestamp: number
  droppedFrames: number
}

export function StutterTimeline({
  events,
  totalDurationMs = 60000,
}: {
  events: StutterEvent[]
  totalDurationMs?: number
}) {
  const timelineWidth = 600

  const markers = useMemo(() => {
    if (events.length === 0) return []

    const startTime = events.length > 0 ? events[0].timestamp : 0
    return events.map((event) => {
      const offsetPct = ((event.timestamp - startTime) / totalDurationMs) * 100
      const severity = event.droppedFrames >= 10 ? 'severe' : event.droppedFrames >= 4 ? 'moderate' : 'minor'
      return {
        ...event,
        offsetPct: Math.min(100, Math.max(0, offsetPct)),
        severity,
      }
    })
  }, [events, totalDurationMs])

  const severityColors: Record<string, string> = {
    severe: '#F44336',
    moderate: '#FF9800',
    minor: '#FFC107',
  }

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Stutter Timeline
        <span style={{ color: '#888', fontSize: 11, marginLeft: 12, fontWeight: 400 }}>
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline bar */}
      <div style={{
        position: 'relative',
        height: 32,
        background: '#2a2a2a',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <div
            key={pct}
            style={{
              position: 'absolute',
              left: `${pct}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: '#333',
            }}
          />
        ))}

        {/* Stutter markers */}
        {markers.map((marker, i) => (
          <div
            key={i}
            title={`${marker.droppedFrames} dropped frames`}
            style={{
              position: 'absolute',
              left: `${marker.offsetPct}%`,
              top: 2,
              bottom: 2,
              width: Math.max(3, marker.droppedFrames),
              background: severityColors[marker.severity],
              borderRadius: 2,
              opacity: 0.9,
            }}
          />
        ))}

        {/* No stutters message */}
        {events.length === 0 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4CAF50',
            fontSize: 12,
          }}>
            No stutters detected
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        {Object.entries(severityColors).map(([severity, color]) => (
          <div key={severity} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ color: '#888', fontSize: 10, textTransform: 'capitalize' }}>
              {severity}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
