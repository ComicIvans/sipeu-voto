export function buildFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim()
}

export function getInitials(source: string): string {
  const trimmed = source.trim()
  if (!trimmed) return '?'

  if (trimmed.includes('@')) {
    const [localPart = ''] = trimmed.split('@')
    return localPart.slice(0, 2).toUpperCase() || '?'
  }

  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length === 1) {
    return words[0]?.slice(0, 2).toUpperCase() || '?'
  }

  const firstInitial = words[0]?.[0] ?? ''
  const secondInitial = words[1]?.[0] ?? ''
  return (firstInitial + secondInitial).toUpperCase() || '?'
}

export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
