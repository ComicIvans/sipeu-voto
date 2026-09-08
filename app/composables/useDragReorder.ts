import type { Ref } from 'vue'

/**
 * Row reordering by dragging, for tables whose rows this app does not render
 * itself.
 *
 * `UTable` builds its own `<tr>`, so `draggable` goes on the handle inside the
 * first cell instead, and the row under the pointer is resolved from the event:
 * `closest('tr')`, then the `data-row-id` the handle carries. The list is sent
 * whole, never "row X moved to position N", because only the full order says
 * where every other row ended up.
 *
 * The up and down buttons are not a leftover: dragging is unusable with a
 * keyboard, and reordering must not be mouse-only.
 */
export function useDragReorder<T extends { id: string }>(
  items: Ref<T[]> | { value: T[] },
  commit: (ids: string[]) => Promise<unknown>
) {
  const draggingId = ref<string | null>(null)
  const overId = ref<string | null>(null)

  function rowIdFromEvent(event: DragEvent) {
    const row = (event.target as HTMLElement | null)?.closest?.('tr')
    return row?.querySelector<HTMLElement>('[data-row-id]')?.dataset.rowId ?? null
  }

  function reordered(sourceId: string, targetId: string) {
    const current = items.value.map((item) => item.id)
    const from = current.indexOf(sourceId)
    const to = current.indexOf(targetId)
    if (from === -1 || to === -1 || from === to) return null
    const next = [...current]
    next.splice(from, 1)
    next.splice(to, 0, sourceId)
    return next
  }

  function onDragStart(id: string, event: DragEvent) {
    draggingId.value = id
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      // Firefox ignores a drag that carries no data at all.
      event.dataTransfer.setData('text/plain', id)
    }
  }

  function onDragOver(event: DragEvent) {
    if (!draggingId.value) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    overId.value = rowIdFromEvent(event)
  }

  function onDragEnd() {
    draggingId.value = null
    overId.value = null
  }

  async function onDrop(event: DragEvent) {
    event.preventDefault()
    const sourceId = draggingId.value
    const targetId = rowIdFromEvent(event)
    onDragEnd()
    if (!sourceId || !targetId) return
    const next = reordered(sourceId, targetId)
    if (next) await commit(next)
  }

  /** Keyboard and touch fallback: one step at a time. */
  async function move(id: string, delta: number) {
    const current = items.value.map((item) => item.id)
    const from = current.indexOf(id)
    const to = from + delta
    if (from === -1 || to < 0 || to >= current.length) return
    const next = [...current]
    next.splice(from, 1)
    next.splice(to, 0, id)
    await commit(next)
  }

  return { draggingId, overId, onDragStart, onDragOver, onDrop, onDragEnd, move }
}
