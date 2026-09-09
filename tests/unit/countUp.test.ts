import { describe, expect, it } from 'vitest'
import { countUpValue, isCountWorthAnimating } from '../../shared/utils/countUp'

describe('countUpValue', () => {
  it('starts where it was and lands exactly on the target', () => {
    expect(countUpValue(10, 40, 0)).toBe(10)
    expect(countUpValue(10, 40, 1)).toBe(40)
  })

  it('never overshoots, however late or early it is asked', () => {
    expect(countUpValue(10, 40, -1)).toBe(10)
    expect(countUpValue(10, 40, 2)).toBe(40)
  })

  it('covers most of the distance in the first half', () => {
    expect(countUpValue(0, 100, 0.5)).toBeGreaterThan(50)
  })

  it('only ever moves towards the target', () => {
    let previous = countUpValue(5, 60, 0)
    for (let step = 1; step <= 20; step++) {
      const value = countUpValue(5, 60, step / 20)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
    expect(previous).toBe(60)
  })

  it('counts down as well', () => {
    expect(countUpValue(60, 5, 0)).toBe(60)
    expect(countUpValue(60, 5, 1)).toBe(5)
    expect(countUpValue(60, 5, 0.5)).toBeLessThan(33)
  })
})

describe('isCountWorthAnimating', () => {
  it('leaves a single ballot to be announced rather than counted', () => {
    expect(isCountWorthAnimating(4, 5)).toBe(false)
    expect(isCountWorthAnimating(5, 4)).toBe(false)
    expect(isCountWorthAnimating(5, 5)).toBe(false)
  })

  it('travels when there is something in between to show', () => {
    expect(isCountWorthAnimating(4, 6)).toBe(true)
    expect(isCountWorthAnimating(20, 3)).toBe(true)
  })
})
