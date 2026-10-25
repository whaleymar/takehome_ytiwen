import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import DataErrorBanner from './DataErrorBanner'

const render = (errors: Parameters<typeof DataErrorBanner>[0]['errors']) =>
  renderToStaticMarkup(<DataErrorBanner errors={errors} />)

describe('DataErrorBanner', () => {
  it('renders nothing when there are no errors', () => {
    expect(render([])).toBe('')
  })

  it('lists each error with its line and tells the rep to contact an admin', () => {
    const html = render([
      { line: 3, message: "interest_rate_min: Input should be greater than or equal to 0 (got '-1')" },
      { line: 6, message: 'Duplicate of Good One P on line 2' },
    ])

    expect(html).toContain('role="alert"')
    expect(html).toContain('contact an admin')
    expect(html).toContain('2 problems')
    expect(html).toContain('Line 3')
    expect(html).toContain('interest_rate_min: Input should be greater than or equal to 0 (got &#x27;-1&#x27;)')
    expect(html).toContain('Line 6')
    expect(html).toContain('Duplicate of Good One P on line 2')
  })

  it('uses singular wording for one error', () => {
    expect(render([{ line: 1, message: 'Header is missing column(s): lender_name' }])).toContain('1 problem below')
  })

  it('escapes CSV content rather than rendering it as HTML', () => {
    const html = render([{ line: 2, message: "lender_name: bad (got '<img src=x onerror=alert(1)>')" }])
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})
