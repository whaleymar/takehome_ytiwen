// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import fixture from '../__fixtures__/programs.json'
import { byText, click, mount } from '../test/dom'
import type { Program, ProgramsResponse } from '../types'
import CompareTray from './CompareTray'

const { programs } = fixture as ProgramsResponse
const [a, b, c] = programs

function setup(selected: Program[]) {
  const props = { programs: selected, onRemove: vi.fn(), onClear: vi.fn(), onOpen: vi.fn() }
  const root = mount(<CompareTray {...props} />)
  const compare = root.querySelector<HTMLButtonElement>('.primary-button')
  return { ...props, root, compare }
}

describe('CompareTray', () => {
  it('renders nothing with no programs', () => {
    expect(setup([]).root.innerHTML).toBe('')
  })

  it('asks for one more program and disables Compare with one selected', () => {
    const { root, compare, onOpen } = setup([a])
    expect(root.textContent).toContain('Select 1 more to compare')
    expect(compare!.disabled).toBe(true)
    click(compare)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it.each([
    [2, [a, b]],
    [3, [a, b, c]],
  ])('enables Compare with %i selected', (n, selected) => {
    const { root, compare, onOpen } = setup(selected)
    expect(root.textContent).toContain(`${n} of 3 selected`)
    expect(compare!.textContent).toBe(`Compare ${n}`)
    click(compare)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('lists each program and removes the right one', () => {
    const { root, onRemove } = setup([a, b])
    expect([...root.querySelectorAll('.compare-tray-item strong')].map((e) => e.textContent)).toEqual([a.lender, b.lender])
    click(root.querySelector(`button[aria-label="Remove ${b.lender} ${b.programType} from comparison"]`))
    expect(onRemove).toHaveBeenCalledWith(b.id)
  })

  it('clears the selection', () => {
    const { root, onClear } = setup([a, b])
    click(byText(root, 'button', 'Clear'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
