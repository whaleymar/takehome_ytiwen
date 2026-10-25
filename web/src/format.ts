const compactUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
})

const fullUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const money = (n: number) => compactUsd.format(n)
export const moneyFull = (n: number) => fullUsd.format(n)

export const percent = (n: number) => `${n.toFixed(1)}%`

export function term(months: number): string {
  const years = months / 12
  return Number.isInteger(years) ? `${years} yrs` : `${months} mo`
}

export function years(n: number): string {
  return `${n}+ ${n === 1 ? 'yr' : 'yrs'}`
}

/** Formats an ISO date ("2026-01-16") without timezone shifting. */
export function isoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
