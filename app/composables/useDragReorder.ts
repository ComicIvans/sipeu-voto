/**
 * Builds what the pointer carries: a picture of the whole row, taken at the
 * moment the drag starts.
 *
 * The browser's default drag image is whatever carries `draggable`, which here
 * is a grip icon the size of a thumbnail. A copy is used rather than the row
 * itself so the real row can stay exactly where it is: lifting it out would
 * close the gap it leaves and shift the list the instant you grab it, which is
 * the one thing that must not happen.
 *
 * A `<tr>` only lays out inside a table, so it is cloned into one that repeats
 * the column widths. The copy lives off-screen for a single frame, which is all
 * the browser needs to rasterise it.
 */
export function setRowDragImage(event: DragEvent, row: HTMLElement | null | undefined) {
  if (!row || !event.dataTransfer) return
  const rect = row.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  // A tab that is not visible can have `requestAnimationFrame` paused outright,
  // so a copy from an earlier drag may still be here. Sweeping first keeps that
  // to one stray node instead of one per drag.
  document.querySelectorAll('[data-drag-ghost]').forEach((node) => node.remove())

  const holder = document.createElement('div')
  holder.dataset.dragGhost = ''
  holder.style.cssText = [
    'position:fixed',
    'top:0',
    'left:-10000px',
    `width:${rect.width}px`,
    'pointer-events:none',
    'overflow:hidden',
    'border-radius:var(--ui-radius)',
    'border:1px solid var(--ui-border-accented)',
    'background:var(--ui-bg)',
    'box-shadow:0 10px 24px rgb(0 0 0 / 0.28)',
    'opacity:0.95',
  ].join(';')

  if (row.tagName === 'TR') {
    const table = document.createElement('table')
    table.style.cssText = `width:${rect.width}px;table-layout:fixed;border-collapse:collapse`
    const body = document.createElement('tbody')
    const clone = row.cloneNode(true) as HTMLElement
    // Without the original widths every column collapses to its content.
    Array.from(row.children).forEach((cell, index) => {
      const copy = clone.children[index] as HTMLElement | undefined
      if (copy) copy.style.width = `${(cell as HTMLElement).getBoundingClientRect().width}px`
    })
    body.appendChild(clone)
    table.appendChild(body)
    holder.appendChild(table)
  } else {
    const clone = row.cloneNode(true) as HTMLElement
    clone.style.width = `${rect.width}px`
    clone.style.margin = '0'
    holder.appendChild(clone)
  }

  document.body.appendChild(holder)
  // Offsets keep the copy under the pointer where it was picked up, instead of
  // snapping a corner to the cursor.
  event.dataTransfer.setDragImage(holder, event.clientX - rect.left, event.clientY - rect.top)
  // The browser only needs the node for this event. Both timers are scheduled
  // because a hidden tab throttles one and pauses the other.
  requestAnimationFrame(() => holder.remove())
  setTimeout(() => holder.remove(), 0)
}

/**
 * Reordering by dragging, shared by the admin tables and the vote option list.
 *
 * Rows are found through the DOM rather than through the list, because `UTable`
 * builds its own `<tr>` and this app never gets to put attributes on it. Every
 * reorderable row carries `data-row-id` somewhere inside it, and the row box is
 * whichever of `<tr>` or `[data-reorder-row]` contains it.
 *
 * While a drag is in flight nothing moves: the row being dragged stays exactly
 * where it is, dimmed, while a copy of it rides under the pointer, and the
 * target row gets a line along the edge the row would land on. Reordering the
 * list under the pointer would shift every row and make the drop a guess.
 */
export function useDragReorder(keys: () => string[], commit: (ids: string[]) => Promise<unknown>) {
  const draggingId = ref<string | null>(null)
  let highlighted: HTMLElement | null = null
  let lifted: HTMLElement | null = null

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
    const source = rowBox(event.target as HTMLElement | null)?.box ?? null
    setRowDragImage(event, source)
    lifted = source
    lifted?.classList.add('dragging-row')
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
    lifted?.classList.remove('dragging-row')
    lifted = null
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

  onBeforeUnmount(onDragEnd)

  return { draggingId, onDragStart, onDragOver, onDrop, onDragEnd, move, isFirst, isLast }
}
