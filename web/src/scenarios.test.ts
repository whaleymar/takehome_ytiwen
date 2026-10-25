// Realistic filter scenarios against the sample dataset. The fixture is the
// API response for data/programs.csv, and the expected results were worked
// out from the raw CSV separately rather than with this code.
import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/programs.json'
import { EMPTY_FILTERS, isEligible, type Filters } from './filters'
import type { ProgramsResponse } from './types'

const { programs } = fixture as ProgramsResponse

const matching = (overrides: Partial<Filters>) =>
  programs.filter((p) => isEligible(p, { ...EMPTY_FILTERS, ...overrides })).map((p) => p.id)

describe('sample data scenarios', () => {
  it('shows all 49 programs with no filters', () => {
    expect(matching({})).toHaveLength(49)
  })

  it('restaurant, $250K, 2 years, good credit', () => {
    expect(
      matching({ amount: 250_000, businessType: 'Restaurant/Food Service', yearsInBusiness: 2, creditTier: 'good' }),
    ).toHaveLength(22)
  })

  it('fair credit only qualifies for Community Advantage programs', () => {
    expect(matching({ creditTier: 'fair' })).toEqual([
      'first-national-bank--community-advantage',
      'pacific-commerce-bank--community-advantage',
      'summit-lending-group--community-advantage',
      'coastal-capital--community-advantage',
      'evergreen-business-capital--community-advantage',
      'keystone-community-bank--community-advantage',
      'sterling-business-lending--community-advantage',
    ])
  })

  it('construction, $100K, 1 year, 640 score', () => {
    expect(matching({ amount: 100_000, businessType: 'Construction', yearsInBusiness: 1, creditScore: 640 })).toEqual([
      'first-national-bank--community-advantage',
      'pacific-commerce-bank--7-a-small-loan',
      'sterling-business-lending--community-advantage',
    ])
  })

  it('retail 504, $1M, 3 years, 700 score', () => {
    expect(
      matching({ amount: 1_000_000, businessType: 'Retail', yearsInBusiness: 3, creditScore: 700, programTypes: ['504 Loan'] }),
    ).toEqual([
      'heritage-credit-union--504-loan',
      'summit-lending-group--504-loan',
      'coastal-capital--504-loan',
      'midwest-business-finance--504-loan',
      'evergreen-business-capital--504-loan',
      'gateway-commercial-finance--504-loan',
    ])
  })

  it('healthcare with fair credit leaves a single all-types program', () => {
    expect(matching({ businessType: 'Healthcare', creditTier: 'fair' })).toEqual(['first-national-bank--community-advantage'])
  })

  it('the lowest score in the data (600) matches exactly one program', () => {
    expect(matching({ creditScore: 600 })).toEqual(['evergreen-business-capital--community-advantage'])
  })

  it('the smallest and largest loan amounts sit on range bounds', () => {
    expect(matching({ amount: 10_000 })).toHaveLength(10)
    expect(matching({ amount: 5_500_000 })).toEqual([
      'summit-lending-group--504-loan',
      'coastal-capital--504-loan',
      'atlas-financial-services--504-loan',
    ])
  })

  it('an unknown business type only matches all-types programs', () => {
    const ids = matching({ businessType: 'Agriculture' })
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(programs.find((p) => p.id === id)!.eligibleBusinessTypes).toBeNull()
    }
  })

  describe('nothing matches', () => {
    it.each<[string, Partial<Filters>]>([
      ['amount above every maximum', { amount: 5_500_001 }],
      ['amount below every minimum', { amount: 9_999 }],
      ['huge amount', { amount: 999_999_999_999 }],
      ['score below every minimum', { creditScore: 599 }],
      ['the lowest valid score', { creditScore: 300 }],
      ['under a year in business', { yearsInBusiness: 0.5 }],
      ['brand-new business', { yearsInBusiness: 0 }],
      ['program type not in the data', { programTypes: ['Microloan'] }],
      ['fair credit wanting a 504 loan', { creditTier: 'fair', programTypes: ['504 Loan'] }],
      ['healthcare Community Advantage at $300K', { businessType: 'Healthcare', programTypes: ['Community Advantage'], amount: 300_000 }],
      ['$5M with only 1 year in business', { amount: 5_000_000, yearsInBusiness: 1 }],
    ])('%s', (_, filters) => {
      expect(matching(filters)).toEqual([])
    })
  })
})
