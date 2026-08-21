import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSearch,
  DropdownMenuTrigger
} from './dropdown-menu'

afterEach(cleanup)

describe('DropdownMenuSearch', () => {
  it('keeps filter typing out of Radix typeahead while preserving menu navigation keys', () => {
    const bubbled = vi.fn()
    const onValueChange = vi.fn()

    render(
      <div onKeyDown={bubbled}>
        <DropdownMenuSearch aria-label="Filter Agents" onValueChange={onValueChange} />
      </div>
    )

    const input = screen.getByRole('textbox', { name: 'Filter Agents' })

    fireEvent.keyDown(input, { key: 'a' })
    expect(bubbled).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'analysis' } })
    expect(onValueChange).toHaveBeenCalledWith('analysis')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(bubbled.mock.calls.map(([event]) => event.key)).toEqual(['ArrowDown', 'Escape'])
  })

  it('moves from search to a checkbox item and supports Enter and Escape', async () => {
    function Harness() {
      const [checked, setChecked] = useState(false)

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button">Agents</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSearch aria-label="Filter Agents" />
            <DropdownMenuCheckboxItem
              checked={checked}
              onCheckedChange={value => setChecked(value === true)}
              onSelect={event => event.preventDefault()}
            >
              Researcher
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }

    const trigger = render(<Harness />).getByRole('button', { name: 'Agents' })
    fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' })
    fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse' })
    fireEvent.click(trigger)

    const input = await screen.findByRole('textbox', { name: 'Filter Agents' })
    const candidate = await screen.findByRole('menuitemcheckbox', { name: 'Researcher' })

    await waitFor(() => expect(globalThis.document.activeElement).toBe(input))
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => expect(globalThis.document.activeElement).toBe(candidate))

    fireEvent.keyDown(candidate, { key: 'Enter' })
    await waitFor(() => expect(candidate.getAttribute('aria-checked')).toBe('true'))

    fireEvent.keyDown(candidate, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menuitemcheckbox')).toBeNull())
    expect(globalThis.document.activeElement).toBe(trigger)
  })

  it('activates the first enabled item when Enter is not claimed', async () => {
    const onSelect = vi.fn((event: Event) => event.preventDefault())

    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Agents</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSearch aria-label="Filter Agents" />
          <DropdownMenuCheckboxItem checked={false} onSelect={onSelect}>
            Researcher
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    const input = await screen.findByRole('textbox', { name: 'Filter Agents' })
    await waitFor(() => expect(globalThis.document.activeElement).toBe(input))
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('does not activate a DOM item when the consumer claims Enter', async () => {
    const onSelect = vi.fn((event: Event) => event.preventDefault())
    const onCommit = vi.fn()

    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Models</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSearch
            aria-label="Search models"
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.stopPropagation()
                onCommit()
              }
            }}
          />
          <DropdownMenuCheckboxItem checked={false} onSelect={onSelect}>
            Provider header
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    const input = await screen.findByRole('textbox', { name: 'Search models' })
    await waitFor(() => expect(globalThis.document.activeElement).toBe(input))
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onCommit).toHaveBeenCalledOnce()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
