import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPrograms } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPrograms', () => {
  it('requests the programs endpoint and returns the body', async () => {
    const body = { programs: [] }
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) })
    vi.stubGlobal('fetch', fetch)
    await expect(fetchPrograms()).resolves.toBe(body)
    expect(fetch).toHaveBeenCalledWith('/api/programs')
  })

  it('reports the status for an error response without parsing the body', async () => {
    const json = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json }))
    await expect(fetchPrograms()).rejects.toThrow('Failed to load programs (500)')
    expect(json).not.toHaveBeenCalled()
  })

  it('passes network failures through', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(fetchPrograms()).rejects.toThrow('Failed to fetch')
  })
})
