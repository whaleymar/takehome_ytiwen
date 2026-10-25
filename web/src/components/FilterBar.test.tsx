// @vitest-environment jsdom
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/programs.json'
import { EMPTY_FILTERS, type Filters } from '../filters'
import { byText, click, mount, type } from '../test/dom'
import type { ProgramsResponse } from '../types'
import FilterBar from './FilterBar'

const { facets } = fixture as ProgramsResponse

/** Renders FilterBar with real state, like App does, and exposes the latest filters. */
function setup(initial: Partial<Filters> = {}) {
  const latest = { filters: { ...EMPTY_FILTERS, ...initial } }
  function Harness() {
    const [filters, setFilters] = useState(latest.filters)
    return (
      <FilterBar
        filters={filters}
        facets={facets}
        onChange={(f) => {
          latest.filters = f
          setFilters(f)
        }}
      />
    )
  }
  const root = mount(<Harness />)
  return {
    root,
    latest,
    amount: root.querySelector<HTMLInputElement>('input[placeholder="e.g. 250k"]')!,
    years: root.querySelector<HTMLInputElement>('input[placeholder="e.g. 2"]')!,
    score: root.querySelector<HTMLInputElement>('input[aria-label="Exact credit score"]')!,
    tier: (label: string) => byText(root, '.segmented button', label),
    clearAll: () => click(byText(root, 'button', 'Clear all')),
  }
}

describe('FilterBar', () => {
  it('keeps shorthand amounts as typed while filtering on the parsed value', () => {
    const { amount, latest } = setup()
    type(amount, '250k')
    expect(amount.value).toBe('250k')
    expect(latest.filters.amount).toBe(250_000)
  })

  it('keeps a trailing decimal point while typing years', () => {
    const { years, latest } = setup()
    type(years, '1.')
    expect(years.value).toBe('1.')
    expect(latest.filters.yearsInBusiness).toBe(1)
  })

  it('marks invalid text and does not filter on it', () => {
    const { years, latest } = setup()
    type(years, 'two')
    expect(years.getAttribute('aria-invalid')).toBe('true')
    expect(latest.filters.yearsInBusiness).toBeNull()
  })

  it('Clear all resets valid and invalid text', () => {
    // Regression: invalid text survived Clear all because its value was already null.
    const { root, amount, years, score, latest, clearAll } = setup()
    type(amount, '250k')
    type(years, 'two')
    type(score, '68')
    clearAll()
    expect(latest.filters).toEqual(EMPTY_FILTERS)
    const inputs = [...root.querySelectorAll<HTMLInputElement>('input')]
    expect(inputs.map((i) => i.value)).toEqual(['', '', ''])
    expect(inputs.map((i) => i.getAttribute('aria-invalid'))).toEqual(['false', 'false', 'false'])
  })

  it('clicking a tier replaces an exact score and clears its text', () => {
    const { root, tier, latest } = setup()
    type(root.querySelector<HTMLInputElement>('input[aria-label="Exact credit score"]')!, '700')
    expect(latest.filters.creditScore).toBe(700)

    click(tier('Good'))
    expect(latest.filters).toMatchObject({ creditTier: 'good', creditScore: null })
    expect(root.querySelector<HTMLInputElement>('input[aria-label="Exact credit score"]')!.value).toBe('')
  })

  it('clicking a tier clears invalid score text', () => {
    // Regression: "68" stayed in the box next to the pressed tier, looking like it applied.
    const { root, tier } = setup()
    type(root.querySelector<HTMLInputElement>('input[aria-label="Exact credit score"]')!, '68')
    click(tier('Good'))
    const score = root.querySelector<HTMLInputElement>('input[aria-label="Exact credit score"]')!
    expect(score.value).toBe('')
    expect(score.getAttribute('aria-invalid')).toBe('false')
  })

  it('clicking a tier leaves the other fields as typed', () => {
    const { root, tier } = setup()
    type(root.querySelector<HTMLInputElement>('input[placeholder="e.g. 250k"]')!, '250k')
    click(tier('Good'))
    expect(root.querySelector<HTMLInputElement>('input[placeholder="e.g. 250k"]')!.value).toBe('250k')
  })

  it('typing a valid score unpresses the tier', () => {
    const { root, tier, latest } = setup()
    click(tier('Good'))
    // The tier click remounts the score field, so query it fresh.
    type(root.querySelector<HTMLInputElement>('input[aria-label="Exact credit score"]')!, '700')
    expect(latest.filters).toMatchObject({ creditTier: null, creditScore: 700 })
    expect(tier('Good').getAttribute('aria-pressed')).toBe('false')
  })

  it('clicking the pressed tier unpresses it', () => {
    const { tier, latest } = setup()
    click(tier('Fair'))
    click(tier('Fair'))
    expect(latest.filters.creditTier).toBeNull()
  })

  it('toggles program type chips on and off', () => {
    const { root, latest } = setup()
    const chip = () => byText(root, '.chip', 'SBA Express')
    click(chip())
    expect(latest.filters.programTypes).toEqual(['SBA Express'])
    expect(chip().getAttribute('aria-pressed')).toBe('true')
    click(chip())
    expect(latest.filters.programTypes).toEqual([])
  })

  it('shows the selected business type', () => {
    const { root } = setup({ businessType: 'Retail' })
    expect(root.querySelector('select')!.value).toBe('Retail')
  })

  it('only shows Clear all when a filter is active', () => {
    const { root, tier } = setup()
    expect(root.textContent).not.toContain('Clear all')
    click(tier('Fair'))
    expect(root.textContent).toContain('Clear all')
  })
})
