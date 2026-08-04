/* eslint-disable react-hooks/refs -- Floating UI exposes callback refs and prop getters that are intentionally used during render. */
import {
  FloatingNode,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useFocus,
  useHover,
  useInteractions,
  useRole
} from '@floating-ui/react'
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react'
import type {
  ReferenceCandidate,
  ReferenceDocument,
  ReferenceTarget
} from '../../../shared/contracts/reference.js'
import { CreatureInspector } from '../catalog/creature-inspector.js'
import { formatMessage, message } from '../../i18n/messages.de.js'
import {
  useReferenceContext,
  useOptionalReferenceContext,
  type PinnedReference
} from './reference-context.js'
import {
  matchReferenceText,
  referenceTargetKey,
  type ReferenceMatch
} from './reference-matcher.js'

export function ReferenceText(props: {
  children: string
  path?: readonly ReferenceTarget[]
}) {
  const reference = useOptionalReferenceContext()
  const compiled = reference?.compiled ?? null
  const matches = useMemo(
    () =>
      compiled
        ? matchReferenceText(compiled, props.children, props.path ?? [])
        : [],
    [compiled, props.children, props.path]
  )
  if (matches.length === 0) return <>{props.children}</>
  const content: ReactNode[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.start > cursor)
      content.push(props.children.slice(cursor, match.start))
    content.push(
      <ReferenceTerm
        key={`${match.start}:${match.end}:${match.candidates
          .map((candidate) => referenceTargetKey(candidate.target))
          .join('|')}`}
        match={match}
        path={props.path ?? []}
      />
    )
    cursor = match.end
  }
  if (cursor < props.children.length) content.push(props.children.slice(cursor))
  return <>{content}</>
}

export function ReferenceLink(props: {
  text: string
  candidate: ReferenceCandidate
  path?: readonly ReferenceTarget[]
}) {
  const reference = useOptionalReferenceContext()
  if (!reference) return <>{props.text}</>
  return (
    <ReferenceTerm
      match={{
        start: 0,
        end: props.text.length,
        text: props.text,
        candidates: [props.candidate]
      }}
      path={props.path ?? []}
    />
  )
}

function ReferenceTerm(props: {
  match: ReferenceMatch
  path: readonly ReferenceTarget[]
}) {
  const reference = useReferenceContext()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ReferenceCandidate | null>(null)
  const [pinning, setPinning] = useState(false)
  const timer = useRef<number | null>(null)
  const nodeId = useFloatingNodeId()
  const { refs, floatingStyles, context } = useFloating({
    nodeId,
    open,
    onOpenChange(next) {
      setOpen(next)
      if (!next) setSelected(null)
    },
    placement: 'right-start',
    strategy: 'fixed',
    middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate
  })
  const hover = useHover(context, {
    restMs: 250,
    delay: { open: 750, close: 120 },
    handleClose: safePolygon({ buffer: 1 })
  })
  const focus = useFocus(context)
  const dismiss = useDismiss(context, { bubbles: true })
  const role = useRole(context, { role: 'dialog' })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role
  ])
  const onlyCandidate =
    props.match.candidates.length === 1 ? props.match.candidates[0]! : null

  const stopPinTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    setPinning(false)
  }
  const startPinTimer = () => {
    if (!onlyCandidate || timer.current !== null) return
    setPinning(true)
    timer.current = window.setTimeout(() => {
      timer.current = null
      setPinning(false)
      const anchor = refs.reference.current?.getBoundingClientRect() ?? null
      reference.pinReference(onlyCandidate.target, onlyCandidate.title, anchor)
      setOpen(false)
    }, 5_000)
  }
  useEffect(() => stopPinTimer, [])

  const activate = () => {
    if (!onlyCandidate) {
      setOpen(true)
      return
    }
    reference.openReference(
      onlyCandidate.target,
      `${onlyCandidate.context ?? kindLabel(onlyCandidate.target.kind)} › ${onlyCandidate.title}`
    )
  }

  return (
    <>
      <button
        type="button"
        className="reference-term"
        ref={refs.setReference}
        {...getReferenceProps({
          onClick: activate,
          onPointerEnter: startPinTimer,
          onPointerLeave: stopPinTimer
        })}
      >
        {props.match.text}
      </button>
      <FloatingNode id={nodeId}>
        {open && (
          <FloatingPortal>
            <section
              className={`reference-hover-card${pinning ? ' pinning' : ''}`}
              ref={refs.setFloating}
              style={floatingStyles}
              aria-label={formatMessage('reference.label', {
                name: props.match.text
              })}
              {...getFloatingProps({
                onPointerEnter: startPinTimer,
                onPointerLeave: stopPinTimer
              })}
            >
              {pinning && <span className="reference-pin-progress" />}
              {props.match.candidates.length > 1 && selected === null ? (
                <ReferenceChoices
                  text={props.match.text}
                  candidates={props.match.candidates}
                  select={setSelected}
                />
              ) : (
                <ReferencePreview
                  candidate={selected ?? onlyCandidate!}
                  path={props.path}
                  {...(selected
                    ? {
                        back: () => {
                          stopPinTimer()
                          setSelected(null)
                        }
                      }
                    : {})}
                  pin={(candidate) => {
                    const anchor =
                      refs.reference.current?.getBoundingClientRect() ?? null
                    reference.pinReference(
                      candidate.target,
                      candidate.title,
                      anchor
                    )
                    setOpen(false)
                  }}
                />
              )}
            </section>
          </FloatingPortal>
        )}
      </FloatingNode>
    </>
  )
}

function ReferenceChoices(props: {
  text: string
  candidates: readonly ReferenceCandidate[]
  select: (candidate: ReferenceCandidate) => void
}) {
  return (
    <div className="reference-choices">
      <header>
        <strong>{props.text}</strong>
        <span>
          {formatMessage('reference.possibleCount', {
            count: props.candidates.length
          })}
        </span>
      </header>
      <div className="reference-choice-list">
        {props.candidates.map((candidate) => (
          <button
            type="button"
            key={referenceTargetKey(candidate.target)}
            onClick={() => props.select(candidate)}
          >
            <strong>{candidate.title}</strong>
            <span>{candidate.context ?? kindLabel(candidate.target.kind)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ReferencePreview(props: {
  candidate: ReferenceCandidate
  path: readonly ReferenceTarget[]
  back?: () => void
  pin: (candidate: ReferenceCandidate) => void
}) {
  const reference = useReferenceContext()
  const state = useReferenceDocument(props.candidate.target)
  return (
    <>
      <header className="reference-card-header">
        <div>
          <span>
            {props.candidate.context ?? kindLabel(props.candidate.target.kind)}
          </span>
          <strong>{props.candidate.title}</strong>
        </div>
        <div className="reference-card-actions">
          {props.back && (
            <button
              type="button"
              onClick={props.back}
              aria-label={message('reference.back')}
            >
              ‹
            </button>
          )}
          <button
            type="button"
            onClick={() => props.pin(props.candidate)}
            aria-label={formatMessage('reference.pin', {
              name: props.candidate.title
            })}
            title={message('reference.pinTitle')}
          >
            ◈
          </button>
          <button
            type="button"
            onClick={() =>
              reference.openReference(
                props.candidate.target,
                `${props.candidate.context ?? kindLabel(props.candidate.target.kind)} › ${props.candidate.title}`
              )
            }
          >
            {message('reference.detail')}
          </button>
        </div>
      </header>
      {state.status === 'loading' ? (
        <p className="reference-status" role="status">
          {message('reference.loading')}
        </p>
      ) : state.status === 'failed' ? (
        <p className="reference-status" role="alert">
          {message('reference.unavailable')}
        </p>
      ) : (
        <ReferenceDocumentView
          document={state.document}
          compact
          path={props.path}
        />
      )}
    </>
  )
}

export function ReferenceDocumentView(props: {
  document: ReferenceDocument
  compact?: boolean
  path?: readonly ReferenceTarget[]
}) {
  const path = [...(props.path ?? []), props.document.target]
  if (props.document.creature)
    return (
      <CreatureInspector
        creature={props.document.creature}
        embedded
        {...(props.compact ? { compact: true } : {})}
        referencePath={path}
      />
    )
  return (
    <article className={`reference-document${props.compact ? ' compact' : ''}`}>
      {!props.compact && (
        <header>
          <p>
            {props.document.context ?? kindLabel(props.document.target.kind)}
          </p>
          <h2>{props.document.title}</h2>
        </header>
      )}
      {props.document.facts.length > 0 && (
        <dl className="reference-facts">
          {props.document.facts.map((fact) => (
            <Fragment key={`${fact.label}:${fact.value}`}>
              <dt>{fact.label}</dt>
              <dd>
                <ReferenceText path={path}>{fact.value}</ReferenceText>
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
      {props.compact
        ? props.document.summary && (
            <p>
              <ReferenceText path={path}>
                {props.document.summary}
              </ReferenceText>
            </p>
          )
        : props.document.sections.length > 0
          ? props.document.sections.map((section) => (
              <section key={section.id}>
                {section.title && <h3>{section.title}</h3>}
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index}>
                    <ReferenceText path={path}>{paragraph}</ReferenceText>
                  </p>
                ))}
              </section>
            ))
          : props.document.summary && (
              <p>
                <ReferenceText path={path}>
                  {props.document.summary}
                </ReferenceText>
              </p>
            )}
      {!props.compact && props.document.source && (
        <footer className="reference-attribution">
          {props.document.source.title} · {props.document.source.version} ·{' '}
          {props.document.source.attribution}
        </footer>
      )}
    </article>
  )
}

export function ReferencePinnedWindow(props: { pin: PinnedReference }) {
  const reference = useReferenceContext()
  const state = useReferenceDocument(props.pin.target)
  const drag = useRef<{
    pointerId: number
    originX: number
    originY: number
    startX: number
    startY: number
  } | null>(null)

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = {
      pointerId: event.pointerId,
      originX: props.pin.x,
      originY: props.pin.y,
      startX: event.clientX,
      startY: event.clientY
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    reference.raisePin(props.pin.id)
  }
  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    reference.movePin(
      props.pin.id,
      current.originX + event.clientX - current.startX,
      current.originY + event.clientY - current.startY
    )
  }
  const pointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null
  }

  return (
    <section
      className="reference-pinned-window"
      aria-label={formatMessage('reference.pinnedLabel', {
        name: props.pin.title
      })}
      style={{
        left: props.pin.x,
        top: props.pin.y,
        zIndex: props.pin.z
      }}
      onPointerDown={() => reference.raisePin(props.pin.id)}
      onFocusCapture={() => reference.raisePin(props.pin.id)}
    >
      <header>
        <button
          type="button"
          className="reference-drag-handle"
          aria-label={formatMessage('reference.move', {
            name: props.pin.title
          })}
          title={message('reference.moveTitle')}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onKeyDown={(event) => {
            if (!event.key.startsWith('Arrow')) return
            event.preventDefault()
            const step = event.shiftKey ? 24 : 8
            reference.movePin(
              props.pin.id,
              props.pin.x +
                (event.key === 'ArrowLeft'
                  ? -step
                  : event.key === 'ArrowRight'
                    ? step
                    : 0),
              props.pin.y +
                (event.key === 'ArrowUp'
                  ? -step
                  : event.key === 'ArrowDown'
                    ? step
                    : 0)
            )
          }}
        >
          <span aria-hidden="true">⠿</span>
          <strong>{props.pin.title}</strong>
        </button>
        <button
          type="button"
          aria-label={formatMessage('reference.close', {
            name: props.pin.title
          })}
          onClick={() => reference.closePin(props.pin.id)}
        >
          ×
        </button>
      </header>
      <div className="reference-pinned-scroll">
        {state.status === 'loading' ? (
          <p className="reference-status" role="status">
            {message('reference.loading')}
          </p>
        ) : state.status === 'failed' ? (
          <p className="reference-status" role="alert">
            {message('reference.deleted')}
          </p>
        ) : (
          <ReferenceDocumentView document={state.document} />
        )}
      </div>
    </section>
  )
}

function useReferenceDocument(
  target: ReferenceTarget
):
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; document: ReferenceDocument } {
  const reference = useReferenceContext()
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'failed' }
    | { status: 'ready'; document: ReferenceDocument }
  >({ status: 'loading' })
  const key = referenceTargetKey(target)
  useEffect(() => {
    let current = true
    // A new external document key starts a new asynchronous loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading' })
    void reference
      .loadDetail(target)
      .then((document) => {
        if (current) setState({ status: 'ready', document })
      })
      .catch(() => {
        if (current) setState({ status: 'failed' })
      })
    return () => {
      current = false
    }
    // The stable key and loader fully describe this external request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reference.loadDetail])
  return state
}

function kindLabel(kind: ReferenceTarget['kind']): string {
  return {
    rule: message('reference.kind.rule'),
    condition: message('reference.kind.condition'),
    spell: message('reference.kind.spell'),
    item: message('reference.kind.item'),
    ability: message('reference.kind.ability'),
    action: message('reference.kind.action'),
    creature: message('reference.kind.creature'),
    npc: message('reference.kind.npc'),
    location: message('reference.kind.location'),
    faction: message('reference.kind.faction')
  }[kind]
}
