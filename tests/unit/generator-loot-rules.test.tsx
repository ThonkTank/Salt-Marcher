// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeneratorLootRulesEditor } from '../../src/renderer/features/workspace/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../src/shared/generator/default-loot-rules.js'

afterEach(cleanup)

describe('GeneratorLootRulesEditor', () => {
  it('edits rule values while keeping levels and denomination IDs typed', () => {
    const changed = vi.fn()
    render(
      <GeneratorLootRulesEditor
        value={defaultGeneratorLootRules}
        changed={changed}
      />
    )

    const levels = screen.getAllByLabelText('Level')
    expect(levels).toHaveLength(20)
    expect(levels.every((level) => level.tagName === 'OUTPUT')).toBe(true)

    const profileDenominations = screen.getAllByLabelText('Denominations 1')
    expect(profileDenominations).toHaveLength(9)
    expect(
      profileDenominations.every((field) => field.tagName === 'SELECT')
    ).toBe(true)

    fireEvent.change(screen.getAllByLabelText('Gold At Level Cp')[0]!, {
      target: { value: '12345' }
    })
    expect(changed).toHaveBeenCalledWith({
      ...defaultGeneratorLootRules,
      progression: [
        {
          ...defaultGeneratorLootRules.progression[0],
          goldAtLevelCp: 12_345
        },
        ...defaultGeneratorLootRules.progression.slice(1)
      ]
    })
  })
})
