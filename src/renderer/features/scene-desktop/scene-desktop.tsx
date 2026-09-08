import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { WorkspaceSurfaceProps } from '../workspace/workspace-surface-props.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { useSessionMutationController } from '../session/use-session-mutation-controller.js'
import { useSessionSceneController } from '../session/use-session-scene-controller.js'
import { useSceneDesktop } from './use-scene-desktop.js'
import { DesktopWindow } from './desktop-window.js'
import {
  desktopWindowBounds,
  type DesktopSize,
  type SnapSide
} from './desktop-geometry.js'
import { DesktopReader, DesktopSearch } from './desktop-references.js'
import { desktopWindowTitle } from './desktop-window-title.js'
import './scene-desktop.css'

export function SceneDesktop(props: WorkspaceSurfaceProps) {
  const api = useCapabilityApi()
  const { mutateSnapshot } = useSessionMutationController(props)
  const actions = useSessionSceneController({ api, mutateSnapshot })
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const { projection, snapshot } = useSceneDesktop(props.campaignId, focused.id)
  const stage = useRef<HTMLDivElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  const requestedFocus = useRef<{ sceneId: string; windowId: string } | null>(
    null
  )
  useLayoutEffect(() => {
    const request = requestedFocus.current
    requestedFocus.current = null
    if (request?.sceneId === focused.id)
      stage.current
        ?.querySelector<HTMLElement>(`[data-window-id="${request.windowId}"]`)
        ?.focus()
  }, [snapshot.state, focused.id])
  const [size, setSize] = useState<DesktopSize>({ width: 800, height: 600 })
  const [preview, setPreview] = useState<{
    sceneId: string
    side: SnapSide | null
  } | null>(null)
  useEffect(() => {
    const node = stage.current
    if (!node) return
    const measure = () =>
      setSize({
        width: Math.max(1, Math.floor(node.getBoundingClientRect().width)),
        height: Math.max(1, Math.floor(node.getBoundingClientRect().height))
      })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  const windows = snapshot.state?.windows ?? []
  const visible = windows.filter((window) => !window.minimized)
  const raised = visible.at(-1)?.id
  const members = props.snapshot.party.members.filter((member) =>
    focused.partyMemberIds.includes(member.id)
  )
  return (
    <section
      className="scene-desktop"
      data-scene-id={focused.id}
      aria-label={message('desktop.workspace')}
    >
      <header className="desktop-toolbar">
        <label>
          {message('desktop.scene')}
          <select
            aria-label={message('desktop.scene')}
            value={focused.id}
            onChange={(event) => actions.focus(event.target.value)}
          >
            {props.snapshot.scene.scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.title}
              </option>
            ))}
          </select>
        </label>
        <button
          ref={launcher}
          disabled={!snapshot.state || !!snapshot.error}
          onClick={() => {
            requestedFocus.current = {
              sceneId: focused.id,
              windowId: 'overview'
            }
            projection.dispatch({ type: 'open-overview' })
          }}
        >
          {message('desktop.overview')}
        </button>
        <button
          disabled={!snapshot.state || !!snapshot.error}
          onClick={() => {
            requestedFocus.current = { sceneId: focused.id, windowId: 'search' }
            projection.dispatch({ type: 'open-search' })
          }}
        >
          {message('desktop.search')}
        </button>
        <small role="status">
          {snapshot.loading
            ? message('desktop.loading')
            : snapshot.saving
              ? message('desktop.saving')
              : ''}
        </small>
      </header>
      {snapshot.error != null && (
        <div className="desktop-error" role="alert">
          <span>{message('desktop.error')}</span>
          <button onClick={projection.reload}>
            {message('desktop.reload')}
          </button>
        </div>
      )}
      <div ref={stage} className="desktop-stage">
        {[...visible]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((window) => (
            <DesktopWindow
              key={`${focused.id}:${window.id}`}
              window={window}
              title={desktopWindowTitle(window)}
              zIndex={windows.indexOf(window) + 1}
              size={size}
              raised={window.id === raised}
              disabled={!!snapshot.error}
              others={visible
                .filter((other) => other.id !== window.id)
                .map((other) => desktopWindowBounds(other, size))}
              preview={(side) => setPreview({ sceneId: focused.id, side })}
              dispatch={(action) => {
                projection.dispatch(action)
                if (action.type === 'close' || action.type === 'minimize')
                  launcher.current?.focus()
              }}
            >
              {window.kind === 'search' ? (
                <DesktopSearch
                  window={window}
                  dispatch={projection.dispatch.bind(projection)}
                />
              ) : window.kind !== 'overview' ? (
                <DesktopReader
                  window={window}
                  dispatch={projection.dispatch.bind(projection)}
                />
              ) : (
                <>
                  <div className="desktop-scene-facts">
                    <span>{focused.locationName || '—'}</span>
                    <span>
                      {formatMessage('desktop.time', {
                        day: Math.floor(focused.gameTimeSeconds / 86400) + 1,
                        hours: String(
                          Math.floor(focused.gameTimeSeconds / 3600) % 24
                        ).padStart(2, '0'),
                        minutes: String(
                          Math.floor(focused.gameTimeSeconds / 60) % 60
                        ).padStart(2, '0')
                      })}
                    </span>
                  </div>
                  <h3>{message('desktop.characters')}</h3>
                  <ul className="desktop-register">
                    {members.map((member) => (
                      <li key={member.id}>
                        <span>{member.name}</span>
                        <small>
                          {member.playerName ?? '—'} · {message('ui.lv')}{' '}
                          {member.level ?? '—'}
                        </small>
                      </li>
                    ))}
                  </ul>
                  {members.length === 0 && (
                    <p className="desktop-empty">
                      {message('desktop.noCharacters')}
                    </p>
                  )}
                  <h3>{message('desktop.groups')}</h3>
                  <ul className="desktop-register">
                    {focused.groups
                      .filter((group) => !group.archived)
                      .map((group) => (
                        <li key={group.id}>
                          <span>{group.name}</span>
                          <small>
                            {group.entries.reduce(
                              (count, entry) => count + entry.aliveQuantity,
                              0
                            )}
                          </small>
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </DesktopWindow>
          ))}
        {preview?.sceneId === focused.id && preview.side && (
          <div
            className={`desktop-snap-preview ${preview.side}`}
            aria-hidden="true"
          />
        )}
      </div>
      <nav className="desktop-taskbar" aria-label={message('desktop.windows')}>
        {[...windows]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((window) => (
            <button
              key={window.id}
              aria-pressed={!window.minimized && window.id === raised}
              onClick={() => {
                requestedFocus.current = {
                  sceneId: focused.id,
                  windowId: window.id
                }
                projection.dispatch({ type: 'raise', id: window.id })
              }}
            >
              {window.minimized ? '▁ ' : ''}
              {desktopWindowTitle(window)}
            </button>
          ))}
        {windows.length === 0 && !snapshot.loading && (
          <small>{message('desktop.empty')}</small>
        )}
      </nav>
    </section>
  )
}
