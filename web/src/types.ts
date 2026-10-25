// Mirrors the response models in server/app/programs.py.

export type CreditTier = 'fair' | 'good' | 'excellent'
export type Collateral = 'yes' | 'no' | 'varies'

export interface Range {
  min: number
  max: number
}

export interface Program {
  id: string
  lender: string
  programType: string
  loanAmount: Range
  interestRate: Range
  minCreditScore: number
  creditTier: CreditTier
  minYearsInBusiness: number
  maxTermMonths: number
  sbaGuaranteePct: number
  /** null means the program accepts all business types. */
  eligibleBusinessTypes: string[] | null
  collateral: Collateral
  maxDebtRatio: number | null
  turnaroundDays: number
  specialRequirements: string | null
  /** ISO date, e.g. "2026-01-16" */
  lastUpdated: string
  ratesRecentlyUpdated: boolean
}

export interface DataError {
  /** Line in the source CSV (1 is the header). */
  line: number
  message: string
}

export interface ProgramsResponse {
  /** null when no rows loaded. */
  asOf: string | null
  referenceDate: string
  recentUpdateDays: number
  facets: {
    businessTypes: string[]
    programTypes: string[]
    creditTiers: CreditTier[]
  }
  programs: Program[]
  /** Rows the server skipped because they were malformed. */
  dataErrors: DataError[]
}
