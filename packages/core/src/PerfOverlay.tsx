import React, { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native'
import type { PanResponderGestureState, GestureResponderEvent } from 'react-native'
import { usePerfMetrics } from './usePerfMetrics'
import type { PerfSnapshot, FPSHistory } from './specs/nitro-perf.nitro'

interface PerfOverlayProps {
  /** Whether the overlay is visible */
  visible?: boolean
  /** Called when the user taps the close button */
  onClose?: () => void
  /** Initial position offset from top-left */
  initialPosition?: { x: number; y: number }
}

const COMPACT_WIDTH = 180
const COMPACT_HEIGHT = 48
const EXPANDED_WIDTH = 260
const EXPANDED_HEIGHT = 320

function getFpsColor(fps: number): string {
  if (fps >= 55) return '#4CAF50' // Green
  if (fps >= 40) return '#FF9800' // Orange
  return '#F44336' // Red
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

/** Tiny inline sparkline bar graph */
function SparklineBar({
  samples,
  maxValue = 60,
  width = 200,
  height = 30,
  color = '#4CAF50',
}: {
  samples: number[]
  maxValue?: number
  width?: number
  height?: number
  color?: string
}) {
  if (samples.length === 0) return null

  const barWidth = Math.max(1, (width - samples.length) / samples.length)

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, width }}>
      {samples.slice(-Math.floor(width / (barWidth + 1))).map((value, i) => {
        const barHeight = Math.max(1, (value / maxValue) * height)
        const barColor = getFpsColor(value)
        return (
          <View
            key={i}
            style={{
              width: barWidth,
              height: barHeight,
              backgroundColor: color === 'auto' ? barColor : color,
              marginRight: 1,
            }}
          />
        )
      })}
    </View>
  )
}

function CompactView({
  metrics,
  onExpand,
  onClose,
}: {
  metrics: PerfSnapshot | null
  onExpand: () => void
  onClose?: () => void
}) {
  const uiFps = metrics?.uiFps ?? 0
  const jsFps = metrics?.jsFps ?? 0
  const ram = metrics?.ramBytes ?? 0

  return (
    <TouchableOpacity
      onPress={onExpand}
      activeOpacity={0.8}
      style={styles.compactContainer}
    >
      <View style={styles.compactRow}>
        <Text style={styles.ramLabel}>{formatBytes(ram)}</Text>
        <Text style={[styles.fpsLabel, { color: getFpsColor(uiFps) }]}>
          UI {Math.round(uiFps)}
        </Text>
        <Text style={[styles.fpsLabel, { color: getFpsColor(jsFps) }]}>
          JS {Math.round(jsFps)}
        </Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>x</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  )
}

function ExpandedView({
  metrics,
  history,
  onCollapse,
  onClose,
}: {
  metrics: PerfSnapshot | null
  history: FPSHistory | null
  onCollapse: () => void
  onClose?: () => void
}) {
  return (
    <View style={styles.expandedContainer}>
      {/* Header */}
      <View style={styles.expandedHeader}>
        <TouchableOpacity onPress={onCollapse}>
          <Text style={styles.headerTitle}>Perf Monitor</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>x</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* FPS section */}
      <View style={styles.section}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>UI FPS</Text>
          <Text style={[styles.metricValue, { color: getFpsColor(metrics?.uiFps ?? 0) }]}>
            {Math.round(metrics?.uiFps ?? 0)}
          </Text>
          <Text style={styles.metricRange}>
            {history ? `${history.uiFpsMin}-${history.uiFpsMax}` : '--'}
          </Text>
        </View>
        <SparklineBar
          samples={history?.uiFpsSamples ?? []}
          color="auto"
          width={EXPANDED_WIDTH - 24}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>JS FPS</Text>
          <Text style={[styles.metricValue, { color: getFpsColor(metrics?.jsFps ?? 0) }]}>
            {Math.round(metrics?.jsFps ?? 0)}
          </Text>
          <Text style={styles.metricRange}>
            {history ? `${history.jsFpsMin}-${history.jsFpsMax}` : '--'}
          </Text>
        </View>
        <SparklineBar
          samples={history?.jsFpsSamples ?? []}
          color="auto"
          width={EXPANDED_WIDTH - 24}
        />
      </View>

      {/* Memory section */}
      <View style={styles.section}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>RAM</Text>
          <Text style={styles.metricValue}>{formatBytes(metrics?.ramBytes ?? 0)}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>JS Heap</Text>
          <Text style={styles.metricValue}>
            {formatBytes(metrics?.jsHeapUsedBytes ?? 0)} / {formatBytes(metrics?.jsHeapTotalBytes ?? 0)}
          </Text>
        </View>
      </View>

      {/* Stutter section */}
      <View style={styles.section}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Dropped</Text>
          <Text style={styles.metricValue}>{Math.round(metrics?.droppedFrames ?? 0)}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Stutters</Text>
          <Text style={[
            styles.metricValue,
            (metrics?.stutterCount ?? 0) > 0 && { color: '#F44336' },
          ]}>
            {Math.round(metrics?.stutterCount ?? 0)}
          </Text>
        </View>
      </View>
    </View>
  )
}

export function PerfOverlay({
  visible = true,
  onClose,
  initialPosition = { x: 10, y: 60 },
}: PerfOverlayProps) {
  const [expanded, setExpanded] = useState(false)
  const { metrics, history } = usePerfMetrics()

  const pan = useRef(new Animated.ValueXY(initialPosition)).current

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        // Only capture pan if user has moved significantly
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        })
        pan.setValue({ x: 0, y: 0 })
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset()

        // Clamp to screen bounds
        const { width: screenW, height: screenH } = Dimensions.get('window')
        const overlayW = expanded ? EXPANDED_WIDTH : COMPACT_WIDTH
        const overlayH = expanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT

        const x = Math.max(0, Math.min((pan.x as any)._value, screenW - overlayW))
        const y = Math.max(0, Math.min((pan.y as any)._value, screenH - overlayH))
        pan.setValue({ x, y })
      },
    })
  ).current

  const handleExpand = useCallback(() => setExpanded(true), [])
  const handleCollapse = useCallback(() => setExpanded(false), [])

  if (!visible) return null

  return (
    <Animated.View
      style={[
        styles.overlay,
        { transform: pan.getTranslateTransform() },
      ]}
      {...panResponder.panHandlers}
    >
      {expanded ? (
        <ExpandedView
          metrics={metrics}
          history={history}
          onCollapse={handleCollapse}
          onClose={onClose}
        />
      ) : (
        <CompactView
          metrics={metrics}
          onExpand={handleExpand}
          onClose={onClose}
        />
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    zIndex: 99999,
    elevation: 99999,
  },
  compactContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: COMPACT_WIDTH,
    height: COMPACT_HEIGHT,
    justifyContent: 'center',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fpsLabel: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  ramLabel: {
    fontSize: 11,
    color: '#AAA',
    fontVariant: ['tabular-nums'],
  },
  closeButton: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  expandedContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    borderRadius: 10,
    padding: 12,
    width: EXPANDED_WIDTH,
    minHeight: EXPANDED_HEIGHT,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginBottom: 10,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    color: '#AAA',
    fontSize: 11,
    flex: 1,
  },
  metricValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  metricRange: {
    color: '#888',
    fontSize: 10,
    marginLeft: 8,
    fontVariant: ['tabular-nums'],
  },
})
