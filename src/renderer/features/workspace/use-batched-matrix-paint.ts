import { useCallback, useEffect, useRef } from 'react'
import type {
  GeneratorPresetConfigV3,
  GeneratorRoleCell
} from '../../../shared/contracts/generator-presets.js'
import {
  generatorChallengeRatings,
  roleAt,
  updateRoleCell
} from '../../../shared/generator/generator-config-model.js'

export function useBatchedMatrixPaint(
  config: GeneratorPresetConfigV3,
  changed: (config: GeneratorPresetConfigV3) => void
) {
  const latest = useRef(config)
  const pending = useRef(new Map<number, GeneratorRoleCell>())
  const frame = useRef<number | null>(null)

  useEffect(() => {
    latest.current = config
  }, [config])

  const flush = useCallback(() => {
    if (frame.current !== null) cancelFrame(frame.current)
    frame.current = null
    if (pending.current.size === 0) return
    const current = latest.current
    let matrix = current.composition.roleMatrix
    for (const [index, role] of pending.current) {
      const level = Math.floor(index / generatorChallengeRatings.length) + 1
      const cr = index % generatorChallengeRatings.length
      if (roleAt(matrix, level, cr) !== role)
        matrix = updateRoleCell(matrix, level, cr, role)
    }
    pending.current.clear()
    if (matrix === current.composition.roleMatrix) return
    latest.current = {
      ...current,
      composition: { ...current.composition, roleMatrix: matrix }
    }
    changed(latest.current)
  }, [changed])

  const queue = useCallback(
    (index: number, role: GeneratorRoleCell) => {
      pending.current.set(index, role)
      if (frame.current === null) frame.current = scheduleFrame(flush)
    },
    [flush]
  )

  useEffect(
    () => () => {
      if (frame.current !== null) cancelFrame(frame.current)
    },
    []
  )

  return { queue, flush }
}

function scheduleFrame(callback: FrameRequestCallback): number {
  return typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(callback)
    : window.setTimeout(() => callback(performance.now()), 16)
}

function cancelFrame(id: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id)
  else window.clearTimeout(id)
}
