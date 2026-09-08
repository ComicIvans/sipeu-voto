/**
 * Reordering by dragging, shared by the admin tables and the vote option list.
 *
 * Rows are found through the DOM rather than through the list, because `UTable`
 * builds its own `<tr>` and this app never gets to put attributes on it. Every
 * reorderable row carries `data-row-id` somewhere inside it, and the row box is
 * whichever of `<tr>` or `[data-reorder-row]` contains it.
 *
 * While a drag is in flight nothing moves: the row being dragged stays exactly
 * where it is, only dimmed, and the target row gets a line along the edge the
 * row would land on. Reordering the list under the pointer would shift every
 * row and make the drop a guess.
 */
export function useDragReorder(keys: () => string[], commit: (ids: string[]) => Promise<unknown>) {
  const draggingId = ref<string | null>(null)
  let highlighted: HTMLElement | null = null

  function rowBox(el: HTMLElement | null) {
    if (!el) return null
    const marked = el.closest<HTMLElement>('[data-row-id]')
    const inRow = el.closest('tr')?.querySelector<HTMLElement>('[data-row-id]') ?? null
    const anchor = marked ?? inRow
    if (!anchor) return null
    const box = anchor.closest<HTMLElement>('tr, [data-reorder-row]') ?? anchor
    return { id: anchor.dataset.rowId ?? null, box }
  }

  function clearHighlight() {
    highlighted?.classList.remove('drop-before', 'drop-after')
    highlighted = null
  }

  function highlight(box: HTMLElement, after: boolean) {
    if (highlighted && highlighted !== box) clearHighlight()
    highlighted = box
    box.classList.toggle('drop-before', !after)
    box.classList.toggle('drop-after', after)
  }

  function reordered(sourceId: string, targetId: string) {
    const current = keys()
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
    const source = draggingId.value
    if (!source) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'

    const target = rowBox(event.target as HTMLElement | null)
    if (!target?.id || target.id === source) {
      clearHighlight()
      return
    }
    const current = keys()
    highlight(target.box, current.indexOf(target.id) > current.indexOf(source))
  }

  function onDragEnd() {
    draggingId.value = null
    clearHighlight()
  }

  async function onDrop(event: DragEvent) {
    event.preventDefault()
    const sourceId = draggingId.value
    const targetId = rowBox(event.target as HTMLElement | null)?.id ?? null
    onDragEnd()
    if (!sourceId || !targetId) return
    const next = reordered(sourceId, targetId)
    if (next) await commit(next)
  }

  /** Keyboard and touch path. Dragging is unusable without a pointer. */
  async function move(id: string, delta: number) {
    const current = keys()
    const from = current.indexOf(id)
    const to = from + delta
    if (from === -1 || to < 0 || to >= current.length) return
    const next = [...current]
    next.splice(from, 1)
    next.splice(to, 0, id)
    await commit(next)
  }

  function isFirst(id: string) {
    return keys()[0] === id
  }

  function isLast(id: string) {
    return keys().at(-1) === id
  }

  onBeforeUnmount(clearHighlight)

  return { draggingId, onDragStart, onDragOver, onDrop, onDragEnd, move, isFirst, isLast }
}
