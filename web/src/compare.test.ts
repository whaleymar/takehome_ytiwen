import { describe, expect, it } from 'vitest'
import { MAX_COMPARE, bestIndexes, toggleCompareId } from './compare'

const best = (scores: (number[] | null)[], better: 'lower' | 'higher') => [...bestIndexes(scores, better)].sort()

describe('bestIndexes', () => {
  it('picks the lowest when lower is better', () => {
    expect(best([[10], [7], [9]], 'lower')).toEqual([1])
  })

  it('picks the highest when higher is better', () => {
    expect(best([[84], [300], [120]], 'higher')).toEqual([1])
  })

  it('returns every index tied for best', () => {
    expect(best([[5], [5], [9]], 'lower')).toEqual([0, 1])
  })

  it('highlights nothing when all values are equal', () => {
    expect(best([[85], [85], [85]], 'higher')).toEqual([])
  })

  it('breaks ties on later score elements', () => {
    expect(best([[9, 11], [9, 10], [10, 10]], 'lower')).toEqual([1])
  })

  it('only ties when every element matches', () => {
    expect(best([[9, 10], [9, 10], [9, 12]], 'lower')).toEqual([0, 1])
  })

  it('ignores null scores', () => {
    expect(best([null, [0.4], [0.5]], 'higher')).toEqual([2])
  })

  it('highlights nothing when fewer than two values are comparable', () => {
    expect(best([null, [0.4], null], 'higher')).toEqual([])
    expect(best([[1]], 'lower')).toEqual([])
    expect(best([], 'lower')).toEqual([])
  })

  it('highlights nothing when the comparable values are equal and others are null', () => {
    expect(best([[0.5], null, [0.5]], 'higher')).toEqual([])
  })

  it('handles zero and negative values', () => {
    expect(best([[0], [-1], [2]], 'lower')).toEqual([1])
    expect(best([[0], [-1], [2]], 'higher')).toEqual([2])
  })
})

describe('toggleCompareId', () => {
  it('adds an id at the end', () => {
    expect(toggleCompareId(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('removes an id that is already selected', () => {
    expect(toggleCompareId(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it(`refuses to add past ${MAX_COMPARE}`, () => {
    const full = ['a', 'b', 'c']
    expect(toggleCompareId(full, 'd')).toBe(full)
  })

  it('still allows removing when full', () => {
    expect(toggleCompareId(['a', 'b', 'c'], 'a')).toEqual(['b', 'c'])
  })
})
