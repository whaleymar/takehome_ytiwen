import type { KeyboardEvent } from 'react'
import { MAX_COMPARE } from '../compare'
import { businessTypes, capitalize, isoDate, money, moneyFull, percent, term, years } from '../format'
import type { Program } from '../types'

interface Props {
  program: Program
  expanded: boolean
  recentUpdateDays: number
  onToggle: () => void
  compared: boolean
  /** True when the comparison is full and this program isn't in it. */
  compareFull: boolean
  onToggleCompare: () => void
}

export default function ProgramCard({
  program: p,
  expanded,
  recentUpdateDays,
  onToggle,
  compared,
  compareFull,
  onToggleCompare,
}: Props) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }

  return (
    <article id={p.id} className={`card${expanded ? ' card-expanded' : ''}${compared ? ' card-compared' : ''}`}>
      {/* Kept outside the clickable summary so ticking it never expands the card. */}
      <label
        className="compare-toggle"
        title={compareFull ? `You can compare up to ${MAX_COMPARE} programs` : undefined}
      >
        <input type="checkbox" checked={compared} disabled={compareFull} onChange={onToggleCompare} />
        Compare
        <span className="sr-only">
          {p.lender} {p.programType}
        </span>
      </label>

      <div
        className="card-summary"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={onKeyDown}
      >
        <div className="card-head">
          <h2 className="lender">{p.lender}</h2>
          <span className="program-type">{p.programType}</span>
          {p.ratesRecentlyUpdated && (
            <span className="badge-new" title={`Rates updated ${isoDate(p.lastUpdated)}, within the last ${recentUpdateDays} days`}>
              New rates
            </span>
          )}
          <span className="chevron" aria-hidden="true" />
        </div>

        <dl className="stats">
          <div>
            <dt>Rate</dt>
            <dd className="stat-rate">
              {percent(p.interestRate.min)}–{percent(p.interestRate.max)}
            </dd>
          </div>
          <div>
            <dt>Max term</dt>
            <dd>{term(p.maxTermMonths)}</dd>
          </div>
          <div>
            <dt>Loan size</dt>
            <dd>
              {money(p.loanAmount.min)}–{money(p.loanAmount.max)}
            </dd>
          </div>
          <div>
            <dt>Turnaround</dt>
            <dd>~{p.turnaroundDays} days</dd>
          </div>
        </dl>

        <ul className="requirements" aria-label="Eligibility requirements">
          <li>
            <span>Credit</span> {capitalize(p.creditTier)} · {p.minCreditScore}+
          </li>
          <li>
            <span>In business</span> {years(p.minYearsInBusiness)}
          </li>
          <li>
            <span>Business</span> {businessTypes(p.eligibleBusinessTypes)}
          </li>
          <li>
            <span>Collateral</span> {capitalize(p.collateral)}
          </li>
        </ul>

        {p.specialRequirements && <p className="special">{p.specialRequirements}</p>}
      </div>

      {expanded && (
        <dl className="details">
          <Detail label="Loan amount" value={`${moneyFull(p.loanAmount.min)} – ${moneyFull(p.loanAmount.max)}`} />
          <Detail label="Interest rate" value={`${percent(p.interestRate.min)} – ${percent(p.interestRate.max)}`} />
          <Detail label="Max term" value={`${p.maxTermMonths} months (${(p.maxTermMonths / 12).toFixed(p.maxTermMonths % 12 ? 1 : 0)} yrs)`} />
          <Detail label="SBA guarantee" value={`${p.sbaGuaranteePct}%`} />
          <Detail label="Min credit score" value={`${p.minCreditScore} (${capitalize(p.creditTier)} tier)`} />
          <Detail label="Min years in business" value={String(p.minYearsInBusiness)} />
          <Detail label="Eligible businesses" value={businessTypes(p.eligibleBusinessTypes)} />
          <Detail label="Collateral required" value={capitalize(p.collateral)} />
          <Detail
            label="Max existing debt ratio"
            value={p.maxDebtRatio === null ? 'Not specified' : `${Math.round(p.maxDebtRatio * 100)}%`}
          />
          <Detail label="Typical turnaround" value={`${p.turnaroundDays} days`} />
          <Detail label="Special requirements" value={p.specialRequirements ?? 'None'} />
          <Detail label="Rates last updated" value={isoDate(p.lastUpdated)} />
        </dl>
      )}
    </article>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
