export interface ComponentRenderStats {
  componentId: string
  renderCount: number
  totalDurationMs: number
  avgDurationMs: number
  maxDurationMs: number
  lastDurationMs: number
  mountCount: number
  updateCount: number
  nestedUpdateCount: number
}

const MAX_ENTRIES = 50

const store = new Map<string, ComponentRenderStats>()

export function recordRender(
  id: string,
  phase: 'mount' | 'update' | 'nested-update',
  durationMs: number
): void {
  const existing = store.get(id)

  if (existing) {
    existing.renderCount++
    existing.totalDurationMs += durationMs
    existing.avgDurationMs = existing.totalDurationMs / existing.renderCount
    existing.maxDurationMs = Math.max(existing.maxDurationMs, durationMs)
    existing.lastDurationMs = durationMs
    if (phase === 'mount') existing.mountCount++
    else if (phase === 'update') existing.updateCount++
    else if (phase === 'nested-update') existing.nestedUpdateCount++
  } else {
    // Evict lowest-renderCount entry if at capacity
    if (store.size >= MAX_ENTRIES) {
      let minKey: string | null = null
      let minCount = Infinity
      for (const [key, stats] of store) {
        if (stats.renderCount < minCount) {
          minCount = stats.renderCount
          minKey = key
        }
      }
      if (minKey) store.delete(minKey)
    }

    store.set(id, {
      componentId: id,
      renderCount: 1,
      totalDurationMs: durationMs,
      avgDurationMs: durationMs,
      maxDurationMs: durationMs,
      lastDurationMs: durationMs,
      mountCount: phase === 'mount' ? 1 : 0,
      updateCount: phase === 'update' ? 1 : 0,
      nestedUpdateCount: phase === 'nested-update' ? 1 : 0,
    })
  }
}

export function getComponentRenderStats(): ComponentRenderStats[] {
  return Array.from(store.values()).sort((a, b) => b.renderCount - a.renderCount)
}

export function resetComponentRenderStats(): void {
  store.clear()
}
