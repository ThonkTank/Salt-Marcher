// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeneratorLootRulesEditor } from '../../src/renderer/features/workspace/generator-loot-rules.js'
import type { GeneratorLootRules } from '../../src/shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../src/shared/generator/default-loot-rules.js'

afterEach(cleanup)

describe('generator loot rules editor', () => {
  it('uses German metadata, schema bounds, and inline field errors', () => {
    let latest: GeneratorLootRules = defaultGeneratorLootRules
    const changed = vi.fn((value: GeneratorLootRules) => {
      latest = value
    })
    const { rerender } = render(
      <GeneratorLootRulesEditor
        value={defaultGeneratorLootRules}
        changed={changed}
      />
    )

    const slotMinimum = screen.getByRole('spinbutton', {
      name: /^Minimale Slots/
    })
    expect(slotMinimum).toHaveAttribute('min', '1')
    expect(screen.queryByText('Slot min')).not.toBeInTheDocument()

    fireEvent.change(slotMinimum, { target: { value: '0' } })
    rerender(<GeneratorLootRulesEditor value={latest} changed={changed} />)
    expect(
      screen.getByText('Der Wert liegt unter dem zulässigen Minimum.')
    ).toHaveAttribute('role', 'alert')
  })
})
