// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopSceneFacts } from '../../src/renderer/features/scene-desktop/desktop-overview.js'
import type {
  SessionWorkspaceActions,
  SessionWorkspaceViewModel
} from '../../src/renderer/features/session/session-workspace-model.js'

afterEach(cleanup)
describe('regular scene overview', () => {
  it('keeps location editing local and opens character management through quickinfos', () => {
    const setSceneLocation = vi.fn()
    const model = {
      focused: {
        id: 'scene',
        locationId: null,
        gameTimeSeconds: 0,
        partyMemberIds: []
      },
      snapshot: { party: { members: [] } },
      control: {
        focusedLocationLabel: 'Kein Ort',
        locationUnavailable: false,
        locationChoices: [{ id: 'harbour', displayName: 'Hafen' }]
      },
      groups: { activeRows: [], archivedRows: [] }
    } as unknown as SessionWorkspaceViewModel
    const actions = {
      setSceneLocation,
      manageGroups: vi.fn()
    } as unknown as SessionWorkspaceActions
    render(<DesktopSceneFacts model={model} actions={actions} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Kein Ort' }))
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'harbour' }
    })
    expect(setSceneLocation).toHaveBeenCalledWith('harbour')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
