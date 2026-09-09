// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlannerMaintenanceRuntime } from '../../src/renderer/features/session-planner/planner-maintenance-runtime.js'
import { PlannerRecoveryNotice } from '../../src/renderer/features/session-planner/planner-recovery-notice.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

describe('Planner recovery notice', () => {
  it('runs the held read from the visible button, disables duplicate clicks, and clears the notice', async () => {
    const runtime = new PlannerMaintenanceRuntime()
    let finish!: (result: boolean) => void
    const gate = new Promise<boolean>((resolve) => {
      finish = resolve
    })
    const read = vi.fn().mockReturnValue(gate)
    runtime.failed(new CapabilityError('outcome_unknown', false), read)
    function Harness() {
      useSyncExternalStore(runtime.subscribe, runtime.snapshot)
      return (
        <PlannerRecoveryNotice
          uncertain={runtime.uncertain()}
          canReconcile={runtime.canReconcile()}
          blocked={runtime.pending()}
          retry={async () => {
            await runtime.run(() => runtime.reconcileUnknown())
          }}
        />
      )
    }
    render(<Harness />)
    const button = screen.getByRole('button', {
      name: 'Speicherstand erneut prüfen'
    })
    fireEvent.click(button)
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(button)
    await act(async () => {
      await Promise.resolve()
    })
    expect(read).toHaveBeenCalledOnce()
    await act(async () => {
      finish(true)
      await gate
    })
    expect(screen.queryByRole('status')).toBeNull()
    expect(runtime.uncertain()).toBe(false)
  })
})
