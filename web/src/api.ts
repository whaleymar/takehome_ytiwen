import type { ProgramsResponse } from './types'

export async function fetchPrograms(): Promise<ProgramsResponse> {
  const res = await fetch('/api/programs')
  if (!res.ok) throw new Error(`Failed to load programs (${res.status})`)
  return res.json()
}
