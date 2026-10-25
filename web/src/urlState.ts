import {
  EMPTY_FILTERS,
  SORT_OPTIONS,
  TIER_RANK,
  parseAmount,
  parseScore,
  parseYears,
  type Filters,
  type SortKey,
} from './filters'
import { MAX_COMPARE } from './compare'
import type { CreditTier } from './types'

export interface AppState {
  filters: Filters
  sort: SortKey
  openId: string | null
  /** Programs ticked for comparison, in the order they were picked. */
  compareIds: string[]
  view: 'list' | 'compare'
}

export const DEFAULT_SORT: SortKey = 'rate'

/** Any param can be hand-edited or truncated in a shared link, so invalid values are dropped. */
export function readState(search: string): AppState {
  const q = new URLSearchParams(search)
  const text = (key: string) => q.get(key)?.trim() || null
  const parsed = <T>(key: string, parse: (s: string) => T | null) => {
    const value = text(key)
    return value === null ? null : parse(value)
  }

  const tier = text('tier')
  const sort = text('sort')
  const creditScore = parsed('score', parseScore)
  const compareIds = [...new Set(q.getAll('compare').map((id) => id.trim()).filter(Boolean))].slice(0, MAX_COMPARE)
  return {
    filters: {
      ...EMPTY_FILTERS,
      amount: parsed('amount', parseAmount),
      businessType: text('business'),
      yearsInBusiness: parsed('years', parseYears),
      creditScore,
      creditTier: creditScore === null && tier !== null && tier in TIER_RANK ? (tier as CreditTier) : null,
      programTypes: [...new Set(q.getAll('program').map((t) => t.trim()).filter(Boolean))],
    },
    sort: SORT_OPTIONS.some((o) => o.key === sort) ? (sort as SortKey) : DEFAULT_SORT,
    openId: text('open'),
    compareIds,
    view: text('view') === 'compare' && compareIds.length >= 2 ? 'compare' : 'list',
  }
}

export function writeState({ filters: f, sort, openId, compareIds, view }: AppState): string {
  const q = new URLSearchParams()
  if (f.amount !== null) q.set('amount', String(f.amount))
  if (f.businessType !== null) q.set('business', f.businessType)
  if (f.yearsInBusiness !== null) q.set('years', String(f.yearsInBusiness))
  if (f.creditScore !== null) q.set('score', String(f.creditScore))
  else if (f.creditTier !== null) q.set('tier', f.creditTier)
  for (const t of f.programTypes) q.append('program', t)
  if (sort !== DEFAULT_SORT) q.set('sort', sort)
  if (openId !== null) q.set('open', openId)
  for (const id of compareIds) q.append('compare', id)
  if (view === 'compare') q.set('view', 'compare')
  const s = q.toString()
  return s ? `?${s}` : ''
}
