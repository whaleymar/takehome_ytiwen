import { describe, expect, it } from 'vitest'
import { EMPTY_FILTERS, type Filters } from './filters'
import { DEFAULT_SORT, readState, writeState, type AppState } from './urlState'

const EMPTY_STATE: AppState = { filters: EMPTY_FILTERS, sort: DEFAULT_SORT, openId: null, compareIds: [], view: 'list' }
const f = (overrides: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...overrides })

describe('readState', () => {
  it('parses a fully populated query string', () => {
    expect(
      readState('?amount=250000&business=Restaurant%2FFood+Service&years=1.5&tier=good&program=504+Loan&program=SBA+Express&sort=term&open=abc'),
    ).toEqual({
      filters: f({
        amount: 250_000,
        businessType: 'Restaurant/Food Service',
        yearsInBusiness: 1.5,
        creditTier: 'good',
        programTypes: ['504 Loan', 'SBA Express'],
      }),
      sort: 'term',
      openId: 'abc',
      compareIds: [],
      view: 'list',
    })
  })

  it.each(['', '?', '?unrelated=1'])('returns defaults for %j', (search) => {
    expect(readState(search)).toEqual(EMPTY_STATE)
  })

  it('treats empty values as unset', () => {
    expect(readState('?amount=&business=&years=&tier=&score=&program=&sort=&open=&compare=&view=')).toEqual(EMPTY_STATE)
  })

  it('treats whitespace-only values as unset', () => {
    expect(readState('?amount=+&years=%20&score=+&business=+&program=+&open=+')).toEqual(EMPTY_STATE)
  })

  it('treats keys with no value as unset', () => {
    expect(readState('?amount&score&program&tier')).toEqual(EMPTY_STATE)
  })

  it.each([
    ['negative amount', '?amount=-5000'],
    ['zero amount', '?amount=0'],
    ['non-numeric amount', '?amount=lots'],
    ['infinite amount', '?amount=Infinity'],
    ['negative years', '?years=-2'],
    ['NaN years', '?years=NaN'],
    ['implausible years', '?years=500'],
    ['score below range', '?score=299'],
    ['score above range', '?score=851'],
    ['negative score', '?score=-700'],
    ['huge score', '?score=99999999'],
    ['fractional score', '?score=700.5'],
    ['unknown tier', '?tier=platinum'],
    ['tier with wrong case', '?tier=Good'],
    ['unknown sort', '?sort=random'],
  ])('ignores %s', (_, search) => {
    expect(readState(search)).toEqual(EMPTY_STATE)
  })

  it('accepts a huge but well-formed amount', () => {
    expect(readState('?amount=999999999999').filters.amount).toBe(999_999_999_999)
  })

  it('accepts score bounds', () => {
    expect(readState('?score=300').filters.creditScore).toBe(300)
    expect(readState('?score=850').filters.creditScore).toBe(850)
  })

  it('prefers a valid score over tier', () => {
    const s = readState('?tier=good&score=700')
    expect(s.filters.creditScore).toBe(700)
    expect(s.filters.creditTier).toBeNull()
  })

  it('falls back to tier when the score is invalid', () => {
    const s = readState('?tier=good&score=9999')
    expect(s.filters.creditScore).toBeNull()
    expect(s.filters.creditTier).toBe('good')
  })

  it('drops empty and duplicate program types', () => {
    expect(readState('?program=504+Loan&program=&program=504+Loan&program=SBA+Express').filters.programTypes).toEqual([
      '504 Loan',
      'SBA Express',
    ])
  })

  it('uses the first value when a single-value key repeats', () => {
    expect(readState('?amount=100000&amount=200000').filters.amount).toBe(100_000)
  })

  it('works without a leading "?"', () => {
    expect(readState('amount=100000').filters.amount).toBe(100_000)
  })
})

describe('comparison params', () => {
  it('reads compare ids in order', () => {
    expect(readState('?compare=b&compare=a').compareIds).toEqual(['b', 'a'])
  })

  it('drops empty and duplicate ids', () => {
    expect(readState('?compare=a&compare=&compare=+&compare=a&compare=b').compareIds).toEqual(['a', 'b'])
  })

  it('keeps at most 3 ids', () => {
    expect(readState('?compare=a&compare=b&compare=c&compare=d').compareIds).toEqual(['a', 'b', 'c'])
  })

  it('opens the comparison view with 2 or more ids', () => {
    expect(readState('?compare=a&compare=b&view=compare').view).toBe('compare')
  })

  it.each([
    ['one id', '?compare=a&view=compare'],
    ['no ids', '?view=compare'],
    ['unknown view', '?compare=a&compare=b&view=grid'],
    ['no view param', '?compare=a&compare=b'],
  ])('shows the list with %s', (_, search) => {
    expect(readState(search).view).toBe('list')
  })

  it('writes selection without view while on the list', () => {
    expect(writeState({ ...EMPTY_STATE, compareIds: ['a', 'b'] })).toBe('?compare=a&compare=b')
  })
})

describe('writeState', () => {
  it('omits defaults', () => {
    expect(writeState(EMPTY_STATE)).toBe('')
  })

  it('writes score instead of tier when both are set', () => {
    expect(writeState({ ...EMPTY_STATE, filters: f({ creditTier: 'good', creditScore: 700 }) })).toBe('?score=700')
  })

  it('round-trips state', () => {
    const state: AppState = {
      filters: f({
        amount: 250_000,
        businessType: 'Restaurant/Food Service',
        yearsInBusiness: 1.5,
        creditTier: 'good',
        programTypes: ['504 Loan', 'SBA Express'],
      }),
      sort: 'turnaround',
      openId: 'first-national-bank--sba-express',
      compareIds: ['a', 'b', 'c'],
      view: 'compare',
    }
    expect(readState(writeState(state))).toEqual(state)
  })

  it('round-trips values that need escaping', () => {
    const state: AppState = { ...EMPTY_STATE, filters: f({ businessType: 'A&B / C=D', programTypes: ['7(a) Small Loan'] }) }
    expect(readState(writeState(state))).toEqual(state)
  })
})
