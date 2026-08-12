import type {
  SaveSessionPlanInput,
  SessionPlannerScene
} from '../../../shared/contracts/session-planner.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import {
  emptyPlannerScene,
  normalizePlannerScenes,
  plannerSceneTitle
} from './planner-scene-helpers.js'

export function SceneSequence(props: {
  draft: SaveSessionPlanInput
  mutate: (
    update: (draft: SaveSessionPlanInput) => SaveSessionPlanInput
  ) => void
  patchScene: (sceneId: string, patch: Partial<SessionPlannerScene>) => void
}) {
  function reorder(position: number, delta: -1 | 1): void {
    props.mutate((current) => {
      const scenes = [...current.scenes]
      const target = position + delta
      ;[scenes[position], scenes[target]] = [scenes[target]!, scenes[position]!]
      return { ...current, scenes: normalizePlannerScenes(scenes) }
    })
  }

  return (
    <aside
      className="planner-scene-list"
      aria-label={message('planner.sceneSequence')}
    >
      <header>
        <div>
          <p className="section-kicker">{message('planner.flow')}</p>
          <h2>{message('planner.scenes')}</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            const id = crypto.randomUUID()
            props.mutate((current) => ({
              ...current,
              selectedSceneId: id,
              scenes: [
                ...current.scenes,
                emptyPlannerScene(id, current.scenes.length)
              ]
            }))
          }}
        >
          {message('planner.sceneAdd')}
        </button>
      </header>
      {props.draft.scenes.length === 0 ? (
        <p className="planner-empty">{message('planner.sceneEmpty')}</p>
      ) : (
        <ol>
          {props.draft.scenes.map((scene, position) => (
            <li key={scene.id}>
              <button
                type="button"
                className={
                  scene.id === props.draft.selectedSceneId ? 'selected' : ''
                }
                aria-current={
                  scene.id === props.draft.selectedSceneId ? 'true' : undefined
                }
                onClick={() =>
                  props.mutate((current) => ({
                    ...current,
                    selectedSceneId: scene.id
                  }))
                }
              >
                <span>{position + 1}</span>
                <strong>{plannerSceneTitle(scene, position)}</strong>
                <small>
                  {scene.encounterPlanId
                    ? message('planner.encounters')
                    : message('planner.freeScene')}{' '}
                  ·{' '}
                  {formatMessage('planner.rewardCount', {
                    count: scene.generatedRewards.length
                  })}
                </small>
              </button>
              <div className="planner-order-actions">
                <button
                  type="button"
                  aria-label={formatMessage('planner.sceneMoveUp', {
                    name: plannerSceneTitle(scene, position)
                  })}
                  disabled={position === 0}
                  onClick={() => reorder(position, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={formatMessage('planner.sceneMoveDown', {
                    name: plannerSceneTitle(scene, position)
                  })}
                  disabled={position === props.draft.scenes.length - 1}
                  onClick={() => reorder(position, 1)}
                >
                  ↓
                </button>
              </div>
              {position < props.draft.scenes.length - 1 && (
                <label className="planner-rest-gap">
                  <span>{message('planner.after')}</span>
                  <select
                    value={scene.restAfter ?? ''}
                    onChange={(event) =>
                      props.patchScene(scene.id, {
                        restAfter:
                          (event.target.value as 'short' | 'long') || null
                      })
                    }
                  >
                    <option value="">{message('planner.noRest')}</option>
                    <option value="short">
                      {message('planner.shortRest')}
                    </option>
                    <option value="long">{message('planner.longRest')}</option>
                  </select>
                </label>
              )}
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
