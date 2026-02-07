import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Image,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import {
  PerfOverlay,
  registerDevMenuItem,
  usePerfMetrics,
} from '@nitroperf/core'
import { useNitroPerfDevTools } from '@nitroperf/devtools'

type DemoTab = 'scroll' | 'jank' | 'memory' | 'animations'

// ─── Heavy Scroll Items ───────────────────────────────────────────────

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

// ─── JS Jank Demo ─────────────────────────────────────────────────────

function fibonacci(n: number): number {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}

function JankDemo() {
  const [computing, setComputing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [autoJank, setAutoJank] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const runHeavyWork = useCallback((fibN: number) => {
    setComputing(true)
    // Use setTimeout to ensure state updates render before blocking
    setTimeout(() => {
      const start = performance.now()
      const val = fibonacci(fibN)
      const elapsed = performance.now() - start
      setResult(`fib(${fibN}) = ${val} in ${elapsed.toFixed(0)}ms`)
      setComputing(false)
    }, 16)
  }, [])

  useEffect(() => {
    if (autoJank) {
      intervalRef.current = setInterval(() => {
        // Sort a large array on the JS thread every 200ms
        const arr = Array.from({ length: 50000 }, () => Math.random())
        arr.sort()
      }, 200)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoJank])

  return (
    <ScrollView style={styles.demoContainer}>
      <Text style={styles.sectionTitle}>JS Thread Stress Tests</Text>
      <Text style={styles.sectionDesc}>
        These tests block the JS thread, causing JS FPS drops.{'\n'}
        Watch the JS FPS counter turn orange/red.
      </Text>

      <TouchableOpacity
        style={[styles.button, computing && styles.buttonDisabled]}
        onPress={() => runHeavyWork(35)}
        disabled={computing}
      >
        <Text style={styles.buttonText}>
          {computing ? 'Computing...' : 'fib(35) — Light block (~50ms)'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, computing && styles.buttonDisabled]}
        onPress={() => runHeavyWork(40)}
        disabled={computing}
      >
        <Text style={styles.buttonText}>
          {computing ? 'Computing...' : 'fib(40) — Heavy block (~1s)'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, computing && styles.buttonDisabled]}
        onPress={() => runHeavyWork(43)}
        disabled={computing}
      >
        <Text style={styles.buttonText}>
          {computing ? 'Computing...' : 'fib(43) — Very heavy (~5s)'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, autoJank ? styles.buttonDanger : styles.buttonWarning]}
        onPress={() => setAutoJank(!autoJank)}
      >
        <Text style={styles.buttonText}>
          {autoJank ? 'Stop Continuous Jank' : 'Start Continuous Jank (sort 50K every 200ms)'}
        </Text>
      </TouchableOpacity>

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      )}
    </ScrollView>
  )
}

// ─── Memory Demo ──────────────────────────────────────────────────────

function MemoryDemo() {
  const [buffers, setBuffers] = useState<ArrayBuffer[]>([])
  const [totalMB, setTotalMB] = useState(0)

  const allocate = useCallback((sizeMB: number) => {
    const buf = new ArrayBuffer(sizeMB * 1024 * 1024)
    // Touch the memory to ensure it's actually allocated
    const view = new Uint8Array(buf)
    for (let i = 0; i < view.length; i += 4096) {
      view[i] = i & 0xff
    }
    setBuffers(prev => [...prev, buf])
    setTotalMB(prev => prev + sizeMB)
  }, [])

  const releaseAll = useCallback(() => {
    setBuffers([])
    setTotalMB(0)
    // Hint GC (won't guarantee collection, but helps)
    if (typeof global.gc === 'function') {
      global.gc()
    }
  }, [])

  const releaseLast = useCallback(() => {
    setBuffers(prev => {
      if (prev.length === 0) return prev
      const removed = prev[prev.length - 1]
      setTotalMB(t => t - removed.byteLength / (1024 * 1024))
      return prev.slice(0, -1)
    })
  }, [])

  return (
    <ScrollView style={styles.demoContainer}>
      <Text style={styles.sectionTitle}>Memory Stress Tests</Text>
      <Text style={styles.sectionDesc}>
        Allocate/release JS ArrayBuffers and watch RAM change.{'\n'}
        Held: {buffers.length} buffers ({totalMB} MB)
      </Text>

      <TouchableOpacity style={styles.button} onPress={() => allocate(10)}>
        <Text style={styles.buttonText}>Allocate 10 MB</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => allocate(50)}>
        <Text style={styles.buttonText}>Allocate 50 MB</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => allocate(100)}>
        <Text style={styles.buttonText}>Allocate 100 MB</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonWarning]}
        onPress={releaseLast}
        disabled={buffers.length === 0}
      >
        <Text style={styles.buttonText}>Release Last Buffer</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonDanger]}
        onPress={releaseAll}
        disabled={buffers.length === 0}
      >
        <Text style={styles.buttonText}>Release All + GC Hint</Text>
      </TouchableOpacity>

      <View style={styles.memoryGrid}>
        {buffers.map((buf, i) => (
          <View
            key={i}
            style={[styles.memoryBlock, {
              backgroundColor: `hsl(${(buf.byteLength / (1024 * 1024)) * 3}, 70%, 40%)`,
            }]}
          >
            <Text style={styles.memoryBlockText}>
              {(buf.byteLength / (1024 * 1024)).toFixed(0)}MB
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

// ─── Animation Stress Demo ────────────────────────────────────────────

function AnimationBall({ index, running }: { index: number; running: boolean }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (running) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 800 + index * 50,
            useNativeDriver: false, // Intentionally using JS driver to stress JS thread
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 800 + index * 50,
            useNativeDriver: false,
          }),
        ]),
      )
      animation.start()
      return () => animation.stop()
    } else {
      anim.setValue(0)
    }
  }, [running, anim, index])

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 250],
  })

  const backgroundColor = `hsl(${index * 23 % 360}, 70%, 50%)`

  return (
    <Animated.View
      style={[styles.ball, { backgroundColor, transform: [{ translateX }] }]}
    />
  )
}

function AnimationDemo() {
  const [ballCount, setBallCount] = useState(0)
  const [running, setRunning] = useState(false)

  return (
    <ScrollView style={styles.demoContainer}>
      <Text style={styles.sectionTitle}>Animation Stress Tests</Text>
      <Text style={styles.sectionDesc}>
        JS-driven animations (useNativeDriver: false) stress both threads.{'\n'}
        Active balls: {ballCount}
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSmall]}
          onPress={() => setBallCount(c => c + 5)}
        >
          <Text style={styles.buttonText}>+5 Balls</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonSmall]}
          onPress={() => setBallCount(c => c + 20)}
        >
          <Text style={styles.buttonText}>+20 Balls</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonSmall]}
          onPress={() => setBallCount(c => Math.max(0, c - 10))}
        >
          <Text style={styles.buttonText}>-10</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, running ? styles.buttonDanger : styles.buttonSuccess]}
        onPress={() => setRunning(!running)}
      >
        <Text style={styles.buttonText}>
          {running ? 'Stop All Animations' : 'Start Animations'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonWarning]}
        onPress={() => { setBallCount(0); setRunning(false) }}
      >
        <Text style={styles.buttonText}>Reset</Text>
      </TouchableOpacity>

      <View style={styles.ballContainer}>
        {Array.from({ length: ballCount }, (_, i) => (
          <AnimationBall key={i} index={i} running={running} />
        ))}
      </View>
    </ScrollView>
  )
}

// ─── Scroll Stress Demo ───────────────────────────────────────────────

function ScrollDemo() {
  return (
    <FlatList
      data={Array.from({ length: 500 }, (_, i) => i)}
      renderItem={({ item }) => <HeavyItem index={item} />}
      keyExtractor={item => String(item)}
      removeClippedSubviews={false}
      style={{ flex: 1 }}
      contentContainerStyle={styles.scrollContent}
    />
  )
}

// ─── Tab Bar ──────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: DemoTab; onChange: (tab: DemoTab) => void }) {
  const tabs: { key: DemoTab; label: string }[] = [
    { key: 'scroll', label: 'Scroll' },
    { key: 'jank', label: 'JS Jank' },
    { key: 'memory', label: 'Memory' },
    { key: 'animations', label: 'Anim' },
  ]

  return (
    <View style={styles.tabBar}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, active === tab.key && styles.tabActive]}
          onPress={() => onChange(tab.key)}
        >
          <Text style={[styles.tabText, active === tab.key && styles.tabTextActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────

export default function App() {
  const [showOverlay, setShowOverlay] = useState(true)
  const [activeTab, setActiveTab] = useState<DemoTab>('scroll')
  const { metrics } = usePerfMetrics({ updateIntervalMs: 300 })
  useNitroPerfDevTools()

  useEffect(() => {
    registerDevMenuItem(setShowOverlay)
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nitro Perf Demo</Text>
        {metrics && (
          <Text style={styles.headerMetrics}>
            UI: {Math.round(metrics.uiFps)} | JS: {Math.round(metrics.jsFps)} |
            RAM: {(metrics.ramBytes / (1024 * 1024)).toFixed(0)}MB |
            Dropped: {Math.round(metrics.droppedFrames)} | Stutters: {Math.round(metrics.stutterCount)}
          </Text>
        )}
      </View>

      {/* Tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Demo content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'scroll' && <ScrollDemo />}
        {activeTab === 'jank' && <JankDemo />}
        {activeTab === 'memory' && <MemoryDemo />}
        {activeTab === 'animations' && <AnimationDemo />}
      </View>

      {/* Perf overlay */}
      <PerfOverlay
        visible={showOverlay}
        onClose={() => setShowOverlay(false)}
      />
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  header: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  headerMetrics: {
    color: '#4CAF50',
    fontSize: 11,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#4CAF50',
  },
  // Demo container
  demoContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionDesc: {
    color: '#999',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  // Buttons
  button: {
    backgroundColor: '#2a2a4a',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonSmall: {
    flex: 1,
    marginHorizontal: 4,
    padding: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonWarning: {
    backgroundColor: '#FF980033',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  buttonDanger: {
    backgroundColor: '#F4433633',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  buttonSuccess: {
    backgroundColor: '#4CAF5033',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  resultBox: {
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  resultText: {
    color: '#4CAF50',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  // Memory blocks
  memoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 6,
  },
  memoryBlock: {
    width: 60,
    height: 60,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryBlockText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  // Animation balls
  ballContainer: {
    marginTop: 12,
    gap: 4,
  },
  ball: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  // Scroll items
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
