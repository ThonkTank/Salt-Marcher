// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HexSlider } from '../../src/renderer/features/hex/hex-slider.js'
import { sliderValueAtClientX } from '../../src/renderer/features/hex/hex-slider-geometry.js'

afterEach(cleanup)

describe('hex editor slider', () => {
  it('clamps and rounds pointer positions with pure geometry', () => {
    expect(sliderValueAtClientX(50, 50, 100, 1, 10)).toBe(1)
    expect(sliderValueAtClientX(100, 50, 100, 1, 10)).toBe(6)
    expect(sliderValueAtClientX(200, 50, 100, 1, 10)).toBe(10)
    expect(sliderValueAtClientX(100, 50, 0, 1, 10)).toBe(1)
  })

  it('exposes slider semantics and supports keyboard changes and commits', () => {
    const change = vi.fn()
    const commit = vi.fn()
    render(
      <HexSlider
        value={4}
        min={1}
        max={10}
        ariaLabel="Pinselgröße"
        ticks={10}
        onChange={change}
        onCommit={commit}
      />
    )
    const slider = screen.getByRole('slider', { name: 'Pinselgröße' })
    expect(slider).toHaveAttribute('aria-valuenow', '4')
    expect(slider.querySelectorAll('.hex-slider-ticks i')).toHaveLength(10)
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(change).toHaveBeenCalledWith(5)
    expect(commit).toHaveBeenCalledOnce()
  })

  it('updates before pointer capture and commits on pointer release', () => {
    const change = vi.fn()
    const commit = vi.fn()
    render(
      <HexSlider
        value={24}
        min={24}
        max={80}
        ariaLabel="Symbolgröße"
        onChange={change}
        onCommit={commit}
      />
    )
    const slider = screen.getByRole('slider')
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 0,
      left: 10,
      right: 110,
      top: 0,
      bottom: 10,
      width: 100,
      height: 10,
      toJSON: () => ({})
    })
    fireEvent.pointerDown(slider, {
      button: 0,
      pointerId: 3,
      clientX: 60
    })
    fireEvent.pointerUp(slider, { pointerId: 3, clientX: 110 })
    expect(change).toHaveBeenCalledWith(52)
    expect(change).toHaveBeenLastCalledWith(80)
    expect(commit).toHaveBeenCalledOnce()
  })
})
