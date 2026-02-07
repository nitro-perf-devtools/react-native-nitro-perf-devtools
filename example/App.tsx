import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import {
  PerfOverlay,
  registerDevMenuItem,
  usePerfMetrics,
} from 'react-native-nitro-perf'

// DevTools hook — uncomment when @rozenite/plugin-bridge is installed:
// import { useNitroPerfDevTools } from 'nitro-perf-devtools'

/**
 * A deliberately heavy item to stress-test FPS tracking.
 * Renders multiple nested views and text to simulate real-world complexity.
 */
function HeavyItem({ index }: { index: number }) {
  const bgColor = index % 2 === 0 ? '#1a1a2e' : '#16213e'

  return (
    <View style={[styles.item, { backgroundColor: bgColor }]}>
      <View style={styles.itemHeader}>
        <View style={[styles.avatar, { backgroundColor: `hsl(${index * 37 % 360}, 70%, 50%)` }]}>
          <Text style={styles.avatarText}>{String.fromCharCode(65 + (index % 26))}</Text>
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>Item #{index + 1}</Text>
          <Text style={styles.itemSubtitle}>
            This is a sample row with enough text to cause layout work.
            The performance monitor should detect FPS drops during fast scrolling.
          </Text>
        </View>
      </View>
      <View style={styles.itemFooter}>
        {Array.from({ length: 5 }, (_, i) => (
          <View
            key={i}
            style={[styles.tag, { backgroundColor: `hsl(${(index * 37 + i * 72) % 360}, 50%, 30%)` }]}
          >
            <Text style={styles.tagText}>Tag {i + 1}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export default function App() {
  const [showOverlay, setShowOverlay] = useState(true)
  const { metrics } = usePerfMetrics()

  // Register dev menu toggle
  useEffect(() => {
    registerDevMenuItem(setShowOverlay)
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nitro Perf Demo</Text>
        <Text style={styles.headerSubtitle}>
          Scroll fast to stress-test FPS tracking
        </Text>
        {metrics && (
          <Text style={styles.headerMetrics}>
            UI: {Math.round(metrics.uiFps)} | JS: {Math.round(metrics.jsFps)} |
            RAM: {(metrics.ramBytes / (1024 * 1024)).toFixed(0)}MB
          </Text>
        )}
      </View>

      {/* Heavy scroll list to stress-test */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        removeClippedSubviews={false} // Intentionally disabled to stress-test
      >
        {Array.from({ length: 200 }, (_, i) => (
          <HeavyItem key={i} index={i} />
        ))}
      </ScrollView>

      {/* Perf overlay */}
      <PerfOverlay
        visible={showOverlay}
        onClose={() => setShowOverlay(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  headerMetrics: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  item: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  itemSubtitle: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  itemFooter: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagText: {
    color: '#ccc',
    fontSize: 10,
  },
})
