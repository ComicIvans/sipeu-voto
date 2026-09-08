import { describe, expect, it } from 'vitest'
import {
  getDueVoteAction,
  scheduleAfterClose,
  scheduleAfterOpen,
} from '../../shared/utils/voteSchedule'

const NOW = new Date('2026-09-08T12:00:00.000Z')
const BEFORE = new Date('2026-09-08T11:00:00.000Z')
const AFTER = new Date('2026-09-08T13:00:00.000Z')

const pending = { open: false, startedAt: null, endedAt: null }
const running = { open: true, startedAt: BEFORE, endedAt: null }
const finished = { open: false, startedAt: BEFORE, endedAt: NOW }

describe('getDueVoteAction', () => {
  it('does nothing without a schedule', () => {
    expect(getDueVoteAction({ ...pending, opensAt: null, closesAt: null }, NOW)).toBeNull()
    expect(getDueVoteAction({ ...running, opensAt: null, closesAt: null }, NOW)).toBeNull()
  })

  it('waits until the opening time arrives', () => {
    expect(getDueVoteAction({ ...pending, opensAt: AFTER, closesAt: null }, NOW)).toBeNull()
    expect(getDueVoteAction({ ...pending, opensAt: NOW, closesAt: null }, NOW)).toBe('open')
    expect(getDueVoteAction({ ...pending, opensAt: BEFORE, closesAt: null }, NOW)).toBe('open')
  })

  it('closes an open vote once its closing time arrives', () => {
    expect(getDueVoteAction({ ...running, opensAt: null, closesAt: AFTER }, NOW)).toBeNull()
    expect(getDueVoteAction({ ...running, opensAt: null, closesAt: NOW }, NOW)).toBe('close')
  })

  it('expires a window that went by entirely, instead of opening a vote past its own deadline', () => {
    expect(getDueVoteAction({ ...pending, opensAt: BEFORE, closesAt: BEFORE }, NOW)).toBe('expire')
  })

  it('never reopens a vote that already ran', () => {
    expect(getDueVoteAction({ ...finished, opensAt: BEFORE, closesAt: null }, NOW)).toBeNull()
  })

  it('ignores an opening time on a vote that is already open', () => {
    expect(getDueVoteAction({ ...running, opensAt: BEFORE, closesAt: null }, NOW)).toBeNull()
  })

  it('reads ISO strings the same as dates', () => {
    const asText = { ...pending, opensAt: BEFORE.toISOString(), closesAt: null }
    expect(getDueVoteAction(asText, NOW)).toBe('open')
  })
})

describe('scheduleAfterOpen', () => {
  it('spends the opening time', () => {
    expect(scheduleAfterOpen({ closesAt: null }, NOW).opensAt).toBeNull()
  })

  it('keeps a closing time that is still ahead', () => {
    expect(scheduleAfterOpen({ closesAt: AFTER }, NOW).closesAt).toEqual(AFTER)
  })

  it('drops a closing time that has passed, so opening by hand is not undone', () => {
    expect(scheduleAfterOpen({ closesAt: BEFORE }, NOW).closesAt).toBeNull()
    expect(scheduleAfterOpen({ closesAt: NOW }, NOW).closesAt).toBeNull()
  })
})

describe('scheduleAfterClose', () => {
  it('leaves nothing behind that could fire again', () => {
    expect(scheduleAfterClose()).toEqual({ opensAt: null, closesAt: null })
  })
})
