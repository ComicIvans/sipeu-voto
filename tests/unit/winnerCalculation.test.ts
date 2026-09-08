import { describe, expect, it } from 'vitest'
import { calculateWinners } from '../../shared/utils/winnerCalculation'
import { isTie } from '../../server/utils/voteResults'

const counts = (entries: Array<[string, number]>) => new Map(entries)

describe('calculateWinners + isTie (rules used at SIPEU)', () => {
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
    expect([...result.winnerIds]).toEqual(['favor'])
  })

  it('resolution tie: both options listed and flagged as tie', () => {
    const result = calculateWinners(
      [
        { id: 'favor', count: 10, canWin: true },
        { id: 'contra', count: 10, canWin: true },
        { id: 'abst', count: 3, canWin: false },
      ],
      null,
      null
    )
    const winnerIds = [...result.winnerIds]
    expect(winnerIds.sort()).toEqual(['contra', 'favor'])
    expect(
      isTie(
        winnerIds,
        counts([
          ['favor', 10],
          ['contra', 10],
        ]),
        null,
        null
      )
    ).toBe(true)
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
    const winnerIds = [...result.winnerIds]
    expect(winnerIds.sort()).toEqual(['a', 'b'])
    expect(
      isTie(
        winnerIds,
        counts([
          ['a', 12],
          ['b', 12],
        ]),
        10,
        null
      )
    ).toBe(false)
  })

  it('max winners 1 with equal counts is a tie', () => {
    const result = calculateWinners(
      [
        { id: 'a', count: 7, canWin: true },
        { id: 'b', count: 7, canWin: true },
        { id: 'c', count: 2, canWin: true },
      ],
      null,
      1
    )
    const winnerIds = [...result.winnerIds]
    expect(winnerIds.length).toBe(2)
    expect(
      isTie(
        winnerIds,
        counts([
          ['a', 7],
          ['b', 7],
        ]),
        null,
        1
      )
    ).toBe(true)
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
    expect([...result.winnerIds].sort()).toEqual(['a', 'b'])
  })

  it('no votes: no winner', () => {
    const result = calculateWinners(
      [
        { id: 'a', count: 0, canWin: true },
        { id: 'b', count: 0, canWin: true },
      ],
      null,
      null
    )
    expect(result.winnerIds.size).toBe(0)
  })
})
