import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'

export function GCPressureDemo() {
  const [churnActive, setChurnActive] = useState(false)
  const [churnRate, setChurnRate] = useState(0)
  const [stringActive, setStringActive] = useState(false)
  const [stringLength, setStringLength] = useState(0)
  const [closureActive, setClosureActive] = useState(false)
  const [closureCount, setClosureCount] = useState(0)

  const churnRef = useRef<number | null>(null)
  const churnCountRef = useRef(0)
  const churnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stringRef = useRef<number | null>(null)
  const stringLenRef = useRef(0)
  const stringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const closureRef = useRef<number | null>(null)
  const closureCountRef = useRef(0)
  const closureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // --- Object Churn ---
  useEffect(() => {
    if (churnActive) {
      churnCountRef.current = 0

      const tick = () => {
        const garbage: unknown[] = []
        for (let i = 0; i < 2000; i++) {
          switch (i % 4) {
            case 0:
              garbage.push(Array.from({ length: 50 }, (_, j) => j * Math.random()))
              break
            case 1:
              garbage.push(new Map([['key' + i, { nested: { value: i } }]]))
              break
            case 2:
              garbage.push({ ['prop_' + i]: 'val_' + i, data: { a: 1, b: [2, 3] } })
              break
            case 3:
              garbage.push({ outer: { inner: { deep: Array.from({ length: 20 }, () => ({ x: Math.random() })) } } })
              break
          }
        }
        churnCountRef.current += garbage.length
        churnRef.current = requestAnimationFrame(tick)
      }

      churnRef.current = requestAnimationFrame(tick)
      churnTimerRef.current = setInterval(() => {
        setChurnRate(churnCountRef.current)
        churnCountRef.current = 0
      }, 1000)
    } else {
      if (churnRef.current != null) cancelAnimationFrame(churnRef.current)
      if (churnTimerRef.current != null) clearInterval(churnTimerRef.current)
      churnRef.current = null
      churnTimerRef.current = null
      setChurnRate(0)
    }

    return () => {
      if (churnRef.current != null) cancelAnimationFrame(churnRef.current)
      if (churnTimerRef.current != null) clearInterval(churnTimerRef.current)
    }
  }, [churnActive])

  // --- String Concatenation Storm ---
  useEffect(() => {
    if (stringActive) {
      stringLenRef.current = 0

      const tick = () => {
        let s = ''
        for (let i = 0; i < 500; i++) {
          s += 'abcdefghijklmnop_' + i + '_' + Math.random().toString(36)
        }
        stringLenRef.current = s.length
        stringRef.current = requestAnimationFrame(tick)
      }

      stringRef.current = requestAnimationFrame(tick)
      stringTimerRef.current = setInterval(() => {
        setStringLength(stringLenRef.current)
      }, 500)
    } else {
      if (stringRef.current != null) cancelAnimationFrame(stringRef.current)
      if (stringTimerRef.current != null) clearInterval(stringTimerRef.current)
      stringRef.current = null
      stringTimerRef.current = null
      setStringLength(0)
    }

    return () => {
      if (stringRef.current != null) cancelAnimationFrame(stringRef.current)
      if (stringTimerRef.current != null) clearInterval(stringTimerRef.current)
    }
  }, [stringActive])

  // --- Closure Factory ---
  useEffect(() => {
    if (closureActive) {
      closureCountRef.current = 0

      const tick = () => {
        const closures: Array<() => number> = []
        for (let i = 0; i < 3000; i++) {
          const a = i
          const b = Math.random()
          const c = 'capture_' + i
          closures.push(() => a + b + c.length)
        }
        // Call a few to prevent engine from optimizing them away
        for (let i = 0; i < 100; i++) {
          closures[i]!()
        }
        closureCountRef.current += closures.length
        closureRef.current = requestAnimationFrame(tick)
      }

      closureRef.current = requestAnimationFrame(tick)
      closureTimerRef.current = setInterval(() => {
        setClosureCount(closureCountRef.current)
        closureCountRef.current = 0
      }, 1000)
    } else {
      if (closureRef.current != null) cancelAnimationFrame(closureRef.current)
      if (closureTimerRef.current != null) clearInterval(closureTimerRef.current)
      closureRef.current = null
      closureTimerRef.current = null
      setClosureCount(0)
    }

    return () => {
      if (closureRef.current != null) cancelAnimationFrame(closureRef.current)
      if (closureTimerRef.current != null) clearInterval(closureTimerRef.current)
    }
  }, [closureActive])

  const triggerGC = useCallback(() => {
    if (typeof global.gc === 'function') {
      global.gc()
    }
  }, [])

  return (
    <ScrollView style={styles.demoContainer}>
      <Text style={styles.sectionTitle}>GC Pressure Tests</Text>
      <Text style={styles.sectionDesc}>
        Stress the Hermes garbage collector with rapid object churn.{'\n'}
        GC pauses appear as periodic FPS dips and stutters.
      </Text>

      {/* Object Churn */}
      <TouchableOpacity
        style={[styles.button, churnActive && styles.buttonDanger]}
        onPress={() => setChurnActive(v => !v)}
      >
        <Text style={styles.buttonText}>
          {churnActive ? 'Stop Object Churn' : 'Start Object Churn'}
        </Text>
      </TouchableOpacity>
      {churnActive && (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>
            Objects/sec: {churnRate.toLocaleString()}
          </Text>
        </View>
      )}

      {/* String Concatenation Storm */}
      <TouchableOpacity
        style={[styles.button, stringActive && styles.buttonDanger]}
        onPress={() => setStringActive(v => !v)}
      >
        <Text style={styles.buttonText}>
          {stringActive ? 'Stop String Storm' : 'Start String Concatenation Storm'}
        </Text>
      </TouchableOpacity>
      {stringActive && (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>
            String length: {stringLength.toLocaleString()} chars
          </Text>
        </View>
      )}

      {/* Closure Factory */}
      <TouchableOpacity
        style={[styles.button, closureActive && styles.buttonDanger]}
        onPress={() => setClosureActive(v => !v)}
      >
        <Text style={styles.buttonText}>
          {closureActive ? 'Stop Closure Factory' : 'Start Closure Factory'}
        </Text>
      </TouchableOpacity>
      {closureActive && (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>
            Closures/sec: {closureCount.toLocaleString()}
          </Text>
        </View>
      )}

      {/* GC Hint */}
      <TouchableOpacity
        style={[styles.button, styles.buttonWarning]}
        onPress={triggerGC}
      >
        <Text style={styles.buttonText}>GC Hint (global.gc)</Text>
      </TouchableOpacity>
      <Text style={styles.gcNote}>
        Only works in debug builds with global.gc exposed. May have no effect.
      </Text>
    </ScrollView>
  )
}

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
  gcNote: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 24,
    lineHeight: 16,
  },
})
