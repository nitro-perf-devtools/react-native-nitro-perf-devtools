import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated'

// ─── Animated Box ────────────────────────────────────────────────────

function AnimatedBox({ index }: { index: number }) {
  const progress = useSharedValue(0)
  const phase = index * 0.7

  React.useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    )
    return () => {
      cancelAnimation(progress)
    }
  }, [progress])

  const animatedStyle = useAnimatedStyle(() => {
    'worklet'
    const p = progress.value
    // Heavy math per frame to saturate the UI thread
    const sin1 = Math.sin(p * Math.PI * 2 + phase)
    const sin2 = Math.sin(p * Math.PI * 3 + phase * 1.5)
    const sin3 = Math.sin(p * Math.PI * 4 + phase * 0.8)
    const cos1 = Math.cos(p * Math.PI * 2.5 + phase)
    const cos2 = Math.cos(p * Math.PI * 1.5 + phase * 2)

    // Extra computation loops to really stress the UI thread
    let accum = 0
    for (let i = 0; i < 50; i++) {
      accum += Math.sin(p * i + phase) * Math.cos(p * (i + 1) + phase)
    }

    const translateX = sin1 * 120 + sin2 * 30 + accum * 0.1
    const translateY = cos1 * 20 + cos2 * 10
    const rotate = sin3 * 180
    const scale = 0.6 + Math.abs(sin1) * 0.6
    const opacity = 0.4 + Math.abs(cos1) * 0.6

    return {
      transform: [
        { translateX },
        { translateY },
        { rotate: `${rotate}deg` },
        { scale },
      ],
      opacity,
    }
  })

  const hue = (index * 37) % 360

  return (
    <Animated.View
      style={[
        boxStyles.box,
        { backgroundColor: `hsl(${hue}, 70%, 50%)` },
        animatedStyle,
      ]}
    />
  )
}

const boxStyles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
    borderRadius: 4,
    position: 'absolute',
    left: 16,
    top: 0,
  },
})

// ─── Spring Box (for cascade) ────────────────────────────────────────

function SpringBox({ index, trigger }: { index: number; trigger: number }) {
  const offsetX = useSharedValue(0)
  const offsetY = useSharedValue(0)
  const rotation = useSharedValue(0)
  const boxScale = useSharedValue(1)

  React.useEffect(() => {
    if (trigger === 0) return
    // Each box springs to a random target, creating a cascade
    const targetX = (Math.sin(index * 2.1 + trigger) * 150)
    const targetY = (Math.cos(index * 1.7 + trigger) * 40)
    const targetRot = Math.sin(index + trigger) * 360

    offsetX.value = withSpring(targetX, { damping: 4, stiffness: 80 })
    offsetY.value = withSpring(targetY, { damping: 5, stiffness: 90 })
    rotation.value = withSpring(targetRot, { damping: 3, stiffness: 60 })
    boxScale.value = withSequence(
      withSpring(1.5, { damping: 3, stiffness: 200 }),
      withSpring(1, { damping: 6, stiffness: 100 })
    )
  }, [trigger, index, offsetX, offsetY, rotation, boxScale])

  const animatedStyle = useAnimatedStyle(() => {
    'worklet'
    // Extra computation per frame
    let accum = 0
    for (let i = 0; i < 30; i++) {
      accum += Math.sin(offsetX.value * 0.01 * i) * Math.cos(offsetY.value * 0.01 * i)
    }

    return {
      transform: [
        { translateX: offsetX.value + accum * 0.05 },
        { translateY: offsetY.value },
        { rotate: `${rotation.value}deg` },
        { scale: boxScale.value },
      ],
    }
  })

  const hue = (index * 47 + 120) % 360

  return (
    <Animated.View
      style={[
        boxStyles.box,
        { backgroundColor: `hsl(${hue}, 65%, 55%)` },
        animatedStyle,
      ]}
    />
  )
}

// ─── Worklet Demo ────────────────────────────────────────────────────

export function WorkletDemo() {
  const [boxes, setBoxes] = useState<number[]>([])
  const [springTrigger, setSpringTrigger] = useState(0)

  const addBoxes = useCallback((count: number) => {
    setBoxes(prev => {
      const start = prev.length
      return [...prev, ...Array.from({ length: count }, (_, i) => start + i)]
    })
  }, [])

  const stopAll = useCallback(() => {
    setBoxes([])
    setSpringTrigger(0)
  }, [])

  const triggerCascade = useCallback(() => {
    setSpringTrigger(prev => prev + 1)
  }, [])

  return (
    <ScrollView style={styles.demoContainer}>
      <Text style={styles.sectionTitle}>UI Thread Stress (Worklets)</Text>
      <Text style={styles.sectionDesc}>
        Reanimated worklets run heavy math on the UI thread.{'\n'}
        UI FPS should drop while JS FPS stays at 60.{'\n'}
        Active boxes: {boxes.length}
      </Text>

      <Text style={[styles.sectionTitle, { fontSize: 15, marginTop: 8 }]}>
        Animated Boxes
      </Text>
      <Text style={styles.sectionDesc}>
        Each box runs sine waves, rotation, scale, and opacity on the UI thread worklet.
      </Text>

      <TouchableOpacity style={styles.button} onPress={() => addBoxes(10)}>
        <Text style={styles.buttonText}>+10 Boxes</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => addBoxes(25)}>
        <Text style={styles.buttonText}>+25 Boxes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonWarning]}
        onPress={() => addBoxes(50)}
      >
        <Text style={styles.buttonText}>+50 Boxes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonDanger]}
        onPress={() => addBoxes(100)}
      >
        <Text style={styles.buttonText}>+100 Boxes</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { fontSize: 15, marginTop: 20 }]}>
        Spring Cascade
      </Text>
      <Text style={styles.sectionDesc}>
        Triggers withSpring on all active boxes simultaneously.
      </Text>

      <TouchableOpacity
        style={[styles.button, styles.buttonWarning]}
        onPress={triggerCascade}
        disabled={boxes.length === 0}
      >
        <Text style={styles.buttonText}>
          Trigger Spring Cascade ({boxes.length} boxes)
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonDanger]}
        onPress={stopAll}
      >
        <Text style={styles.buttonText}>Stop All</Text>
      </TouchableOpacity>

      <View style={animContainerStyles.container}>
        {boxes.map(i => (
          <React.Fragment key={i}>
            <AnimatedBox index={i} />
            {springTrigger > 0 && <SpringBox index={i} trigger={springTrigger} />}
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  )
}

const animContainerStyles = StyleSheet.create({
  container: {
    height: 200,
    marginTop: 16,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
})

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
})
