import type { CreditTier, Program } from './types'

export interface Filters {
  amount: number | null
  businessType: string | null
  yearsInBusiness: number | null
  /** Reps give either a rough tier or an exact score, never both. */
  creditTier: CreditTier | null
  creditScore: number | null
  /** Empty means all program types. */
  programTypes: string[]
}

export const EMPTY_FILTERS: Filters = {
  amount: null,
  businessType: null,
  yearsInBusiness: null,
  creditTier: null,
  creditScore: null,
  programTypes: [],
}

export const TIER_RANK: Record<CreditTier, number> = { fair: 0, good: 1, excellent: 2 }

export function isEligible(p: Program, f: Filters): boolean {
  if (f.amount !== null && (f.amount < p.loanAmount.min || f.amount > p.loanAmount.max)) return false
  if (f.yearsInBusiness !== null && f.yearsInBusiness < p.minYearsInBusiness) return false
  if (f.businessType !== null && p.eligibleBusinessTypes !== null && !p.eligibleBusinessTypes.includes(f.businessType)) {
    return false
  }
  if (f.creditScore !== null) {
    if (f.creditScore < p.minCreditScore) return false
  } else if (f.creditTier !== null && TIER_RANK[f.creditTier] < TIER_RANK[p.creditTier]) {
    return false
  }
  if (f.programTypes.length > 0 && !f.programTypes.includes(p.programType)) return false
  return true
}

export function hasActiveFilters(f: Filters): boolean {
  return (
    f.amount !== null ||
    f.businessType !== null ||
    f.yearsInBusiness !== null ||
    f.creditTier !== null ||
    f.creditScore !== null ||
    f.programTypes.length > 0
  )
}

export type SortKey = 'rate' | 'turnaround' | 'term' | 'guarantee'

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'rate', label: 'Lowest rate' },
  { key: 'turnaround', label: 'Fastest turnaround' },
  { key: 'term', label: 'Longest term' },
  { key: 'guarantee', label: 'Highest SBA guarantee' },
]

const byRate = (a: Program, b: Program) =>
  a.interestRate.min - b.interestRate.min || a.interestRate.max - b.interestRate.max

const COMPARATORS: Record<SortKey, (a: Program, b: Program) => number> = {
  rate: byRate,
  turnaround: (a, b) => a.turnaroundDays - b.turnaroundDays,
  term: (a, b) => b.maxTermMonths - a.maxTermMonths,
  guarantee: (a, b) => b.sbaGuaranteePct - a.sbaGuaranteePct,
}

export function sortPrograms(programs: Program[], key: SortKey): Program[] {
  // Ties fall back to lowest rate, then lender name, so the order is always stable.
  return [...programs].sort(
    (a, b) => COMPARATORS[key](a, b) || byRate(a, b) || a.lender.localeCompare(b.lender),
  )
}

// Parsers shared by the filter inputs and the URL so both reject the same values.
// Each returns null for anything that isn't a usable filter value.

export const MIN_CREDIT_SCORE = 300
export const MAX_CREDIT_SCORE = 850
export const MAX_YEARS_IN_BUSINESS = 100

/** Parses loose rep input like "250k", "1.5m", "$250,000". */
export function parseAmount(text: string): number | null {
  const match = text.trim().toLowerCase().replace(/[$,\s]/g, '').match(/^(\d*\.?\d+)([km]?)$/)
  if (!match) return null
  const multiplier = { '': 1, k: 1_000, m: 1_000_000 }[match[2] as '' | 'k' | 'm']
  const amount = Math.round(parseFloat(match[1]) * multiplier)
  return amount > 0 ? amount : null
}

/** Accepts "2", "0.5", ".5", and "1." (mid-typing). */
export function parseYears(text: string): number | null {
  const t = text.trim()
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return null
  const years = parseFloat(t)
  return years <= MAX_YEARS_IN_BUSINESS ? years : null
}

export function parseScore(text: string): number | null {
  const t = text.trim()
  if (!/^\d{3}$/.test(t)) return null
  const score = parseInt(t, 10)
  return score >= MIN_CREDIT_SCORE && score <= MAX_CREDIT_SCORE ? score : null
}
