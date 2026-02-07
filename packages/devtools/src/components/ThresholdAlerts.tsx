import React, { useState } from 'react'

interface AlertEntry {
  id: string
  level: 'warning' | 'critical'
  message: string
  timestamp: number
  value: number
}

interface ThresholdAlertsProps {
  alerts: AlertEntry[]
  onClearAlerts: () => void
  maxVisible?: number
}

export function ThresholdAlerts({ alerts, onClearAlerts, maxVisible = 50 }: ThresholdAlertsProps) {
  const [expanded, setExpanded] = useState(false)

  const visibleAlerts = expanded ? alerts.slice(-maxVisible) : alerts.slice(-5)
  const criticalCount = alerts.filter((a) => a.level === 'critical').length
  const warningCount = alerts.filter((a) => a.level === 'warning').length

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Alerts</span>
          {criticalCount > 0 && (
            <span style={{
              background: '#F44336',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 10,
            }}>
              {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span style={{
              background: '#FF9800',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 10,
            }}>
              {warningCount}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {alerts.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: 'transparent',
                color: '#888',
                border: '1px solid #444',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {expanded ? 'Collapse' : `Show all (${alerts.length})`}
            </button>
          )}
          <button
            onClick={onClearAlerts}
            style={{
              background: 'transparent',
              color: '#888',
              border: '1px solid #444',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div style={{ color: '#4CAF50', fontSize: 12, textAlign: 'center', padding: 12 }}>
          No alerts — all metrics within thresholds
        </div>
      ) : (
        <div style={{ maxHeight: expanded ? 400 : 200, overflowY: 'auto' }}>
          {visibleAlerts.reverse().map((alert) => (
            <div
              key={alert.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0',
                borderBottom: '1px solid #2a2a2a',
              }}
            >
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: alert.level === 'critical' ? '#F44336' : '#FF9800',
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#ccc', fontSize: 12 }}>{alert.message}</div>
              </div>
              <div style={{
                color: alert.level === 'critical' ? '#F44336' : '#FF9800',
                fontSize: 12,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}>
                {typeof alert.value === 'number' ? alert.value.toFixed(1) : alert.value}
              </div>
              <div style={{ color: '#666', fontSize: 10, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {new Date(alert.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
