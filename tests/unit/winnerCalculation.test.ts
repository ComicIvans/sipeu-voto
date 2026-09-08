import { describe, expect, it } from 'vitest'
import { calculateWinners } from '../../shared/utils/winnerCalculation'

const sorted = (ids: Set<string>) => [...ids].sort()

describe('calculateWinners (rules used at SIPEU)', () => {
  it('resolution: most voted option wins, abstention never wins', () => {
    const result = calculateWinners(
      [
        { id: 'favor', count: 12, canWin: true },
        { id: 'contra', count: 9, canWin: true },
        { id: 'abst', count: 20, canWin: false },
      ],
      null,
      null
    )
    expect(sorted(result.winnerIds)).toEqual(['favor'])
    expect(result.tiedIds.size).toBe(0)
  })

  it('resolution tie: nobody wins and both options are reported as tied', () => {
    const result = calculateWinners(
      [
        { id: 'favor', count: 10, canWin: true },
        { id: 'contra', count: 10, canWin: true },
        { id: 'abst', count: 3, canWin: false },
      ],
      null,
      null
    )
    expect(result.winnerIds.size).toBe(0)
    expect(sorted(result.tiedIds)).toEqual(['contra', 'favor'])
  })

  it('minimum votes: nobody wins below the threshold', () => {
    const result = calculateWinners(
      [
        { id: 'favor', count: 8, canWin: true },
        { id: 'contra', count: 5, canWin: true },
      ],
      10,
      null
    )
    expect(result.winnerIds.size).toBe(0)
    expect(result.tiedIds.size).toBe(0)
    expect(result.thresholdReachedIds.size).toBe(0)
  })

  it('minimum votes without max winners: every option above threshold wins (not a tie)', () => {
    const result = calculateWinners(
      [
        { id: 'a', count: 12, canWin: true },
        { id: 'b', count: 12, canWin: true },
        { id: 'c', count: 4, canWin: true },
      ],
      10,
      null
    )
    expect(sorted(result.winnerIds)).toEqual(['a', 'b'])
    expect(result.tiedIds.size).toBe(0)
  })

  it('max winners 1 with equal counts: no winner, both tied', () => {
    const result = calculateWinners(
      [
        { id: 'a', count: 7, canWin: true },
        { id: 'b', count: 7, canWin: true },
        { id: 'c', count: 2, canWin: true },
      ],
      null,
      1
    )
    expect(result.winnerIds.size).toBe(0)
    expect(sorted(result.tiedIds)).toEqual(['a', 'b'])
  })

  it('max winners 2 for candidate elections picks the top two', () => {
    const result = calculateWinners(
      [
        { id: 'a', count: 9, canWin: true },
        { id: 'b', count: 7, canWin: true },
        { id: 'c', count: 4, canWin: true },
      ],
      null,
      2
    )
    expect(sorted(result.winnerIds)).toEqual(['a', 'b'])
    expect(result.tiedIds.size).toBe(0)
  })

  it('tie at the cut: 2-1-1 with max 2 gives one winner and two tied', () => {
    const result = calculateWinners(
      [
        { id: 'a', count: 2, canWin: true },
        { id: 'b', count: 1, canWin: true },
        { id: 'c', count: 1, canWin: true },
      ],
      null,
      2
    )
    expect(sorted(result.winnerIds)).toEqual(['a'])
    expect(sorted(result.tiedIds)).toEqual(['b', 'c'])
  })

  it('tie at the cut with a threshold: 9-7-7 with max 2', () => {
    const result = calculateWinners(
      [
        { id: 'a', count: 9, canWin: true },
        { id: 'b', count: 7, canWin: true },
        { id: 'c', count: 7, canWin: true },
      ],
      5,
      2
    )
    expect(sorted(result.winnerIds)).toEqual(['a'])
    expect(sorted(result.tiedIds)).toEqual(['b', 'c'])
    expect(sorted(result.thresholdReachedIds)).toEqual(['a', 'b', 'c'])
  })

  it('tie at the cut below the threshold does not happen: 9-7-7 with minimum 8', () => {
    const result = calculateWinners(
      [
        { id: 'a', count: 9, canWin: true },
        { id: 'b', count: 7, canWin: true },
        { id: 'c', count: 7, canWin: true },
      ],
      8,
      2
    )
    expect(sorted(result.winnerIds)).toEqual(['a'])
    expect(result.tiedIds.size).toBe(0)
  })

  it('exactly as many options as seats: no tie even with equal counts', () => {
    const result = calculateWinners(
      [
        { id: 'a', count: 5, canWin: true },
        { id: 'b', count: 5, canWin: true },
        { id: 'c', count: 1, canWin: true },
      ],
      null,
      2
    )
    expect(sorted(result.winnerIds)).toEqual(['a', 'b'])
    expect(result.tiedIds.size).toBe(0)
  })

  it('fewer voted options than seats: everyone with votes wins', () => {
    const result = calculateWinners(
      [
        { id: 'a', count: 3, canWin: true },
        { id: 'b', count: 0, canWin: true },
      ],
      null,
      2
    )
    expect(sorted(result.winnerIds)).toEqual(['a'])
    expect(result.tiedIds.size).toBe(0)
  })

  it('no votes: no winner and no tie', () => {
    const result = calculateWinners(
      [
        { id: 'a', count: 0, canWin: true },
        { id: 'b', count: 0, canWin: true },
      ],
      null,
      null
    )
    expect(result.winnerIds.size).toBe(0)
    expect(result.tiedIds.size).toBe(0)
  })
})
