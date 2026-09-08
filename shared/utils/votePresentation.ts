import { DEFAULT_OPTION_COLORS } from '~~/shared/constants/voteOptions'

export function getDefaultOptionColor(index: number) {
  return DEFAULT_OPTION_COLORS[index % DEFAULT_OPTION_COLORS.length] ?? DEFAULT_OPTION_COLORS[0]
}

export function getOptionDisplayColor(color: string | null | undefined, index: number) {
  return color ?? getDefaultOptionColor(index)
}

export function getContrastTextColor(color: string) {
  const normalized = color.replace('#', '')
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((chunk) => `${chunk}${chunk}`)
          .join('')
      : normalized

  const red = parseInt(expanded.slice(0, 2), 16)
  const green = parseInt(expanded.slice(2, 4), 16)
  const blue = parseInt(expanded.slice(4, 6), 16)
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114

  return luminance > 186 ? '#111827' : '#ffffff'
}

export function roundPercentages(counts: number[]) {
  const total = counts.reduce((sum, value) => sum + value, 0)
  if (total === 0) return counts.map(() => 0)

  const exact = counts.map((value) => (value / total) * 100)
  const floored = exact.map(Math.floor)
  const remainders = exact.map((value, index) => ({ index, r: value - (floored[index] ?? 0) }))
  const diff = 100 - floored.reduce((sum, value) => sum + value, 0)

  const result = [...floored]
  remainders
    .sort((a, b) => b.r - a.r)
    .slice(0, diff)
    .forEach(({ index }) => {
      result[index] = (result[index] ?? 0) + 1
    })

  return result
}
