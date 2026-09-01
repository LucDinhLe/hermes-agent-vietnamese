import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { registry } from '@/contrib/registry'

import { SESSION_CONTROLS_AREA, SessionControlsSlot } from './session-controls-slot'

let dispose = () => {}

afterEach(() => {
  cleanup()
  dispose()

  dispose = () => {}
})

describe('session controls presentation seam', () => {
  it('stays absent without a contribution and mounts the strip in the chat clipping boundary', () => {
    const view = render(<SessionControlsSlot />)

    expect(view.container.querySelector('[data-session-controls-slot]')).toBeNull()

    act(() => {
      dispose = registry.register({
        area: SESSION_CONTROLS_AREA,
        id: 'fixture',
        render: () => <button>Gateway fixture</button>,
        source: 'test'
      })
    })

    expect(view.container.querySelector('[data-session-controls-slot]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Gateway fixture' })).toBeTruthy()
  })
})
