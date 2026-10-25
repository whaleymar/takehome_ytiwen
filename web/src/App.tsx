import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPrograms } from './api'
import DataErrorBanner from './components/DataErrorBanner'
import FilterBar from './components/FilterBar'
import ProgramCard from './components/ProgramCard'
import { EMPTY_FILTERS, SORT_OPTIONS, isEligible, sortPrograms, type Filters, type SortKey } from './filters'
import { isoDate } from './format'
import type { ProgramsResponse } from './types'
import { readState, writeState, type AppState } from './urlState'

export default function App() {
  const [data, setData] = useState<ProgramsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<AppState>(() => readState(window.location.search))
  const { filters, sort, openId } = state

  useEffect(() => {
    fetchPrograms().then(setData, (e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    const onPop = () => setState(readState(window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Filter edits replace the history entry so Back isn't flooded with keystrokes;
  // opening a program pushes one so Back collapses it.
  function update(next: AppState, push = false) {
    const url = window.location.pathname + writeState(next)
    if (push) window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
    setState(next)
  }

  const setFilters = (f: Filters) => update({ ...state, filters: f })
  const setSort = (s: SortKey) => update({ ...state, sort: s })
  const toggleOpen = (id: string) => update({ ...state, openId: openId === id ? null : id }, true)

  const visible = useMemo(
    () => (data ? sortPrograms(data.programs.filter((p) => isEligible(p, filters)), sort) : []),
    [data, filters, sort],
  )

  // When arriving from a shared link, bring the opened program into view once.
  const scrolled = useRef(false)
  useEffect(() => {
    if (!data || scrolled.current) return
    scrolled.current = true
    if (openId) document.getElementById(openId)?.scrollIntoView({ block: 'center' })
  }, [data, openId])

  return (
    <div className="app">
      <header className="app-header">
        <h1>SBA Program Finder</h1>
        {data?.asOf && <span className="as-of">Rates as of {isoDate(data.asOf)}</span>}
      </header>

      {error && <p className="error">{error}. Is the API server running?</p>}

      {data && (
        <>
          <DataErrorBanner errors={data.dataErrors} />
          <FilterBar filters={filters} facets={data.facets} onChange={setFilters} />

          <div className="results-bar">
            <span className="count">
              <strong>{visible.length}</strong> of {data.programs.length} programs match
            </span>
            <label className="sort">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {visible.length === 0 ? (
            <div className="empty">
              <p>No programs match these details.</p>
              <button type="button" className="link-button" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear all filters
              </button>
            </div>
          ) : (
            <ul className="program-list">
              {visible.map((p) => (
                <li key={p.id}>
                  <ProgramCard
                    program={p}
                    expanded={p.id === openId}
                    recentUpdateDays={data.recentUpdateDays}
                    onToggle={() => toggleOpen(p.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {!data && !error && <p className="loading">Loading programs…</p>}
    </div>
  )
}
