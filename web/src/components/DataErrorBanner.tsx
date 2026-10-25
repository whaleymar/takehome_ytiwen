import type { DataError } from '../types'

export default function DataErrorBanner({ errors }: { errors: DataError[] }) {
  if (errors.length === 0) return null

  const count = errors.length === 1 ? '1 problem' : `${errors.length} problems`
  return (
    <section className="data-errors" role="alert">
      <p>
        <strong>Some lender data couldn't be loaded, so results may be missing programs.</strong> Please contact an
        admin and share the {count} below.
      </p>
      <ul>
        {errors.map((e) => (
          <li key={`${e.line}:${e.message}`}>
            <span className="line">Line {e.line}</span> {e.message}
          </li>
        ))}
      </ul>
    </section>
  )
}
