// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceErrors } from '../../src/renderer/features/workspace/workspace-errors.js'

afterEach(cleanup)

describe('workspace error presentation', () => {
  it('stacks immutable alerts and dismisses only the selected message', () => {
    const dismiss = vi.fn()
    const { container } = render(
      <main>
        <div className="work-area" />
        <WorkspaceErrors
          errors={[
            {
              id: 1,
              scope: 'settings',
              code: 'settings.operation',
              message: 'Ein interner Fehler ist aufgetreten.'
            },
            {
              id: 2,
              scope: 'workspace',
              code: 'feature.operation',
              message: 'Der Katalog ist nicht erreichbar.'
            }
          ]}
          dismiss={dismiss}
        />
      </main>
    )

    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(container.querySelector('.workspace-error-stack')).toContainElement(
      alerts[0]!
    )
    expect(alerts[0]!.closest('.work-area')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Schließen' })[1]!)
    expect(dismiss).toHaveBeenCalledOnce()
    expect(dismiss).toHaveBeenCalledWith(2)
  })

  it('renders no stack when there are no errors', () => {
    const { container } = render(
      <WorkspaceErrors errors={[]} dismiss={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
