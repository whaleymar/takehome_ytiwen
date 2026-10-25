import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { hasActiveFilters, parseAmount, parseScore, parseYears, EMPTY_FILTERS, type Filters } from '../filters'
import { capitalize, moneyFull } from '../format'
import type { ProgramsResponse } from '../types'

interface Props {
  filters: Filters
  facets: ProgramsResponse['facets']
  onChange: (filters: Filters) => void
  /** Pinned to the top while scrolling results; the comparison needs the room. */
  sticky?: boolean
}

export default function FilterBar({ filters, facets, onChange, sticky = true }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })

  const toggleProgramType = (type: string) =>
    set({
      programTypes: filters.programTypes.includes(type)
        ? filters.programTypes.filter((t) => t !== type)
        : [...filters.programTypes, type],
    })

  return (
    <section className={`filters${sticky ? ' filters-sticky' : ''}`} aria-label="Borrower details">
      <div className="filter-row">
        <label className="field">
          <span className="field-label">Loan amount</span>
          <NumberField
            value={filters.amount}
            parse={parseAmount}
            onValue={(amount) => set({ amount })}
            placeholder="e.g. 250k"
            inputMode="decimal"
            autoFocus
          />
          <span className="field-hint">{filters.amount !== null ? moneyFull(filters.amount) : ' '}</span>
        </label>

        <label className="field">
          <span className="field-label">Business type</span>
          <select
            value={filters.businessType ?? ''}
            onChange={(e) => set({ businessType: e.target.value || null })}
          >
            <option value="">Any type</option>
            {facets.businessTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="field-hint">&nbsp;</span>
        </label>

        <label className="field field-narrow">
          <span className="field-label">Years in business</span>
          <NumberField
            value={filters.yearsInBusiness}
            parse={parseYears}
            onValue={(yearsInBusiness) => set({ yearsInBusiness })}
            placeholder="e.g. 2"
            inputMode="decimal"
          />
          <span className="field-hint">&nbsp;</span>
        </label>

        <div className="field field-credit">
          <span className="field-label" id="credit-label">
            Credit
          </span>
          <div className="credit-inputs">
            <div className="segmented" role="group" aria-labelledby="credit-label">
              {facets.creditTiers.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  aria-pressed={filters.creditTier === tier}
                  onClick={() =>
                    set({ creditTier: filters.creditTier === tier ? null : tier, creditScore: null })
                  }
                >
                  {capitalize(tier)}
                </button>
              ))}
            </div>
            <span className="or">or</span>
            <NumberField
              className="score-input"
              value={filters.creditScore}
              parse={parseScore}
              onValue={(creditScore) =>
                set({ creditScore, creditTier: creditScore !== null ? null : filters.creditTier })
              }
              placeholder="Score"
              inputMode="numeric"
              aria-label="Exact credit score"
            />
          </div>
          <span className="field-hint">&nbsp;</span>
        </div>
      </div>

      <div className="filter-row filter-row-secondary">
        <div className="chips" role="group" aria-label="Program types">
          <span className="field-label">Programs</span>
          {facets.programTypes.map((type) => (
            <button
              key={type}
              type="button"
              className="chip"
              aria-pressed={filters.programTypes.includes(type)}
              onClick={() => toggleProgramType(type)}
            >
              {type}
            </button>
          ))}
        </div>
        {hasActiveFilters(filters) && (
          <button type="button" className="link-button" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear all
          </button>
        )}
      </div>
    </section>
  )
}

interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | null
  parse: (text: string) => number | null
  onValue: (value: number | null) => void
}

/**
 * Text input that keeps the rep's raw typing (e.g. "1." or "250k") while
 * reporting the parsed number upward on every keystroke.
 */
function NumberField({ value, parse, onValue, ...inputProps }: NumberFieldProps) {
  const [text, setText] = useState(value === null ? '' : String(value))

  // Resync when the value changes from outside (Clear all, Back button, tier click).
  useEffect(() => {
    setText((current) => (parse(current) === value ? current : value === null ? '' : String(value)))
  }, [value, parse])

  const invalid = text.trim() !== '' && parse(text) === null

  return (
    <input
      {...inputProps}
      type="text"
      autoComplete="off"
      value={text}
      aria-invalid={invalid}
      onChange={(e) => {
        setText(e.target.value)
        onValue(parse(e.target.value))
      }}
    />
  )
}
