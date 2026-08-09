import { useEffect, useRef, useState } from 'react'
import type {
  GeneratorPresetConfigV3,
  GeneratorRoleCell
} from '../../../shared/contracts/generator-presets.js'
import {
  generatorChallengeRatings,
  generatorRoles,
  roleAt
} from '../../../shared/generator/generator-config-model.js'
import { message } from '../../i18n/generator-runtime.de.js'
import { roleName, roleShort } from './generator-presentation.js'
import { useBatchedMatrixPaint } from './use-batched-matrix-paint.js'

const matrixNavigation: Readonly<
  Record<string, readonly [level: number, cr: number]>
> = {
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0]
}

export function GeneratorRoleMatrix(props: {
  config: GeneratorPresetConfigV3
  changed: (config: GeneratorPresetConfigV3) => void
}) {
  const [brush, setBrush] = useState<GeneratorRoleCell>('none')
  const [focusIndex, setFocusIndex] = useState(0)
  const painting = useRef(false)
  const brushRef = useRef<GeneratorRoleCell>('none')
  const matrix = useRef<HTMLDivElement>(null)
  const { queue, flush } = useBatchedMatrixPaint(props.config, props.changed)

  useEffect(() => {
    const stop = () => {
      flush()
      painting.current = false
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [flush])

  const paintNow = (index: number, role: GeneratorRoleCell) => {
    queue(index, role)
    flush()
  }
  const focusCell = (level: number, cr: number) => {
    const nextLevel = clamp(level, 0, 19)
    const nextCr = clamp(cr, 0, generatorChallengeRatings.length - 1)
    const index = nextLevel * generatorChallengeRatings.length + nextCr
    setFocusIndex(index)
    matrix.current
      ?.querySelector<HTMLButtonElement>(
        `[data-matrix-level="${nextLevel}"][data-matrix-cr="${nextCr}"]`
      )
      ?.focus()
  }

  return (
    <>
      <div className="role-brush" aria-label={message('g.brush')}>
        {(['none', ...generatorRoles] as const).map((role) => (
          <button
            type="button"
            key={role}
            className={`role-control role-${role}`}
            aria-pressed={brush === role}
            onClick={() => {
              brushRef.current = role
              setBrush(role)
            }}
          >
            <i aria-hidden="true" />
            {roleName(role)}
          </button>
        ))}
      </div>

      <div ref={matrix} className="role-matrix-scroll">
        <table className="role-matrix">
          <thead>
            <tr>
              <th>{message('g.matrixHeader')}</th>
              {generatorChallengeRatings.map((rating) => (
                <th key={rating}>{fractionLabel(rating)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 20 }, (_, level) => (
              <tr key={level + 1}>
                <th>{level + 1}</th>
                {generatorChallengeRatings.map((_, cr) => {
                  const index = level * generatorChallengeRatings.length + cr
                  const role = roleAt(
                    props.config.composition.roleMatrix,
                    level + 1,
                    cr
                  )
                  return (
                    <td key={cr}>
                      <button
                        type="button"
                        data-matrix-level={level}
                        data-matrix-cr={cr}
                        className={`role-${role}`}
                        aria-label={`Level ${level + 1}, CR ${generatorChallengeRatings[cr]}: ${roleName(role)}`}
                        tabIndex={focusIndex === index ? 0 : -1}
                        onFocus={() => setFocusIndex(index)}
                        onClick={() => paintNow(index, brushRef.current)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            paintNow(index, brushRef.current)
                            return
                          }
                          const delta = matrixNavigation[event.key]
                          if (delta) {
                            event.preventDefault()
                            focusCell(level + delta[0], cr + delta[1])
                          } else if (event.key === 'Home') {
                            event.preventDefault()
                            focusCell(level, 0)
                          } else if (event.key === 'End') {
                            event.preventDefault()
                            focusCell(
                              level,
                              generatorChallengeRatings.length - 1
                            )
                          }
                        }}
                        onPointerDown={(event) => {
                          if (event.button !== 0) return
                          event.preventDefault()
                          painting.current = true
                          queue(index, brushRef.current)
                        }}
                        onPointerEnter={() => {
                          if (painting.current) queue(index, brushRef.current)
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault()
                          paintNow(index, 'none')
                        }}
                      >
                        {roleShort(role)}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function fractionLabel(value: string): string {
  return { '1/8': '⅛', '1/4': '¼', '1/2': '½' }[value] ?? value
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
