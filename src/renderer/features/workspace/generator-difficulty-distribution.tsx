import { useRef } from 'react'
import type { GeneratorPresetConfigV3 } from '../../../shared/contracts/generator-presets.js'
import { message } from '../../i18n/generator-runtime.de.js'

const difficultyBands = [
  ['trivial', 'g.difficulty.trivial'],
  ['easy', 'g.easy'],
  ['medium', 'g.medium'],
  ['hard', 'g.hard'],
  ['deadly', 'g.deadly']
] as const

type Drag = Readonly<{
  pointerId: number
  boundary: number
  startX: number
  base: GeneratorPresetConfigV3['scene']['difficultyWeights']
  config: GeneratorPresetConfigV3
}> & { lastDelta: number }

export function GeneratorDifficultyDistribution(props: {
  config: GeneratorPresetConfigV3
  changed: (config: GeneratorPresetConfigV3) => void
}) {
  const bar = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const weights = props.config.scene.difficultyWeights
  const maxWeight = Math.max(1, ...Object.values(weights))
  const endDrag = () => {
    drag.current = null
  }

  return (
    <section className="difficulty-rules">
      <h4>{message('g.difficulty')}</h4>
      <div ref={bar} className="difficulty-bar">
        {difficultyBands.map(([key], index) => {
          const next = difficultyBands[index + 1]
          return (
            <div key={key} style={{ flexBasis: `${weights[key]}%` }}>
              <span
                style={{ opacity: 0.35 + 0.65 * (weights[key] / maxWeight) }}
              />
              {next && (
                <button
                  type="button"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Grenze ${message(difficultyBands[index]![1])} zu ${message(next[1])}`}
                  aria-valuemin={0}
                  aria-valuemax={weights[key] + weights[next[0]]}
                  aria-valuenow={weights[key]}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                      return
                    event.preventDefault()
                    updateDifficultyBoundary(
                      index,
                      (event.key === 'ArrowRight' ? 1 : -1) *
                        (event.shiftKey ? 5 : 1),
                      weights,
                      props.config,
                      props.changed
                    )
                  }}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return
                    event.preventDefault()
                    event.currentTarget.setPointerCapture?.(event.pointerId)
                    drag.current = {
                      pointerId: event.pointerId,
                      boundary: index,
                      startX: event.clientX,
                      lastDelta: 0,
                      base: weights,
                      config: props.config
                    }
                  }}
                  onPointerMove={(event) => {
                    const active = drag.current
                    if (!active || active.pointerId !== event.pointerId) return
                    const width =
                      bar.current?.getBoundingClientRect().width ?? 0
                    if (width <= 0) return
                    const delta = Math.round(
                      ((event.clientX - active.startX) / width) * 100
                    )
                    if (delta === active.lastDelta) return
                    active.lastDelta = delta
                    updateDifficultyBoundary(
                      active.boundary,
                      delta,
                      active.base,
                      active.config,
                      props.changed
                    )
                  }}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="difficulty-labels">
        {difficultyBands.map(([key, labelKey]) => (
          <div key={key}>
            <span>{message(labelKey)}</span>
            <strong>{weights[key]} %</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function updateDifficultyBoundary(
  boundary: number,
  delta: number,
  base: GeneratorPresetConfigV3['scene']['difficultyWeights'],
  config: GeneratorPresetConfigV3,
  changed: (config: GeneratorPresetConfigV3) => void
) {
  const leftKey = difficultyBands[boundary]?.[0]
  const rightKey = difficultyBands[boundary + 1]?.[0]
  if (!leftKey || !rightKey) return
  const clamped = clamp(delta, -base[leftKey], base[rightKey])
  changed({
    ...config,
    scene: {
      difficultyWeights: {
        ...base,
        [leftKey]: base[leftKey] + clamped,
        [rightKey]: base[rightKey] - clamped
      }
    }
  })
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
