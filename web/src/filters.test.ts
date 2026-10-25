import { describe, expect, it } from 'vitest'
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  isEligible,
  parseAmount,
  parseScore,
  parseYears,
  sortPrograms,
  type Filters,
} from './filters'
import type { Program } from './types'

function program(overrides: Partial<Program> = {}): Program {
  return {
    id: 'lender--7a',
    lender: 'Lender',
    programType: '7(a) Standard',
    loanAmount: { min: 50_000, max: 500_000 },
    interestRate: { min: 10, max: 12 },
    minCreditScore: 680,
    creditTier: 'good',
    minYearsInBusiness: 2,
    maxTermMonths: 120,
    sbaGuaranteePct: 75,
    eligibleBusinessTypes: null,
    collateral: 'no',
    maxDebtRatio: null,
    turnaroundDays: 30,
    specialRequirements: null,
    lastUpdated: '2026-01-01',
    ratesRecentlyUpdated: false,
    ...overrides,
  }
}

const f = (overrides: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...overrides })

describe('isEligible', () => {
  it('matches everything with no filters', () => {
    expect(isEligible(program(), EMPTY_FILTERS)).toBe(true)
  })

  it('checks loan amount inclusively', () => {
    expect(isEligible(program(), f({ amount: 50_000 }))).toBe(true)
    expect(isEligible(program(), f({ amount: 500_000 }))).toBe(true)
    expect(isEligible(program(), f({ amount: 49_999 }))).toBe(false)
    expect(isEligible(program(), f({ amount: 500_001 }))).toBe(false)
  })

  it('checks years in business', () => {
    expect(isEligible(program(), f({ yearsInBusiness: 2 }))).toBe(true)
    expect(isEligible(program(), f({ yearsInBusiness: 10 }))).toBe(true)
    expect(isEligible(program(), f({ yearsInBusiness: 1.5 }))).toBe(false)
    expect(isEligible(program(), f({ yearsInBusiness: 0 }))).toBe(false)
  })

  it('treats null business types as all', () => {
    expect(isEligible(program(), f({ businessType: 'Retail' }))).toBe(true)
    const mfg = program({ eligibleBusinessTypes: ['Manufacturing'] })
    expect(isEligible(mfg, f({ businessType: 'Manufacturing' }))).toBe(true)
    expect(isEligible(mfg, f({ businessType: 'Retail' }))).toBe(false)
  })

  it('matches business types exactly', () => {
    const mfg = program({ eligibleBusinessTypes: ['Manufacturing'] })
    expect(isEligible(mfg, f({ businessType: 'manufacturing' }))).toBe(false)
    expect(isEligible(mfg, f({ businessType: '' }))).toBe(false)
  })

  it('lets higher credit tiers qualify for lower requirements', () => {
    expect(isEligible(program(), f({ creditTier: 'excellent' }))).toBe(true)
    expect(isEligible(program(), f({ creditTier: 'good' }))).toBe(true)
    expect(isEligible(program(), f({ creditTier: 'fair' }))).toBe(false)
    const fair = program({ creditTier: 'fair' })
    expect(isEligible(fair, f({ creditTier: 'fair' }))).toBe(true)
    expect(isEligible(fair, f({ creditTier: 'excellent' }))).toBe(true)
  })

  it('uses exact score instead of tier when given', () => {
    expect(isEligible(program(), f({ creditScore: 680 }))).toBe(true)
    expect(isEligible(program(), f({ creditScore: 679 }))).toBe(false)
    expect(isEligible(program(), f({ creditScore: 700, creditTier: 'fair' }))).toBe(true)
    expect(isEligible(program(), f({ creditScore: 600, creditTier: 'excellent' }))).toBe(false)
  })

  it('filters by program type', () => {
    expect(isEligible(program(), f({ programTypes: ['504 Loan', '7(a) Standard'] }))).toBe(true)
    expect(isEligible(program(), f({ programTypes: ['504 Loan'] }))).toBe(false)
  })

  it('requires every filter to pass', () => {
    const all = f({ amount: 100_000, yearsInBusiness: 3, creditScore: 700, businessType: 'Retail', programTypes: ['7(a) Standard'] })
    expect(isEligible(program(), all)).toBe(true)
    expect(isEligible(program(), { ...all, amount: 1 })).toBe(false)
    expect(isEligible(program(), { ...all, yearsInBusiness: 1 })).toBe(false)
    expect(isEligible(program(), { ...all, creditScore: 600 })).toBe(false)
    expect(isEligible(program({ eligibleBusinessTypes: ['Healthcare'] }), all)).toBe(false)
    expect(isEligible(program(), { ...all, programTypes: ['SBA Express'] })).toBe(false)
  })

  // The parsers keep these values out of the UI and URL; these tests pin down
  // what isEligible does if one slips through anyway.
  describe('with out-of-range filter values', () => {
    it('matches nothing for a negative or zero amount', () => {
      expect(isEligible(program({ loanAmount: { min: 0, max: 1 } }), f({ amount: -1 }))).toBe(false)
      expect(isEligible(program(), f({ amount: 0 }))).toBe(false)
    })

    it('matches nothing for a huge amount', () => {
      expect(isEligible(program(), f({ amount: Number.MAX_SAFE_INTEGER }))).toBe(false)
    })

    it('treats a huge score as clearing every credit requirement', () => {
      expect(isEligible(program({ minCreditScore: 850 }), f({ creditScore: 100_000 }))).toBe(true)
    })

    it('treats a negative score as failing every credit requirement', () => {
      expect(isEligible(program({ minCreditScore: 300 }), f({ creditScore: -700 }))).toBe(false)
    })

    it('treats negative years as failing every years requirement', () => {
      expect(isEligible(program({ minYearsInBusiness: 0 }), f({ yearsInBusiness: -1 }))).toBe(false)
    })
  })

  describe('with unusual program data', () => {
    it('never matches an amount when the loan range is inverted', () => {
      const inverted = program({ loanAmount: { min: 500_000, max: 50_000 } })
      expect(isEligible(inverted, f({ amount: 100_000 }))).toBe(false)
    })

    it('accepts any years when the program has no minimum', () => {
      expect(isEligible(program({ minYearsInBusiness: 0 }), f({ yearsInBusiness: 0 }))).toBe(true)
    })

    it('ignores rate data entirely, even if negative', () => {
      expect(isEligible(program({ interestRate: { min: -2, max: -1 } }), EMPTY_FILTERS)).toBe(true)
    })
  })
})

describe('hasActiveFilters', () => {
  it('is false for empty filters', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
  })

  it.each<Partial<Filters>>([
    { amount: 1 },
    { businessType: 'Retail' },
    { yearsInBusiness: 0 },
    { creditTier: 'fair' },
    { creditScore: 700 },
    { programTypes: ['504 Loan'] },
  ])('is true for %o', (patch) => {
    expect(hasActiveFilters(f(patch))).toBe(true)
  })
})

describe('sortPrograms', () => {
  const a = program({ id: 'a', lender: 'A', interestRate: { min: 9, max: 11 }, turnaroundDays: 40, maxTermMonths: 84, sbaGuaranteePct: 50 })
  const b = program({ id: 'b', lender: 'B', interestRate: { min: 7, max: 8 }, turnaroundDays: 60, maxTermMonths: 300, sbaGuaranteePct: 40 })
  const c = program({ id: 'c', lender: 'C', interestRate: { min: 9, max: 10 }, turnaroundDays: 10, maxTermMonths: 120, sbaGuaranteePct: 85 })
  const ids = (ps: Program[]) => ps.map((p) => p.id)

  it('sorts by lowest rate, breaking ties on max rate', () => {
    expect(ids(sortPrograms([a, b, c], 'rate'))).toEqual(['b', 'c', 'a'])
  })
  it('sorts by fastest turnaround', () => {
    expect(ids(sortPrograms([a, b, c], 'turnaround'))).toEqual(['c', 'a', 'b'])
  })
  it('sorts by longest term', () => {
    expect(ids(sortPrograms([a, b, c], 'term'))).toEqual(['b', 'c', 'a'])
  })
  it('sorts by highest guarantee', () => {
    expect(ids(sortPrograms([a, b, c], 'guarantee'))).toEqual(['c', 'a', 'b'])
  })

  it('breaks full ties by rate, then lender name', () => {
    const x = program({ id: 'x', lender: 'Zeta', turnaroundDays: 10, interestRate: { min: 9, max: 10 } })
    const y = program({ id: 'y', lender: 'Alpha', turnaroundDays: 10, interestRate: { min: 9, max: 10 } })
    const z = program({ id: 'z', lender: 'Mid', turnaroundDays: 10, interestRate: { min: 8, max: 10 } })
    expect(ids(sortPrograms([x, y, z], 'turnaround'))).toEqual(['z', 'y', 'x'])
  })

  it('handles negative and zero rates', () => {
    const neg = program({ id: 'neg', interestRate: { min: -1, max: 0 } })
    const zero = program({ id: 'zero', interestRate: { min: 0, max: 0 } })
    expect(ids(sortPrograms([a, zero, neg], 'rate'))).toEqual(['neg', 'zero', 'a'])
  })

  it('returns an empty list for no programs', () => {
    expect(sortPrograms([], 'rate')).toEqual([])
  })

  it('does not mutate its input', () => {
    const input = [a, b, c]
    sortPrograms(input, 'rate')
    expect(ids(input)).toEqual(['a', 'b', 'c'])
  })
})

describe('parseAmount', () => {
  it.each([
    ['250000', 250_000],
    ['$250,000', 250_000],
    [' 250000 ', 250_000],
    ['250k', 250_000],
    ['250K', 250_000],
    ['1.5m', 1_500_000],
    ['.5m', 500_000],
    ['999999999999', 999_999_999_999],
  ])('parses %j', (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '10x', '1.2.3', '-5000', '-5k', '0', '0k', '$0', '1e6', 'Infinity', 'NaN', '5kk'])(
    'rejects %j',
    (input) => {
      expect(parseAmount(input)).toBeNull()
    },
  )
})

describe('parseScore', () => {
  it.each([
    ['300', 300],
    ['620', 620],
    [' 700 ', 700],
    ['850', 850],
  ])('parses %j', (input, expected) => {
    expect(parseScore(input)).toBe(expected)
  })

  it.each(['', 'abc', '299', '851', '0', '-700', '9999', '100000', '700.5', '7OO', '68', 'Infinity'])(
    'rejects %j',
    (input) => {
      expect(parseScore(input)).toBeNull()
    },
  )
})

describe('parseYears', () => {
  it.each([
    ['0', 0],
    ['0.5', 0.5],
    ['.5', 0.5],
    ['1.', 1],
    ['2', 2],
    ['100', 100],
    [' 3 ', 3],
    ['40', 40],
  ])('parses %j', (input, expected) => {
    expect(parseYears(input)).toBe(expected)
  })

  it.each(['', '.', 'abc', '-1', '-0.5', '1e3', '101', '200', 'Infinity', 'NaN', '2 yrs', '1.2.3'])('rejects %j', (input) => {
    expect(parseYears(input)).toBeNull()
  })
})
