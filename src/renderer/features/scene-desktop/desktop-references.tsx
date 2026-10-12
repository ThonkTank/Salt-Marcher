import { referenceTargetLabel } from '../reference/reference-target-label.js'
import { message, formatMessage } from '../../i18n/session-runtime.de.js'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import type {
  ReferenceCandidate,
  ReferenceDocument
} from '../../../shared/contracts/reference.js'
import type { SceneDesktopWindow } from '../../../shared/contracts/scene-desktop.js'
import { useReferenceContext } from '../reference/reference-context.js'
import { referenceTargetKey } from '../reference/reference-matcher.js'
import { useDesktopSearch } from './use-desktop-search.js'
import { LazyReferenceDocument } from '../reference/lazy-reference-document.js'
import type { DesktopAction } from './desktop-state.js'
import {
  focusReferenceSearch,
  type DesktopSearchIntent
} from './reference-search-focus.js'

type Props = {
  window: SceneDesktopWindow
  dispatch: (action: DesktopAction) => void
  searchIntent?: DesktopSearchIntent | undefined
  onSearchFocused?: ((id: string) => void) | undefined
  onResultSelected?: ((intent: DesktopSearchIntent) => void) | undefined
}
export function DesktopSearch({ window, dispatch, onResultSelected }: Props) {
  const reference = useReferenceContext()
  const scroll = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const submitted = useRef<string | null>(null)
  const query = window.kind === 'search' ? window.query : ''
  const submissionKey = JSON.stringify([
    reference.campaignId,
    query,
    reference.cacheRevision
  ])
  const scrollTop = window.kind === 'search' ? window.scrollTop : 0
  const search = useDesktopSearch(
    reference,
    window.kind === 'search' ? window.query : ''
  )
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scrollTop
  }, [scrollTop])
  const { results } = search
  const open = useCallback(
    (candidate: ReferenceCandidate, separate = false) => {
      submitted.current = null
      const windowId = separate ? crypto.randomUUID() : 'reader'
      onResultSelected?.({
        id: crypto.randomUUID(),
        windowId,
        targetKey: referenceTargetKey(candidate.target),
        query,
        consumed: false
      })
      dispatch({
        type: 'open-reference',
        entry: { ...candidate, scrollTop: 0 },
        ...(separate ? { separateId: windowId } : {})
      })
    },
    [dispatch, onResultSelected, query]
  )
  useEffect(() => {
    if (!submitted.current) return
    if (
      submitted.current !== submissionKey ||
      window.minimized ||
      document.activeElement !== input.current
    ) {
      submitted.current = null
      return
    }
    if (search.loading || !reference.compiled) return
    submitted.current = null
    if (!search.failed && !search.more && results.length === 1)
      open(results[0]!)
  }, [
    submissionKey,
    window.minimized,
    search.loading,
    search.failed,
    search.more,
    reference.compiled,
    results,
    open
  ])
  if (window.kind !== 'search') return null
  return (
    <div className="desktop-reference-pane">
      <input
        type="search"
        ref={input}
        onBlur={() => {
          submitted.current = null
        }}
        aria-label={message('desktop.search')}
        placeholder={message('desktop.searchPlaceholder')}
        maxLength={300}
        value={window.query}
        onChange={(event) => {
          submitted.current = null
          dispatch({ type: 'query', value: event.target.value })
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') submitted.current = null
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
          event.preventDefault()
          if (search.loading || !reference.compiled) {
            submitted.current = submissionKey
          } else if (!search.failed && !search.more && results.length === 1) {
            open(results[0]!)
          }
        }}
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
              <button onClick={() => open(candidate)}>
                <span>{candidate.title}</span>
                <small>{referenceTargetLabel(candidate.target)}</small>
              </button>
              <button
                aria-label={formatMessage('desktop.separateTarget', {
                  title: candidate.title
                })}
                title={message('desktop.separate')}
                onClick={() => open(candidate, true)}
              >
                ↗
              </button>
            </div>
          ))
        )}
        {search.loading && (
          <p role="status">{message('desktop.searchLoading')}</p>
        )}
        {search.failed && (
          <div role="alert">
            {message('desktop.searchFailed')}{' '}
            <button onClick={search.retry}>{message('desktop.retry')}</button>
          </div>
        )}
        {search.more && (
          <button
            disabled={search.loading || search.failed}
            onClick={search.loadMore}
          >
            {message('desktop.moreResults')}
          </button>
        )}
        {reference.compiled &&
          window.query.trim() &&
          !search.loading &&
          !search.failed &&
          results.length === 0 && <p>{message('desktop.noResults')}</p>}
      </div>
    </div>
  )
}

export function DesktopReader({
  window,
  dispatch,
  searchIntent,
  onSearchFocused
}: Props) {
  const entry =
    window.kind === 'reader'
      ? window.entries[window.index]!
      : window.kind === 'reference'
        ? window.entry
        : null
  const key = entry ? referenceTargetKey(entry.target) : ''
  const intent =
    searchIntent?.windowId === window.id && searchIntent.targetKey === key
      ? searchIntent
      : undefined
  if (!entry) return null
  return (
    <DesktopReaderContent
      key={`${key}:${window.kind === 'reader' ? window.index : 0}:${intent?.id ?? ''}`}
      window={window}
      dispatch={dispatch}
      searchIntent={intent}
      onSearchFocused={onSearchFocused}
    />
  )
}

function DesktopReaderContent({
  window,
  dispatch,
  searchIntent,
  onSearchFocused
}: Props) {
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
  const highlight = useRef<Highlight | null>(null)
  useEffect(
    () => () => {
      if (
        highlight.current &&
        CSS.highlights?.get('reference-search') === highlight.current
      )
        CSS.highlights.delete('reference-search')
    },
    []
  )
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
                if (searchIntent && !searchIntent.consumed) {
                  const range = focusReferenceSearch(
                    scroll.current,
                    searchIntent.query,
                    entry.title
                  )
                  if (
                    range &&
                    typeof Highlight !== 'undefined' &&
                    CSS.highlights
                  ) {
                    highlight.current = new Highlight(range)
                    CSS.highlights.set('reference-search', highlight.current)
                  }
                  onSearchFocused?.(searchIntent.id)
                }
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
