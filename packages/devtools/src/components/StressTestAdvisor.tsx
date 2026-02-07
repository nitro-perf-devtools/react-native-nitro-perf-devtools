import React, { useMemo, useState } from 'react'

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

interface StressTestAdvisorProps {
  metrics: PerfSnapshot | null
  memoryTrend: number  // MB/min
  stutterRate: number  // stutters/min
  fpsData: { uiFps: number; jsFps: number }[]
}

type Severity = 'healthy' | 'warning' | 'critical'

interface MetricBadge {
  label: string
  value: string
  color: string
}

interface Recommendation {
  severity: Severity
  icon: string
  title: string
  summary: string
  details: string
  metrics: MetricBadge[]
  actions: string[]
  codeHint?: string
  trend?: 'improving' | 'degrading' | 'stable'
  relatedTest?: string
}

const severityColors: Record<Severity, string> = {
  healthy: '#4CAF50',
  warning: '#FF9800',
  critical: '#F44336',
}

function getRecentSamples(fpsData: { uiFps: number; jsFps: number }[]): { uiFps: number; jsFps: number }[] {
  return fpsData.slice(-10)
}

function avgOf(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stdDevOf(values: number[]): number {
  if (values.length < 2) return 0
  const avg = avgOf(values)
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
  return Math.sqrt(variance)
}

function countBelow(values: number[], threshold: number): number {
  return values.filter((v) => v < threshold).length
}

function fmtMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(0)
}

function getTrend(fpsData: { uiFps: number; jsFps: number }[]): 'improving' | 'degrading' | 'stable' {
  if (fpsData.length < 6) return 'stable'
  const firstHalf = fpsData.slice(-10, -5)
  const secondHalf = fpsData.slice(-5)
  const avgFirst = avgOf(firstHalf.map((d) => d.uiFps + d.jsFps))
  const avgSecond = avgOf(secondHalf.map((d) => d.uiFps + d.jsFps))
  const delta = avgSecond - avgFirst
  if (delta > 5) return 'improving'
  if (delta < -5) return 'degrading'
  return 'stable'
}

const trendIcons: Record<string, string> = {
  improving: '\u2197\uFE0F',
  degrading: '\u2198\uFE0F',
  stable: '\u2194\uFE0F',
}

const trendColors: Record<string, string> = {
  improving: '#4CAF50',
  degrading: '#F44336',
  stable: '#888',
}

export function StressTestAdvisor({ metrics, memoryTrend, stutterRate, fpsData }: StressTestAdvisorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const recommendations = useMemo<Recommendation[]>(() => {
    if (!metrics) return []

    const recent = getRecentSamples(fpsData)
    const recentUiFps = recent.map((d) => d.uiFps)
    const recentJsFps = recent.map((d) => d.jsFps)
    const avgUi = avgOf(recentUiFps)
    const avgJs = avgOf(recentJsFps)
    const uiStdDev = stdDevOf(recentUiFps)
    const jsStdDev = stdDevOf(recentJsFps)
    const uiBelowCount = countBelow(recentUiFps, 45)
    const jsBelowCount = countBelow(recentJsFps, 45)
    const sampleCount = recent.length
    const consistentThreshold = Math.max(1, Math.floor(sampleCount * 0.6))
    const trend = getTrend(fpsData)

    const heapUsed = metrics.jsHeapUsedBytes
    const heapTotal = metrics.jsHeapTotalBytes
    const heapRatio = heapTotal > 0 ? heapUsed / heapTotal : 0
    const ramMB = metrics.ramBytes / (1024 * 1024)

    const elapsedSec = Math.max(1, metrics.timestamp / 1000)
    const dropsPerMin = (metrics.droppedFrames / elapsedSec) * 60

    const result: Recommendation[] = []

    // 1. UI Thread Saturation
    if (uiBelowCount >= consistentThreshold && avgJs > 50) {
      const isCritical = avgUi < 30
      result.push({
        severity: isCritical ? 'critical' : 'warning',
        icon: '\uD83D\uDDA5\uFE0F',
        title: 'UI Thread Saturation',
        summary: `UI thread averaging ${avgUi.toFixed(0)} FPS while JS holds at ${avgJs.toFixed(0)} FPS — native rendering is the bottleneck.`,
        details:
          `The UI thread is responsible for layout, drawing, and running Reanimated worklets. When it drops below 45 FPS while the JS thread remains healthy, the problem is on the native side.\n\n` +
          `Common causes: too many Reanimated useAnimatedStyle worklets with heavy math, deep view hierarchies with shadows/borders, expensive onLayout callbacks, or Image decoding on the main thread.\n\n` +
          `In your current session, ${uiBelowCount}/${sampleCount} recent samples had UI FPS below 45. The UI thread standard deviation is ${uiStdDev.toFixed(1)}, suggesting ${uiStdDev > 10 ? 'bursty load (intermittent heavy frames)' : 'sustained load (consistent overwork)'}.`,
        metrics: [
          { label: 'Avg UI FPS', value: avgUi.toFixed(1), color: avgUi < 30 ? '#F44336' : '#FF9800' },
          { label: 'Avg JS FPS', value: avgJs.toFixed(1), color: '#4CAF50' },
          { label: 'UI stddev', value: uiStdDev.toFixed(1), color: uiStdDev > 10 ? '#FF9800' : '#888' },
          { label: 'Below 45', value: `${uiBelowCount}/${sampleCount}`, color: '#F44336' },
        ],
        actions: [
          'Reduce the number of concurrent Reanimated animated views',
          'Simplify worklet math (fewer sin/cos/matrix ops per frame)',
          'Use removeClippedSubviews on large lists',
          'Replace shadow styles with pre-rendered shadow images',
          'Move image resizing off the main thread (FastImage)',
        ],
        codeHint: `// Before: heavy per-frame computation in worklet\nuseAnimatedStyle(() => {\n  'worklet'\n  let acc = 0\n  for (let i = 0; i < 100; i++) acc += Math.sin(i)\n  return { transform: [{ translateX: acc }] }\n})\n\n// After: simplify or pre-compute\nuseAnimatedStyle(() => {\n  'worklet'\n  return { transform: [{ translateX: progress.value * 200 }] }\n})`,
        trend,
        relatedTest: 'Worklets tab — spawn 50+ animated boxes to reproduce',
      })
    }

    // 2. JS Thread Saturation
    if (jsBelowCount >= consistentThreshold && avgUi > 50) {
      const isCritical = avgJs < 30
      result.push({
        severity: isCritical ? 'critical' : 'warning',
        icon: '\u2699\uFE0F',
        title: 'JS Thread Saturation',
        summary: `JS thread averaging ${avgJs.toFixed(0)} FPS while UI holds at ${avgUi.toFixed(0)} FPS — JavaScript execution is the bottleneck.`,
        details:
          `The JS thread handles React reconciliation, state updates, timers, and all your app logic. When it drops below 45 FPS while the UI thread is fine, the problem is in your JavaScript.\n\n` +
          `Common causes: rapid setState calls (e.g. requestAnimationFrame loops), deep component trees re-rendering, context providers updating many consumers, heavy synchronous computation, or JSON parsing.\n\n` +
          `In your session, ${jsBelowCount}/${sampleCount} recent samples had JS FPS below 45. JS stddev is ${jsStdDev.toFixed(1)} — ${jsStdDev > 10 ? 'suggesting periodic heavy spikes (timers, network callbacks)' : 'suggesting sustained JS load (reconciliation storm)'}.`,
        metrics: [
          { label: 'Avg JS FPS', value: avgJs.toFixed(1), color: avgJs < 30 ? '#F44336' : '#FF9800' },
          { label: 'Avg UI FPS', value: avgUi.toFixed(1), color: '#4CAF50' },
          { label: 'JS stddev', value: jsStdDev.toFixed(1), color: jsStdDev > 10 ? '#FF9800' : '#888' },
          { label: 'Below 45', value: `${jsBelowCount}/${sampleCount}`, color: '#F44336' },
        ],
        actions: [
          'Wrap expensive computations in useMemo with proper deps',
          'Replace Context-based state with zustand/jotai for fine-grained subscriptions',
          'Use React.memo on list item components',
          'Move heavy work to InteractionManager.runAfterInteractions',
          'Batch state updates — avoid multiple setState in loops',
        ],
        codeHint: `// Before: context updates re-render 500 consumers\nsetInterval(() => setCtxValue(Math.random()), 16)\n\n// After: use a selector-based store\nconst value = useStore(state => state.specificSlice)\n// Only components reading 'specificSlice' re-render`,
        trend,
        relatedTest: 'Re-render tab — enable Context Thrash to reproduce',
      })
    }

    // 3. Full Pipeline Stall
    if (uiBelowCount >= consistentThreshold && jsBelowCount >= consistentThreshold) {
      result.push({
        severity: 'critical',
        icon: '\uD83D\uDD25',
        title: 'Full Pipeline Stall',
        summary: `Both threads struggling — UI at ${avgUi.toFixed(0)} FPS, JS at ${avgJs.toFixed(0)} FPS. The entire render pipeline is stalled.`,
        details:
          `When both threads are simultaneously below 45 FPS, the app is unresponsive. Touch events are delayed, animations freeze, and users see visible jank.\n\n` +
          `This usually indicates one thread blocking the other (bridge saturation), or independent heavy work on both threads simultaneously. On the old architecture, excessive bridge traffic serializes work. On the new architecture, too many synchronous JSI calls can still cause contention.\n\n` +
          `Current session: UI avg ${avgUi.toFixed(1)} FPS (${uiBelowCount}/${sampleCount} below 45), JS avg ${avgJs.toFixed(1)} FPS (${jsBelowCount}/${sampleCount} below 45). RAM: ${ramMB.toFixed(0)} MB. Dropped: ${metrics.droppedFrames} frames.`,
        metrics: [
          { label: 'Avg UI FPS', value: avgUi.toFixed(1), color: '#F44336' },
          { label: 'Avg JS FPS', value: avgJs.toFixed(1), color: '#F44336' },
          { label: 'RAM', value: `${ramMB.toFixed(0)} MB`, color: ramMB > 500 ? '#F44336' : '#888' },
          { label: 'Dropped', value: `${metrics.droppedFrames}`, color: '#FF9800' },
        ],
        actions: [
          'Immediately reduce component count and disable animations',
          'Profile with Xcode Instruments or Android systrace',
          'Check for synchronous bridge/JSI call floods',
          'Paginate data — render fewer items at a time',
          'Consider code-splitting with React.lazy for heavy screens',
        ],
        trend,
        relatedTest: 'Run multiple stress tabs, then switch back to observe recovery',
      })
    }

    // 4. GC Thrashing
    if (heapRatio > 0.7 && stutterRate > 3) {
      result.push({
        severity: 'critical',
        icon: '\uD83D\uDDD1\uFE0F',
        title: 'GC Thrashing',
        summary: `Heap at ${(heapRatio * 100).toFixed(0)}% capacity with ${stutterRate.toFixed(1)} stutters/min — garbage collection is interrupting frame delivery.`,
        details:
          `Hermes uses a generational garbage collector. When heap utilization exceeds ~70% and allocation rate is high, the GC runs more frequently, each time pausing JS execution for 1-10ms. At ${stutterRate.toFixed(1)} stutters/min, users feel periodic hitches.\n\n` +
          `Heap: ${fmtMB(heapUsed)} / ${fmtMB(heapTotal)} MB (${(heapRatio * 100).toFixed(0)}%). Memory trend: ${memoryTrend > 0 ? '+' : ''}${memoryTrend.toFixed(1)} MB/min.\n\n` +
          `The fix is to reduce per-frame object allocation. Each requestAnimationFrame callback that creates arrays, objects, closures, or concatenates strings generates garbage that the GC must later collect.`,
        metrics: [
          { label: 'Heap Used', value: `${fmtMB(heapUsed)} MB`, color: '#F44336' },
          { label: 'Heap Total', value: `${fmtMB(heapTotal)} MB`, color: '#888' },
          { label: 'Utilization', value: `${(heapRatio * 100).toFixed(0)}%`, color: '#F44336' },
          { label: 'Stutters/min', value: stutterRate.toFixed(1), color: '#F44336' },
        ],
        actions: [
          'Reuse objects instead of creating new ones each frame',
          'Pre-allocate arrays outside of animation loops',
          'Avoid string concatenation in hot paths — use template literals',
          'Replace closures in loops with bound functions',
          'Call global.gc() in debug builds to test GC impact',
        ],
        codeHint: `// Before: allocates 2000 objects per frame\nconst tick = () => {\n  const data = Array.from({ length: 2000 }, () => ({ x: Math.random() }))\n  requestAnimationFrame(tick)\n}\n\n// After: reuse a pre-allocated pool\nconst pool = new Array(2000).fill(null).map(() => ({ x: 0 }))\nconst tick = () => {\n  for (let i = 0; i < pool.length; i++) pool[i].x = Math.random()\n  requestAnimationFrame(tick)\n}`,
        trend,
        relatedTest: 'GC tab — Start Object Churn to reproduce',
      })
    }

    // 5. Memory Leak
    if (memoryTrend > 2) {
      result.push({
        severity: memoryTrend > 5 ? 'critical' : 'warning',
        icon: '\uD83D\uDCA7',
        title: 'Memory Leak Suspected',
        summary: `RAM growing at ${memoryTrend.toFixed(1)} MB/min. ${memoryTrend > 5 ? 'At this rate the app will be killed by the OS within minutes.' : 'If sustained, this will eventually trigger an OOM crash.'}`,
        details:
          `A consistent upward memory trend indicates retained references that prevent garbage collection. Current RAM: ${ramMB.toFixed(0)} MB, growth: +${memoryTrend.toFixed(1)} MB/min.\n\n` +
          `At this rate, the app will consume an additional ~${(memoryTrend * 10).toFixed(0)} MB in 10 minutes. iOS typically kills apps around 1-1.5 GB depending on the device.\n\n` +
          `Common leak sources: event listeners not cleaned up in useEffect returns, growing arrays/maps stored in refs or module scope, image caches without size limits, and WebSocket/subscription handlers that capture stale closures.`,
        metrics: [
          { label: 'Growth Rate', value: `+${memoryTrend.toFixed(1)} MB/min`, color: memoryTrend > 5 ? '#F44336' : '#FF9800' },
          { label: 'Current RAM', value: `${ramMB.toFixed(0)} MB`, color: ramMB > 500 ? '#F44336' : '#888' },
          { label: 'Projected +10m', value: `${(ramMB + memoryTrend * 10).toFixed(0)} MB`, color: '#FF9800' },
          { label: 'Heap Ratio', value: `${(heapRatio * 100).toFixed(0)}%`, color: heapRatio > 0.7 ? '#FF9800' : '#888' },
        ],
        actions: [
          'Check all useEffect hooks have cleanup functions',
          'Verify subscriptions/listeners are removed on unmount',
          'Cap cache sizes (LRU eviction for image/data caches)',
          'Use WeakRef/WeakMap for object caches',
          'Profile with Hermes heap snapshots to find retainers',
        ],
        codeHint: `// Leak: subscription never cleaned up\nuseEffect(() => {\n  const sub = eventBus.subscribe(handler)\n  // Missing: return () => sub.unsubscribe()\n}, [])\n\n// Fixed:\nuseEffect(() => {\n  const sub = eventBus.subscribe(handler)\n  return () => sub.unsubscribe()\n}, [])`,
        trend: 'degrading',
        relatedTest: 'Memory tab — allocate buffers without releasing',
      })
    }

    // 6. Excessive Frame Drops
    if (dropsPerMin > 10) {
      result.push({
        severity: dropsPerMin > 30 ? 'critical' : 'warning',
        icon: '\uD83D\uDCC9',
        title: 'Excessive Frame Drops',
        summary: `Dropping ~${Math.round(dropsPerMin)} frames/min (${metrics.droppedFrames} total). ${dropsPerMin > 30 ? 'App feels choppy and unresponsive.' : 'Noticeable micro-jank during interactions.'}`,
        details:
          `A dropped frame means the app couldn't produce a new frame within the 16.67ms budget (60 FPS target). ${metrics.droppedFrames} frames dropped over ${(elapsedSec / 60).toFixed(1)} minutes = ~${Math.round(dropsPerMin)} drops/min.\n\n` +
          `Total stutters detected: ${metrics.stutterCount} (a stutter = 4+ drops in a 1-second window). Stutter rate: ${stutterRate.toFixed(1)}/min.\n\n` +
          `Frame drops under 10/min are generally imperceptible. 10-30/min causes noticeable jank during scrolling. Over 30/min makes the app feel broken.`,
        metrics: [
          { label: 'Drops/min', value: `${Math.round(dropsPerMin)}`, color: dropsPerMin > 30 ? '#F44336' : '#FF9800' },
          { label: 'Total Dropped', value: `${metrics.droppedFrames}`, color: '#FF9800' },
          { label: 'Stutters', value: `${metrics.stutterCount}`, color: metrics.stutterCount > 0 ? '#F44336' : '#4CAF50' },
          { label: 'Session', value: `${(elapsedSec / 60).toFixed(1)} min`, color: '#888' },
        ],
        actions: [
          'Check the FPS Analysis tab for frame time heatmap patterns',
          'Look for periodic spikes (timer/interval causing consistent drops)',
          'Enable useNativeDriver: true for all Animated animations',
          'Use Flashlight or Flipper to identify slow renders',
          'Check the Stutters tab for event correlation',
        ],
        trend,
        relatedTest: 'JS Jank tab — enable Continuous Jank to reproduce',
      })
    }

    // 7. Heap Near Capacity
    if (heapRatio > 0.85 && stutterRate <= 3) {
      result.push({
        severity: 'warning',
        icon: '\uD83E\uDDE0',
        title: 'Heap Near Capacity',
        summary: `JS heap at ${(heapRatio * 100).toFixed(0)}% (${fmtMB(heapUsed)}/${fmtMB(heapTotal)} MB). GC pressure will increase soon.`,
        details:
          `The Hermes JS engine has allocated ${fmtMB(heapTotal)} MB for the JS heap and ${fmtMB(heapUsed)} MB is currently in use (${(heapRatio * 100).toFixed(0)}%). While stutters are still manageable at ${stutterRate.toFixed(1)}/min, the GC will become increasingly aggressive as utilization climbs.\n\n` +
          `Hermes may also request more heap from the OS, increasing the app's total memory footprint. On constrained devices this can trigger low-memory warnings or OOM kills.`,
        metrics: [
          { label: 'Heap Used', value: `${fmtMB(heapUsed)} MB`, color: '#FF9800' },
          { label: 'Heap Total', value: `${fmtMB(heapTotal)} MB`, color: '#888' },
          { label: 'Utilization', value: `${(heapRatio * 100).toFixed(0)}%`, color: '#FF9800' },
          { label: 'Stutter Rate', value: `${stutterRate.toFixed(1)}/min`, color: stutterRate > 1 ? '#FF9800' : '#4CAF50' },
        ],
        actions: [
          'Release unused data structures and clear caches',
          'Paginate large datasets instead of holding all in memory',
          'Use FlatList instead of map() for long lists',
          'Avoid storing large base64 strings in state',
        ],
        trend,
      })
    }

    // 8. FPS Instability
    if (recentUiFps.length >= 5 && (uiStdDev > 12 || jsStdDev > 12)) {
      const worstThread = uiStdDev > jsStdDev ? 'UI' : 'JS'
      const worstStdDev = Math.max(uiStdDev, jsStdDev)
      result.push({
        severity: 'warning',
        icon: '\uD83C\uDF0A',
        title: 'FPS Instability',
        summary: `${worstThread} FPS has high variance (stddev ${worstStdDev.toFixed(1)}). Frame rate swings between smooth and janky.`,
        details:
          `UI FPS stddev: ${uiStdDev.toFixed(1)}, JS FPS stddev: ${jsStdDev.toFixed(1)}. A stddev above 12 means the frame rate regularly swings by more than 24 FPS between samples.\n\n` +
          `This pattern indicates intermittent heavy work rather than sustained load. Common causes: periodic timers firing heavy callbacks, network response processing, lazy module loading, navigation transitions, or image decode operations that spike one frame then settle.`,
        metrics: [
          { label: 'UI stddev', value: uiStdDev.toFixed(1), color: uiStdDev > 12 ? '#FF9800' : '#4CAF50' },
          { label: 'JS stddev', value: jsStdDev.toFixed(1), color: jsStdDev > 12 ? '#FF9800' : '#4CAF50' },
          { label: 'UI range', value: `${Math.min(...recentUiFps).toFixed(0)}-${Math.max(...recentUiFps).toFixed(0)}`, color: '#888' },
          { label: 'JS range', value: `${Math.min(...recentJsFps).toFixed(0)}-${Math.max(...recentJsFps).toFixed(0)}`, color: '#888' },
        ],
        actions: [
          'Check for setInterval callbacks doing heavy work',
          'Debounce/throttle expensive operations',
          'Use requestIdleCallback or InteractionManager for non-urgent work',
          'Pre-load screens and images before navigation',
        ],
        trend,
      })
    }

    // 9. High RAM but stable FPS
    if (ramMB > 400 && avgUi > 50 && avgJs > 50) {
      result.push({
        severity: 'warning',
        icon: '\uD83D\uDCE6',
        title: 'High Memory Footprint',
        summary: `RAM at ${ramMB.toFixed(0)} MB but FPS is stable. The app works now but is vulnerable to OOM on lower-end devices.`,
        details:
          `The app is using ${ramMB.toFixed(0)} MB of RAM. While performance is currently smooth (UI: ${avgUi.toFixed(0)}, JS: ${avgJs.toFixed(0)}), high memory usage means:\n\n` +
          `- The OS may kill background apps to reclaim memory\n` +
          `- On devices with 2-3 GB RAM, your app may be the one killed\n` +
          `- Image/data caches may be oversized\n` +
          `- Large JS bundles or inline assets may be inflating the footprint`,
        metrics: [
          { label: 'RAM', value: `${ramMB.toFixed(0)} MB`, color: ramMB > 600 ? '#F44336' : '#FF9800' },
          { label: 'Heap', value: `${fmtMB(heapUsed)}/${fmtMB(heapTotal)} MB`, color: '#888' },
          { label: 'Non-heap', value: `${(ramMB - heapTotal / (1024 * 1024)).toFixed(0)} MB`, color: '#888' },
        ],
        actions: [
          'Audit image sizes — downscale before display',
          'Use react-native-fast-image with cache limits',
          'Release ArrayBuffers and Blobs when no longer needed',
          'Profile native memory with Xcode Instruments / Android Profiler',
        ],
        trend,
      })
    }

    // 10. Smooth Performance
    if (avgUi > 55 && avgJs > 55 && memoryTrend < 0.5 && stutterRate < 1 && result.length === 0) {
      result.push({
        severity: 'healthy',
        icon: '\u2705',
        title: 'Smooth Performance',
        summary: `UI ${avgUi.toFixed(0)} FPS, JS ${avgJs.toFixed(0)} FPS, memory stable, ${stutterRate < 0.1 ? 'no stutters' : `${stutterRate.toFixed(1)} stutters/min`}.`,
        details:
          `Both threads are maintaining >55 FPS, memory growth is under 0.5 MB/min, and stutter rate is low. This indicates the app is well within its performance budget.\n\n` +
          `To stress test further, try enabling multiple stress tests simultaneously or increasing the load (e.g., +100 boxes in the Worklets tab, or enabling all three GC pressure generators at once).`,
        metrics: [
          { label: 'UI FPS', value: avgUi.toFixed(1), color: '#4CAF50' },
          { label: 'JS FPS', value: avgJs.toFixed(1), color: '#4CAF50' },
          { label: 'Mem Trend', value: `${memoryTrend >= 0 ? '+' : ''}${memoryTrend.toFixed(1)} MB/min`, color: '#4CAF50' },
          { label: 'Stutters', value: `${stutterRate.toFixed(1)}/min`, color: '#4CAF50' },
        ],
        actions: [],
        trend: 'stable',
      })
    }

    // Fallback
    if (result.length === 0) {
      result.push({
        severity: 'healthy',
        icon: '\uD83D\uDD0D',
        title: 'Monitoring Active',
        summary: `Collecting data... UI ${avgUi.toFixed(0)} FPS, JS ${avgJs.toFixed(0)} FPS, RAM ${ramMB.toFixed(0)} MB.`,
        details: 'No significant patterns detected yet. Run a stress test for a few seconds to see detailed analysis.',
        metrics: [
          { label: 'UI FPS', value: avgUi.toFixed(1), color: '#888' },
          { label: 'JS FPS', value: avgJs.toFixed(1), color: '#888' },
          { label: 'RAM', value: `${ramMB.toFixed(0)} MB`, color: '#888' },
        ],
        actions: [],
        trend: 'stable',
      })
    }

    return result
  }, [metrics, memoryTrend, stutterRate, fpsData])

  return (
    <div style={{ background: '#1e1e1e', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Stress Test Advisor
      </div>

      {!metrics ? (
        <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 20 }}>
          Start monitoring to see recommendations
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recommendations.map((rec, i) => {
            const isExpanded = expandedIndex === i
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  background: `${severityColors[rec.severity]}08`,
                  border: `1px solid ${severityColors[rec.severity]}30`,
                  borderRadius: 6,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
              >
                {/* Left color bar */}
                <div style={{ width: 4, flexShrink: 0, background: severityColors[rec.severity] }} />

                {/* Card content */}
                <div style={{ padding: '10px 14px', flex: 1, minWidth: 0 }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{rec.icon}</span>
                      <span style={{ color: severityColors[rec.severity], fontSize: 13, fontWeight: 600 }}>
                        {rec.title}
                      </span>
                      {rec.trend && (
                        <span style={{ color: trendColors[rec.trend], fontSize: 11 }} title={`Trend: ${rec.trend}`}>
                          {trendIcons[rec.trend]}
                        </span>
                      )}
                    </div>
                    <span style={{ color: '#555', fontSize: 11, flexShrink: 0 }}>
                      {isExpanded ? '\u25B2' : '\u25BC'}
                    </span>
                  </div>

                  {/* Summary */}
                  <div style={{ color: '#aaa', fontSize: 12, lineHeight: 1.5 }}>
                    {rec.summary}
                  </div>

                  {/* Metric badges (always visible) */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {rec.metrics.map((m, j) => (
                      <span
                        key={j}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: '#2a2a2a',
                          borderRadius: 4,
                          padding: '2px 8px',
                          fontSize: 11,
                        }}
                      >
                        <span style={{ color: '#888' }}>{m.label}:</span>
                        <span style={{ color: m.color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{m.value}</span>
                      </span>
                    ))}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{ marginTop: 12 }}>
                      {/* Detailed explanation */}
                      <div style={{ color: '#bbb', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: 12 }}>
                        {rec.details}
                      </div>

                      {/* Action items */}
                      {rec.actions.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                            Recommended Actions
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 20, color: '#aaa', fontSize: 12, lineHeight: 1.8 }}>
                            {rec.actions.map((action, k) => (
                              <li key={k}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Code hint */}
                      {rec.codeHint && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                            Code Example
                          </div>
                          <pre style={{
                            background: '#0d0d0d',
                            border: '1px solid #333',
                            borderRadius: 6,
                            padding: 12,
                            margin: 0,
                            color: '#ccc',
                            fontSize: 11,
                            lineHeight: 1.5,
                            overflow: 'auto',
                            whiteSpace: 'pre',
                          }}>
                            {rec.codeHint}
                          </pre>
                        </div>
                      )}

                      {/* Related stress test */}
                      {rec.relatedTest && (
                        <div style={{
                          background: '#1a1a2e',
                          border: '1px solid #2a2a4a',
                          borderRadius: 4,
                          padding: '6px 10px',
                          fontSize: 11,
                          color: '#8888cc',
                        }}>
                          <span style={{ fontWeight: 600 }}>Reproduce: </span>{rec.relatedTest}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
