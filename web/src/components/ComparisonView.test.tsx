// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/programs.json'
import { EMPTY_FILTERS, type Filters } from '../filters'
import type { Program, ProgramsResponse } from '../types'
import ComparisonView from './ComparisonView'

const { programs } = fixture as ProgramsResponse
const get = (id: string) => programs.find((p) => p.id === id)!

// Midwest 504: 5.5–6.7%, 240 mo, 82 days, 680+, collateral yes
// Atlas SBA Express: 10.2–11.9%, 84 mo, 7 days, 680+, collateral varies
// Pacific Commerce 7(a) Small: 11.1–12.2%, 120 mo, 19 days, 640+, collateral no
const midwest = get('midwest-business-finance--504-loan')
const atlas = get('atlas-financial-services--sba-express')
const pacific = get('pacific-commerce-bank--7-a-small-loan')

function render(ps: Program[], filters: Filters = EMPTY_FILTERS) {
  const html = renderToStaticMarkup(<ComparisonView programs={ps} filters={filters} onRemove={() => {}} onBack={() => {}} />)
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const rows = [...doc.querySelectorAll('tbody tr')].filter((tr) => tr.querySelector('th[scope="row"]'))
  /** For a row label, the index of each highlighted column. */
  const bestIn = (label: string) => {
    const row = rows.find((tr) => tr.querySelector('th')!.textContent === label)!
    return [...row.querySelectorAll('td')].flatMap((td, i) => (td.classList.contains('is-best') ? [i] : []))
  }
  return { html, doc, bestIn }
}

describe('ComparisonView', () => {
  it('shows one column per program, in selection order', () => {
    const { doc } = render([pacific, midwest, atlas])
    const heads = [...doc.querySelectorAll('thead th .lender')].map((el) => el.textContent)
    expect(heads).toEqual(['Pacific Commerce Bank', 'Midwest Business Finance', 'Atlas Financial Services'])
  })

  it('highlights the best value in each scored row', () => {
    const { bestIn } = render([midwest, atlas, pacific])
    expect(bestIn('Interest rate')).toEqual([0])
    expect(bestIn('Max term')).toEqual([0])
    expect(bestIn('Turnaround')).toEqual([1])
    expect(bestIn('Min credit score')).toEqual([2])
    expect(bestIn('Collateral required')).toEqual([2])
  })

  it('highlights ties and skips rows where every value is equal', () => {
    const { bestIn } = render([midwest, atlas])
    // Both need 680+, so there's nothing to call out.
    expect(bestIn('Min credit score')).toEqual([])
    // Rows without a "better" direction never highlight.
    expect(bestIn('Loan amount')).toEqual([])
    expect(bestIn('Special requirements')).toEqual([])
  })

  it('gives screen readers a text label for best cells only', () => {
    const { doc } = render([midwest, atlas])
    for (const td of doc.querySelectorAll('td')) {
      const label = td.querySelector('.sr-only')?.textContent?.trim() ?? null
      expect(label).toBe(td.classList.contains('is-best') ? '(best)' : null)
    }
  })

  it('flags programs that no longer match the current filters', () => {
    // Midwest 504 starts at $125K, so a $50K loan rules it out.
    const { doc } = render([midwest, atlas], { ...EMPTY_FILTERS, amount: 50_000 })
    const tags = [...doc.querySelectorAll('thead th')].map((th) => th.querySelector('.badge-mismatch')?.textContent ?? null)
    expect(tags).toEqual(["✕ Doesn't match current filters", null])
  })

  it('does not flag anything when no filters are set', () => {
    expect(render([midwest, atlas]).doc.querySelector('.badge-mismatch')).toBeNull()
  })

  it('shows special requirements and placeholders for missing values', () => {
    const { html } = render([midwest, atlas])
    expect(html).toContain('Owner must have 20%+ equity stake')
    expect(html).toContain('None')
  })

  it('gives each remove button an accessible name', () => {
    const { doc } = render([midwest, atlas])
    const labels = [...doc.querySelectorAll('.remove-button')].map((b) => b.getAttribute('aria-label'))
    expect(labels).toEqual([
      'Remove Midwest Business Finance 504 Loan from comparison',
      'Remove Atlas Financial Services SBA Express from comparison',
    ])
  })
})
