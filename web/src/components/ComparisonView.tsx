import type { ReactNode } from 'react'
import { bestIndexes, type Better, type Score } from '../compare'
import { hasActiveFilters, isEligible, type Filters } from '../filters'
import { businessTypes, capitalize, isoDate, moneyFull, percent, term, years } from '../format'
import type { Collateral, Program } from '../types'

interface Props {
  programs: Program[]
  filters: Filters
  onRemove: (id: string) => void
  onBack: () => void
}

interface Row {
  label: string
  render: (p: Program) => ReactNode
  /** Rows with a score highlight the value that's most favorable to the borrower. */
  better?: Better
  score?: (p: Program) => Score
}

const COLLATERAL_RANK: Record<Collateral, number> = { no: 0, varies: 1, yes: 2 }

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Cost & terms',
    rows: [
      {
        label: 'Interest rate',
        render: (p) => `${percent(p.interestRate.min)} – ${percent(p.interestRate.max)}`,
        better: 'lower',
        score: (p) => [p.interestRate.min, p.interestRate.max],
      },
      {
        label: 'Max term',
        render: (p) => `${term(p.maxTermMonths)} (${p.maxTermMonths} mo)`,
        better: 'higher',
        score: (p) => [p.maxTermMonths],
      },
      {
        label: 'Turnaround',
        render: (p) => `~${p.turnaroundDays} days`,
        better: 'lower',
        score: (p) => [p.turnaroundDays],
      },
      {
        label: 'Loan amount',
        render: (p) => `${moneyFull(p.loanAmount.min)} – ${moneyFull(p.loanAmount.max)}`,
      },
      {
        label: 'SBA guarantee',
        render: (p) => `${p.sbaGuaranteePct}%`,
        better: 'higher',
        score: (p) => [p.sbaGuaranteePct],
      },
    ],
  },
  {
    title: 'Eligibility',
    rows: [
      {
        label: 'Min credit score',
        render: (p) => `${p.minCreditScore}+ (${capitalize(p.creditTier)})`,
        better: 'lower',
        score: (p) => [p.minCreditScore],
      },
      {
        label: 'Min years in business',
        render: (p) => years(p.minYearsInBusiness),
        better: 'lower',
        score: (p) => [p.minYearsInBusiness],
      },
      {
        label: 'Collateral required',
        render: (p) => capitalize(p.collateral),
        better: 'lower',
        score: (p) => [COLLATERAL_RANK[p.collateral]],
      },
      {
        label: 'Max existing debt ratio',
        render: (p) => (p.maxDebtRatio === null ? <span className="muted">Not specified</span> : `${Math.round(p.maxDebtRatio * 100)}%`),
        better: 'higher',
        score: (p) => (p.maxDebtRatio === null ? null : [p.maxDebtRatio]),
      },
      {
        label: 'Eligible businesses',
        render: (p) => businessTypes(p.eligibleBusinessTypes),
      },
      {
        label: 'Special requirements',
        render: (p) =>
          p.specialRequirements ? <span className="special">{p.specialRequirements}</span> : <span className="muted">None</span>,
      },
    ],
  },
  {
    title: 'Details',
    rows: [{ label: 'Rates last updated', render: (p) => isoDate(p.lastUpdated) }],
  },
]

export default function ComparisonView({ programs, filters, onRemove, onBack }: Props) {
  const checkFilters = hasActiveFilters(filters)

  return (
    <section className="comparison" aria-labelledby="comparison-title">
      <div className="comparison-bar">
        <button type="button" className="link-button back-button" onClick={onBack}>
          ← Back to results
        </button>
        <h2 id="comparison-title">Comparing {programs.length} programs</h2>
        <p className="comparison-legend">
          <span className="best-swatch" aria-hidden="true" /> Green marks the most favorable value for the borrower in each
          row.
        </p>
      </div>

      <div className="comparison-scroll">
        <table className="comparison-table" style={{ ['--columns' as string]: programs.length }}>
          <thead>
            <tr>
              <td />
              {programs.map((p) => (
                <th key={p.id} scope="col">
                  <div className="comparison-head">
                    <div className="comparison-head-top">
                      <span className="lender">{p.lender}</span>
                      <button
                        type="button"
                        className="link-button remove-button"
                        aria-label={`Remove ${p.lender} ${p.programType} from comparison`}
                        onClick={() => onRemove(p.id)}
                      >
                        Remove
                      </button>
                    </div>
                    <span className="program-type">{p.programType}</span>
                    <div className="comparison-tags">
                      {p.ratesRecentlyUpdated && <span className="badge-new">New rates</span>}
                      {checkFilters && !isEligible(p, filters) && (
                        <span className="badge-mismatch">
                          <span aria-hidden="true">✕</span> Doesn't match current filters
                        </span>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          {GROUPS.map((group) => (
            <tbody key={group.title}>
              <tr className="comparison-group">
                <th scope="colgroup" colSpan={programs.length + 1}>
                  {group.title}
                </th>
              </tr>
              {group.rows.map((row) => {
                const best =
                  row.better && row.score ? bestIndexes(programs.map(row.score), row.better) : new Set<number>()
                return (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {programs.map((p, i) => (
                      <td key={p.id} className={best.has(i) ? 'is-best' : undefined}>
                        {row.render(p)}
                        {/* The highlight is color only, so screen readers get it in words. */}
                        {best.has(i) && <span className="sr-only"> (best)</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  )
}
