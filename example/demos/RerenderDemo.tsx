import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'

// ─── Renders/sec Counter Hook ────────────────────────────────────────

function useRendersPerSecond(): number {
  const renderCount = useRef(0)
  const [rps, setRps] = useState(0)

  renderCount.current++

  useEffect(() => {
    const interval = setInterval(() => {
      setRps(renderCount.current)
      renderCount.current = 0
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return rps
}

// ─── Fast Counter (60fps RAF) ────────────────────────────────────────

function FastCounter() {
  const [running, setRunning] = useState(false)
  const [count, setCount] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (running) {
      const tick = () => {
        setCount(c => c + 1)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
      return () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      }
    } else {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [running])

  return (
    <View>
      <Text style={styles.sectionTitle}>Fast Counter (60fps RAF)</Text>
      <Text style={styles.sectionDesc}>
        Updates state every frame via requestAnimationFrame, forcing a re-render
        on each frame. Stresses React reconciliation on the JS thread.
      </Text>

      <TouchableOpacity
        style={[styles.button, running ? styles.buttonDanger : styles.buttonWarning]}
        onPress={() => setRunning(r => !r)}
      >
        <Text style={styles.buttonText}>
          {running ? 'Stop Counter' : 'Start Counter'}
        </Text>
      </TouchableOpacity>

      <View style={styles.resultBox}>
        <Text style={styles.resultText}>Count: {count}</Text>
      </View>
    </View>
  )
}

// ─── Context Thrash (500 consumers) ──────────────────────────────────

const ThrashContext = createContext(0)

function ThrashConsumer({ index }: { index: number }) {
  const value = useContext(ThrashContext)
  return (
    <View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        margin: 1,
        backgroundColor: `hsl(${(value + index * 7) % 360}, 70%, 50%)`,
      }}
    />
  )
}

const CONSUMER_COUNT = 500
const consumers = Array.from({ length: CONSUMER_COUNT }, (_, i) => i)

function ContextThrash() {
  const [running, setRunning] = useState(false)
  const [contextValue, setContextValue] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setContextValue(v => v + 1)
      }, 16)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  return (
    <View>
      <Text style={styles.sectionTitle}>Context Thrash (500 consumers)</Text>
      <Text style={styles.sectionDesc}>
        Rapidly updates a React Context every 16ms, causing all 500 consumer
        components to re-render simultaneously. Stresses reconciliation.
      </Text>

      <TouchableOpacity
        style={[styles.button, running ? styles.buttonDanger : styles.buttonWarning]}
        onPress={() => setRunning(r => !r)}
      >
        <Text style={styles.buttonText}>
          {running ? 'Stop Context Thrash' : 'Start Context Thrash'}
        </Text>
      </TouchableOpacity>

      <View style={styles.resultBox}>
        <Text style={styles.resultText}>Context updates: {contextValue}</Text>
      </View>

      <ThrashContext.Provider value={contextValue}>
        <View style={styles.consumerGrid}>
          {consumers.map(i => (
            <ThrashConsumer key={i} index={i} />
          ))}
        </View>
      </ThrashContext.Provider>
    </View>
  )
}

// ─── Deep Tree (30+ levels) ──────────────────────────────────────────

function DeepNode({ depth, value }: { depth: number; value: number }) {
  if (depth <= 0) {
    return (
      <Text
        style={{
          color: `hsl(${(value * 12) % 360}, 70%, 60%)`,
          fontSize: 10,
          fontFamily: 'monospace',
        }}
      >
        {value}
      </Text>
    )
  }
  return (
    <View style={{ paddingLeft: 2 }}>
      <DeepNode depth={depth - 1} value={value} />
    </View>
  )
}

function DeepTree() {
  const [running, setRunning] = useState(false)
  const [tick, setTick] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTick(t => t + 1)
      }, 50)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  return (
    <View>
      <Text style={styles.sectionTitle}>Deep Tree (30 levels)</Text>
      <Text style={styles.sectionDesc}>
        Renders a 30-level nested component tree and forces re-renders from
        the root every 50ms. Tests deep reconciliation cost.
      </Text>

      <TouchableOpacity
        style={[styles.button, running ? styles.buttonDanger : styles.buttonWarning]}
        onPress={() => setRunning(r => !r)}
      >
        <Text style={styles.buttonText}>
          {running ? 'Stop Deep Tree' : 'Start Deep Tree'}
        </Text>
      </TouchableOpacity>

      <View style={styles.resultBox}>
        <Text style={styles.resultText}>Root re-renders: {tick}</Text>
        <View style={{ marginTop: 8 }}>
          <DeepNode depth={30} value={tick} />
        </View>
      </View>
    </View>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────

export function RerenderDemo() {
  const rps = useRendersPerSecond()

  return (
    <ScrollView style={styles.demoContainer}>
      <Text style={styles.sectionTitle}>Re-render Stress Tests</Text>
      <Text style={styles.sectionDesc}>
        Forces massive re-render storms on the JS thread.{'\n'}
        Watch JS FPS drop as reconciliation work increases.
      </Text>

      <View style={styles.resultBox}>
        <Text style={styles.resultText}>Renders/sec: {rps}</Text>
      </View>

      <View style={styles.separator} />
      <FastCounter />

      <View style={styles.separator} />
      <ContextThrash />

      <View style={styles.separator} />
      <DeepTree />

      <View style={{ height: 80 }} />
    </ScrollView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  demoContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDesc: {
    color: '#888',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#2a2a4a',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonWarning: {
    backgroundColor: '#5a4a00',
  },
  buttonDanger: {
    backgroundColor: '#5a0000',
  },
  resultBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  resultText: {
    color: '#4CAF50',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  separator: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 20,
  },
  consumerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
})
