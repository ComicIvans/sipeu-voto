/**
 * Curated icon sets for committees and parliamentary groups.
 *
 * A closed list rather than free text on purpose. The whole `lucide` collection
 * is bundled on the server with `fallbackToApi: false`, so an unknown name does
 * not error: it renders nothing at all. A list turns a typo into a 400 and keeps
 * the picker to a size somebody can actually look through.
 *
 * Names are stored without the `i-lucide-` prefix; `iconName` puts it back.
 */
export const COMMITTEE_ICONS = [
  'landmark',
  'building-2',
  'scale',
  'gavel',
  'scroll-text',
  'globe',
  'shield',
  'swords',
  'handshake',
  'users',
  'briefcase',
  'banknote',
  'factory',
  'tractor',
  'wheat',
  'leaf',
  'droplets',
  'sun',
  'heart-pulse',
  'graduation-cap',
  'book-open',
  'flask-conical',
  'cpu',
  'radio',
  'megaphone',
  'mic',
  'palette',
  'plane',
  'ship',
  'hammer',
] as const

export const GROUP_ICONS = [
  'flag',
  'star',
  'sparkles',
  'sun',
  'leaf',
  'sprout',
  'tree-pine',
  'wheat',
  'rose',
  'bird',
  'feather',
  'waves',
  'shell',
  'mountain',
  'compass',
  'anchor',
  'gem',
  'crown',
  'shield',
  'hammer',
  'zap',
  'heart',
  'users',
  'circle-dot',
  'triangle',
  'hexagon',
] as const

export type CommitteeIcon = (typeof COMMITTEE_ICONS)[number]
export type GroupIcon = (typeof GROUP_ICONS)[number]

/** Used when nothing is chosen, and for the plenary, which has no row to store one on. */
export const DEFAULT_COMMITTEE_ICON: CommitteeIcon = 'landmark'
export const DEFAULT_GROUP_ICON: GroupIcon = 'flag'
export const PLENARY_ICON = 'star'

export function iconName(name: string | null | undefined, fallback: string) {
  return `i-lucide-${name || fallback}`
}
