import { afterEach, describe, expect, test } from 'vitest'
import { multiSelectStoreForTests } from './multi-select-store'

const { toggleEdge, clear } = multiSelectStoreForTests.getState().actions
const edgeIds = () => multiSelectStoreForTests.getState().edgeIds

afterEach(() => clear())

describe('multi-select-store', () => {
  test('the first toggle also takes the edge open in the count form', () => {
    toggleEdge('b', 'a')
    expect(edgeIds()).toEqual(['a', 'b'])
    toggleEdge('c', 'a')
    expect(edgeIds()).toEqual(['a', 'b', 'c'])
  })

  test('toggling a selected edge removes it', () => {
    toggleEdge('a')
    toggleEdge('b')
    toggleEdge('a')
    expect(edgeIds()).toEqual(['b'])
  })

  test('does not duplicate the seed when it is the clicked edge', () => {
    toggleEdge('a', 'a')
    expect(edgeIds()).toEqual(['a'])
  })

  test('clear empties the selection', () => {
    toggleEdge('a')
    clear()
    expect(edgeIds()).toEqual([])
  })
})
