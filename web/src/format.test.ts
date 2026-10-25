import { afterAll, describe, expect, it, vi } from 'vitest'
import { businessTypes, capitalize, isoDate, money, moneyFull, percent, term, years } from './format'

// Reps are in US time zones, behind UTC. Parsing "2026-01-16" as UTC midnight
// would show Jan 15 there, so run these tests in one.
vi.stubEnv('TZ', 'America/Los_Angeles')
afterAll(() => {
  vi.unstubAllEnvs()
})

describe('isoDate', () => {
  it.each([
    ['2026-01-16', 'Jan 16, 2026'],
    ['2026-02-01', 'Feb 1, 2026'],
    ['2026-12-31', 'Dec 31, 2026'],
  ])('formats %s without shifting the day', (iso, expected) => {
    expect(isoDate(iso)).toBe(expected)
  })

  it('runs in a time zone behind UTC', () => {
    expect(new Date(2026, 0, 16).getTimezoneOffset()).toBeGreaterThan(0)
  })
})

describe('money', () => {
  it.each([
    [10_000, '$10K'],
    [250_000, '$250K'],
    [5_000_000, '$5M'],
    [5_500_000, '$5.5M'],
  ])('compacts %i to %s', (n, expected) => {
    expect(money(n)).toBe(expected)
  })

  it('formats full amounts with separators and no cents', () => {
    expect(moneyFull(250_000)).toBe('$250,000')
    expect(moneyFull(5_500_000)).toBe('$5,500,000')
  })
})

describe('percent', () => {
  it.each([
    [11, '11.0%'],
    [13.6, '13.6%'],
    [5.5, '5.5%'],
  ])('formats %d as %s', (n, expected) => {
    expect(percent(n)).toBe(expected)
  })
})

describe('term', () => {
  it.each([
    [84, '7 yrs'],
    [120, '10 yrs'],
    [300, '25 yrs'],
    [90, '90 mo'],
  ])('formats %i months as %s', (months, expected) => {
    expect(term(months)).toBe(expected)
  })
})

describe('years', () => {
  it.each([
    [1, '1+ yr'],
    [2, '2+ yrs'],
    [0.5, '0.5+ yrs'],
    [0, '0+ yrs'],
  ])('formats %d as %s', (n, expected) => {
    expect(years(n)).toBe(expected)
  })
})

describe('businessTypes', () => {
  it('treats null as all types', () => {
    expect(businessTypes(null)).toBe('All types')
  })

  it('marks listed types as exclusive', () => {
    expect(businessTypes(['Retail'])).toBe('Retail only')
  })
})

describe('capitalize', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('good')).toBe('Good')
    expect(capitalize('')).toBe('')
  })
})
