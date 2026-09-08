import { referenceTargetLabel } from '../reference/reference-target-label.js'
import { message, formatMessage } from '../../i18n/session-runtime.de.js'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReferenceDocument } from '../../../shared/contracts/reference.js'
import type { SceneDesktopWindow } from '../../../shared/contracts/scene-desktop.js'
import { useReferenceContext } from '../reference/reference-context.js'
import {
  referenceTargetKey,
  searchReferenceIndices
} from '../reference/reference-matcher.js'
import { LazyReferenceDocument } from '../reference/lazy-reference-document.js'
import type { DesktopAction } from './desktop-state.js'

type Props = {
  window: SceneDesktopWindow
  dispatch: (action: DesktopAction) => void
}
export function DesktopSearch({ window, dispatch }: Props) {
  const reference = useReferenceContext()
  const scroll = useRef<HTMLDivElement>(null)
  const scrollTop = window.kind === 'search' ? window.scrollTop : 0
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scrollTop
  }, [scrollTop])
  if (window.kind !== 'search') return null
  const results = searchReferenceIndices(reference.compiled ?? [], window.query)
  return (
    <div className="desktop-reference-pane">
      <input
        type="search"
        aria-label={message('desktop.search')}
        placeholder={message('desktop.searchPlaceholder')}
        maxLength={300}
        value={window.query}
        onChange={(event) =>
          dispatch({ type: 'query', value: event.target.value })
        }
      />
      <div
        className="desktop-reference-scroll"
        ref={scroll}
        onScroll={(event) =>
          dispatch({
            type: 'scroll',
            id: window.id,
            value: event.currentTarget.scrollTop
          })
        }
      >
        {!reference.compiled ? (
          <p role="status">{message('desktop.referenceLoading')}</p>
        ) : (
          results.map((candidate) => (
            <div
              className="desktop-search-result"
              data-reference-kind={
                candidate.target.scope === 'srd'
                  ? candidate.target.definitionKind
                  : candidate.target.scope === 'campaign'
                    ? candidate.target.entityKind
                    : candidate.target.scope
              }
              key={referenceTargetKey(candidate.target)}
            >
              <button
                onClick={() =>
                  dispatch({
                    type: 'open-reference',
                    entry: { ...candidate, scrollTop: 0 }
                  })
                }
              >
                <span>{candidate.title}</span>
                <small>{referenceTargetLabel(candidate.target)}</small>
              </button>
              <button
                aria-label={formatMessage('desktop.separateTarget', {
                  title: candidate.title
                })}
                title={message('desktop.separate')}
                onClick={() =>
                  dispatch({
                    type: 'open-reference',
                    entry: { ...candidate, scrollTop: 0 },
                    separateId: crypto.randomUUID()
                  })
                }
              >
                ↗
              </button>
            </div>
          ))
        )}
        {reference.compiled && window.query.trim() && results.length === 0 && (
          <p>{message('desktop.noResults')}</p>
        )}
      </div>
    </div>
  )
}

export function DesktopReader({ window, dispatch }: Props) {
  const entry =
    window.kind === 'reader'
      ? window.entries[window.index]!
      : window.kind === 'reference'
        ? window.entry
        : null
  const key = entry ? referenceTargetKey(entry.target) : ''
  if (!entry) return null
  return (
    <DesktopReaderContent
      key={`${key}:${window.kind === 'reader' ? window.index : 0}`}
      window={window}
      dispatch={dispatch}
    />
  )
}

function DesktopReaderContent({ window, dispatch }: Props) {
  const { loadDetail, cacheRevision } = useReferenceContext()
  const entry =
    window.kind === 'reader'
      ? window.entries[window.index]!
      : window.kind === 'reference'
        ? window.entry
        : null
  const key = entry ? referenceTargetKey(entry.target) : ''
  const [state, setState] = useState<{
    key: string
    document: ReferenceDocument | null
    failed: boolean
  }>({ key: '', document: null, failed: false })
  const [retry, setRetry] = useState(0)
  const scroll = useRef<HTMLDivElement>(null)
  const restored = useRef(false)
  const initialScroll = useRef(entry?.scrollTop ?? 0)
  const target = entry?.target
  useEffect(() => {
    if (!target) return
    let active = true
    void loadDetail(target)
      .then((document) => {
        if (active) setState({ key, document, failed: false })
      })
      .catch(() => {
        if (active) setState({ key, document: null, failed: true })
      })
    return () => {
      active = false
    }
  }, [target, key, loadDetail, cacheRevision, retry])
  const resolvedTitle = state.key === key ? state.document?.title : undefined
  const currentTitle = entry?.title
  const historyIndex = window.kind === 'reader' ? window.index : undefined
  useEffect(() => {
    if (resolvedTitle && resolvedTitle !== currentTitle)
      dispatch({
        type: 'reference-title',
        id: window.id,
        title: resolvedTitle,
        entryKey: key,
        ...(historyIndex === undefined ? {} : { index: historyIndex })
      })
  }, [resolvedTitle, currentTitle, dispatch, window.id, key, historyIndex])
  if (!entry) return null
  const document = state.key === key ? state.document : null
  return (
    <div className="desktop-reference-pane">
      {window.kind === 'reader' && (
        <div className="desktop-reader-actions">
          <button
            aria-label={message('desktop.back')}
            disabled={window.index === 0}
            onClick={() => dispatch({ type: 'history', offset: -1 })}
          >
            ←
          </button>
          <button
            aria-label={message('desktop.forward')}
            disabled={window.index === window.entries.length - 1}
            onClick={() => dispatch({ type: 'history', offset: 1 })}
          >
            →
          </button>
          <button
            onClick={() =>
              dispatch({
                type: 'open-reference',
                entry,
                separateId: crypto.randomUUID()
              })
            }
          >
            {message('desktop.separate')}
          </button>
        </div>
      )}
      <div
        ref={scroll}
        className="desktop-reference-scroll"
        onScroll={(event) => {
          if (restored.current)
            dispatch({
              type: 'scroll',
              id: window.id,
              value: event.currentTarget.scrollTop,
              entryKey: key,
              ...(window.kind === 'reader' ? { index: window.index } : {})
            })
        }}
      >
        {document ? (
          <LazyReferenceDocument
            document={document}
            hideTitle
            onReady={() => {
              if (scroll.current && !restored.current) {
                scroll.current.scrollTop = initialScroll.current
                restored.current = true
              }
            }}
          />
        ) : state.key === key && state.failed ? (
          <div role="alert">
            {message('desktop.referenceUnavailable')}{' '}
            <button onClick={() => setRetry((value) => value + 1)}>
              {message('desktop.retry')}
            </button>
          </div>
        ) : (
          <p role="status">{message('desktop.referenceLoading')}</p>
        )}
      </div>
    </div>
  )
}
