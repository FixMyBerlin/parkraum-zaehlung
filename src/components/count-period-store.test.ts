import { afterEach, describe, expect, test } from 'vitest'
import { countPeriodStoreForTests } from './count-period-store'

const initialState = countPeriodStoreForTests.getState()

afterEach(() => {
  countPeriodStoreForTests.setState(initialState, true)
})

describe('count period store', () => {
  test('defaults to sunday', () => {
    expect(countPeriodStoreForTests.getState().activePeriod).toBe('sunday')
  })

  test('setActivePeriod switches the active period', () => {
    countPeriodStoreForTests.getState().actions.setActivePeriod('midday')
    expect(countPeriodStoreForTests.getState().activePeriod).toBe('midday')

    countPeriodStoreForTests.getState().actions.setActivePeriod('evening')
    expect(countPeriodStoreForTests.getState().activePeriod).toBe('evening')
  })

  test('the period is plain module state, so nothing about an edge or a form resets it', () => {
    countPeriodStoreForTests.getState().actions.setActivePeriod('evening')
    // Simulate everything that happens when the user picks a different edge or the
    // form remounts by key: none of that touches this store, so the period stands.
    expect(countPeriodStoreForTests.getState().activePeriod).toBe('evening')
  })
})
