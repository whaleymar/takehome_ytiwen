// The frontend half of the API contract. server/tests/test_programs.py checks the
// fixture equals the real API output; this checks the fixture has exactly the
// fields src/types.ts declares. Together, renaming a field on either side fails a test.
import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/programs.json'
import type { DataError, Program, ProgramsResponse, Range } from './types'

// `satisfies` makes TypeScript reject these lists if they miss or add a key versus the types.
const RESPONSE_KEYS = {
  asOf: true,
  referenceDate: true,
  recentUpdateDays: true,
  facets: true,
  programs: true,
  dataErrors: true,
} satisfies Record<keyof ProgramsResponse, true>

const FACET_KEYS = { businessTypes: true, programTypes: true, creditTiers: true } satisfies Record<
  keyof ProgramsResponse['facets'],
  true
>

const PROGRAM_KEYS = {
  id: true,
  lender: true,
  programType: true,
  loanAmount: true,
  interestRate: true,
  minCreditScore: true,
  creditTier: true,
  minYearsInBusiness: true,
  maxTermMonths: true,
  sbaGuaranteePct: true,
  eligibleBusinessTypes: true,
  collateral: true,
  maxDebtRatio: true,
  turnaroundDays: true,
  specialRequirements: true,
  lastUpdated: true,
  ratesRecentlyUpdated: true,
} satisfies Record<keyof Program, true>

const RANGE_KEYS = { min: true, max: true } satisfies Record<keyof Range, true>
const DATA_ERROR_KEYS = { line: true, message: true } satisfies Record<keyof DataError, true>

const keys = (o: object) => Object.keys(o).sort()
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

describe('API contract (fixture vs src/types.ts)', () => {
  const data = fixture as unknown as Record<string, unknown> & ProgramsResponse

  it('has exactly the response fields', () => {
    expect(keys(data)).toEqual(keys(RESPONSE_KEYS))
    expect(keys(data.facets)).toEqual(keys(FACET_KEYS))
  })

  it('has exactly the program fields, with expected value types', () => {
    expect(data.programs.length).toBeGreaterThan(0)
    for (const p of data.programs) {
      expect(keys(p)).toEqual(keys(PROGRAM_KEYS))
      expect(keys(p.loanAmount)).toEqual(keys(RANGE_KEYS))
      expect(keys(p.interestRate)).toEqual(keys(RANGE_KEYS))
      expect(p.lastUpdated).toMatch(ISO_DATE)
      expect(['fair', 'good', 'excellent']).toContain(p.creditTier)
      expect(['yes', 'no', 'varies']).toContain(p.collateral)
      expect(p.eligibleBusinessTypes === null || Array.isArray(p.eligibleBusinessTypes)).toBe(true)
      for (const n of [p.loanAmount.min, p.loanAmount.max, p.interestRate.min, p.minCreditScore, p.turnaroundDays]) {
        expect(typeof n).toBe('number')
      }
    }
  })

  it('uses ISO dates at the top level', () => {
    expect(data.asOf).toMatch(ISO_DATE)
    expect(data.referenceDate).toMatch(ISO_DATE)
  })

  it('declares the data error shape', () => {
    // The sample CSV is clean; this keeps the key list exercised by TypeScript.
    expect(keys(DATA_ERROR_KEYS)).toEqual(['line', 'message'])
    expect(data.dataErrors).toEqual([])
  })
})
