import { MAX_COMPARE } from '../compare'
import type { Program } from '../types'

interface Props {
  programs: Program[]
  onRemove: (id: string) => void
  onClear: () => void
  onOpen: () => void
}

export default function CompareTray({ programs, onRemove, onClear, onOpen }: Props) {
  if (programs.length === 0) return null

  const ready = programs.length >= 2
  return (
    <aside className="compare-tray" aria-label="Programs selected for comparison">
      <div className="compare-tray-inner">
        <ul className="compare-tray-items">
          {programs.map((p) => (
            <li key={p.id} className="compare-tray-item">
              <span>
                <strong>{p.lender}</strong> {p.programType}
              </span>
              <button type="button" aria-label={`Remove ${p.lender} ${p.programType} from comparison`} onClick={() => onRemove(p.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="compare-tray-actions">
          <span className="compare-tray-hint" aria-live="polite">
            {ready ? `${programs.length} of ${MAX_COMPARE} selected` : 'Select 1 more to compare'}
          </span>
          <button type="button" className="link-button" onClick={onClear}>
            Clear
          </button>
          <button type="button" className="primary-button" disabled={!ready} onClick={onOpen}>
            Compare {programs.length}
          </button>
        </div>
      </div>
    </aside>
  )
}
