import { useEffect } from 'react'
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge'
import { getPerfMonitor, getArchInfo, getStartupTiming, getComponentRenderStats } from '@nitro-perf-devtools/core'
import type { PerfSnapshot, FPSHistory, ArchInfo, StartupTiming, ComponentRenderStats } from '@nitro-perf-devtools/core'

interface PerfEvents extends Record<string, unknown> {
  'perf-snapshot': PerfSnapshot
  'perf-history': FPSHistory
  'request-snapshot': Record<string, never>
  'request-history': Record<string, never>
  'start-monitor': Record<string, never>
  'stop-monitor': Record<string, never>
  'reset-monitor': Record<string, never>
  'export-session': Record<string, never>
  'clear-data': Record<string, never>
  'session-data': { snapshots: PerfSnapshot[]; history: FPSHistory }
  'request-arch-info': Record<string, never>
  'arch-info': ArchInfo
  'request-startup-timing': Record<string, never>
  'startup-timing': StartupTiming
  'ai-insights-enabled': { enabled: boolean }
  'component-render-stats': ComponentRenderStats[]
}

interface UseNitroPerfDevToolsOptions {
  enableAIInsights?: boolean
}

/**
 * App-side Rozenite hook that bridges Nitro PerfMonitor data
 * to the DevTools panel over CDP.
 *
 * Add this hook in your app's root component:
 * ```tsx
 * import { useNitroPerfDevTools } from '@nitro-perf-devtools';
 *
 * function App() {
 *   useNitroPerfDevTools();
 *   return <YourApp />;
 * }
 * ```
 *
 * To enable AI Insights:
 * ```tsx
 * useNitroPerfDevTools({ enableAIInsights: true });
 * ```
 */
export function useNitroPerfDevTools(options: UseNitroPerfDevToolsOptions = {}) {
  const { enableAIInsights = false } = options
  const client = useRozeniteDevToolsClient<PerfEvents>({
    pluginId: 'nitro-perf',
  })

  useEffect(() => {
    if (!client) return

    // Tell panel whether AI insights is enabled
    client.send('ai-insights-enabled', { enabled: enableAIInsights })

    const monitor = getPerfMonitor()

    // Respond to panel requests
    client.onMessage('start-monitor', () => {
      monitor.start()
    })

    client.onMessage('stop-monitor', () => {
      monitor.stop()
    })

    client.onMessage('reset-monitor', () => {
      monitor.reset()
    })

    client.onMessage('clear-data', () => {
      monitor.reset()
    })

    client.onMessage('request-snapshot', () => {
      client.send('perf-snapshot', monitor.getMetrics())
    })

    client.onMessage('request-history', () => {
      client.send('perf-history', monitor.getHistory())
    })

    client.onMessage('export-session', () => {
      client.send('session-data', {
        snapshots: [monitor.getMetrics()],
        history: monitor.getHistory(),
      })
    })

    client.onMessage('request-arch-info', () => {
      client.send('arch-info', getArchInfo())
    })

    client.onMessage('request-startup-timing', () => {
      client.send('startup-timing', getStartupTiming())
    })

    // Push periodic metric updates to the panel
    const subId = monitor.subscribe((snapshot: PerfSnapshot) => {
      client.send('perf-snapshot', snapshot)
    })

    // Also periodically push history
    const historyInterval = setInterval(() => {
      if (monitor.isRunning) {
        client.send('perf-history', monitor.getHistory())
      }
    }, 3000)

    // Periodically push per-component render stats
    const componentStatsInterval = setInterval(() => {
      if (monitor.isRunning) {
        const stats = getComponentRenderStats()
        if (stats.length > 0) {
          client.send('component-render-stats', stats)
        }
      }
    }, 3000)

    return () => {
      monitor.unsubscribe(subId)
      clearInterval(historyInterval)
      clearInterval(componentStatsInterval)
    }
  }, [client, enableAIInsights])
}
