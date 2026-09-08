import { referenceTargetLabel as targetLabel } from './reference-target-label.js'
/* eslint-disable react-hooks/refs -- Floating UI exposes callback refs and prop getters that are intentionally used during render. */
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating
} from '@floating-ui/react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type {
  ReferenceBlock,
  ReferenceCandidate,
  ReferenceDocument,
  ReferenceInline,
  ReferenceTarget
} from '../../../shared/contracts/reference.js'
import { CreatureInspector } from './creature-inspector.js'
import { formatMessage, message } from '../../i18n/reference-runtime.de.js'
import { NonModalSurface } from '../../shell/nonmodal-surface.js'
import {
  useReferenceContext,
  ReferenceOverlayParentContext
} from './reference-context.js'
import { referenceTargetKey } from './reference-matcher.js'
import {
  ReferenceLink,
  ReferenceTerm,
  ReferenceText
} from './reference-text.js'

export { ReferenceLink, ReferenceText } from './reference-text.js'

export function ReferenceOverlayLayer() {
  const reference = useReferenceContext()
  return (
    <FloatingPortal>
      {reference.overlays.map((card) => (
        <ReferenceOverlayCard key={card.id} card={card} />
      ))}
    </FloatingPortal>
  )
}

function ReferenceOverlayCard(props: {
  card: ReturnType<typeof useReferenceContext>['overlays'][number]
}) {
  const reference = useReferenceContext()
  const [selected, setSelected] = useState<ReferenceCandidate | null>(null)
  const [pinning, setPinning] = useState(false)
  const pinTimer = useRef<number | null>(null)
  const { refs, floatingStyles } = useFloating({
    open: true,
    placement: 'right-start',
    strategy: 'fixed',
    middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: props.card.anchor }
  })
  const candidate =
    selected ??
    (props.card.match.candidates.length === 1
      ? props.card.match.candidates[0]!
      : null)
  const stopPin = () => {
    if (pinTimer.current !== null) window.clearTimeout(pinTimer.current)
    pinTimer.current = null
    setPinning(false)
  }
  const startPin = () => {
    if (!candidate || pinTimer.current !== null) return
    setPinning(true)
    pinTimer.current = window.setTimeout(() => {
      pinTimer.current = null
      setPinning(false)
      reference.openSeparateReference(candidate.target)
      reference.closeOverlayBranch()
    }, 5_000)
  }
  useEffect(() => stopPin, [candidate])
  return (
    <NonModalSurface
      className={`reference-hover-card${pinning ? ' pinning' : ''}`}
      ref={refs.setFloating}
      style={floatingStyles}
      aria-label={formatMessage('reference.label', {
        name: props.card.match.text
      })}
      onPointerEnter={() => {
        reference.cancelOverlayClose()
        startPin()
      }}
      onPointerLeave={() => {
        stopPin()
        reference.scheduleOverlayClose(props.card.parentId ?? undefined)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') reference.closeOverlayBranch()
      }}
    >
      {pinning && <span className="reference-pin-progress" />}
      <ReferenceOverlayParentContext.Provider value={props.card.id}>
        {!candidate ? (
          <ReferenceChoices
            text={props.card.match.text}
            candidates={props.card.match.candidates}
            select={setSelected}
          />
        ) : (
          <ReferencePreview
            candidate={candidate}
            path={props.card.path}
            {...(selected ? { back: () => setSelected(null) } : {})}
            pin={(next) => {
              reference.openSeparateReference(next.target)
              reference.closeOverlayBranch()
            }}
          />
        )}
      </ReferenceOverlayParentContext.Provider>
    </NonModalSurface>
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
            <span>{targetLabel(candidate.target)}</span>
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
          <span>{targetLabel(props.candidate.target)}</span>
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
            aria-label={formatMessage('reference.separate', {
              name: props.candidate.title
            })}
            title={message('reference.separateTitle')}
          >
            ◈
          </button>
          <button
            type="button"
            onClick={() =>
              reference.openReference(
                props.candidate.target,
                `${targetLabel(props.candidate.target)} › ${props.candidate.title}`
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
  onReady?: () => void
  hideTitle?: boolean
  compact?: boolean
  path?: readonly ReferenceTarget[]
}) {
  const { onReady } = props
  useLayoutEffect(() => onReady?.(), [onReady, props.document])
  const path = [...(props.path ?? []), props.document.target]
  if (props.document.documentKind === 'creature')
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
      {!props.compact && !props.hideTitle && (
        <header>
          <p>{targetLabel(props.document.target)}</p>
          <h2>{props.document.title}</h2>
        </header>
      )}
      {props.document.facts.length > 0 && (
        <dl className="reference-facts">
          {props.document.facts.map((fact) => (
            <Fragment key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>
                <ReferenceInlines
                  inlines={fact.value}
                  path={path}
                  dynamic={props.document.target.scope !== 'srd'}
                />
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
      {props.document.blocks
        .slice(0, props.compact ? 3 : undefined)
        .map((block, index) => (
          <ReferenceBlockView
            key={index}
            block={block}
            path={path}
            dynamic={props.document.target.scope !== 'srd'}
          />
        ))}
      {!props.compact && props.document.source && (
        <footer className="reference-attribution">
          {props.document.source.title} · {props.document.source.version} ·{' '}
          {props.document.source.attribution}
        </footer>
      )}
    </article>
  )
}

function ReferenceInlines(props: {
  inlines: readonly ReferenceInline[]
  path: readonly ReferenceTarget[]
  dynamic: boolean
}) {
  return props.inlines.map((inline, index) => {
    const candidates =
      inline.kind === 'reference'
        ? inline.candidates.filter(
            (candidate) =>
              !props.path.some(
                (target) =>
                  referenceTargetKey(target) ===
                  referenceTargetKey(candidate.target)
              )
          )
        : []
    return inline.kind === 'text' ? (
      <Fragment key={index}>
        {props.dynamic ? (
          <ReferenceText path={props.path}>{inline.text}</ReferenceText>
        ) : (
          inline.text
        )}
      </Fragment>
    ) : candidates.length === 0 ? (
      <Fragment key={index}>{inline.text}</Fragment>
    ) : candidates.length === 1 ? (
      <ReferenceLink
        key={index}
        text={inline.text}
        candidate={candidates[0]!}
        path={props.path}
      />
    ) : (
      <ReferenceTerm
        key={index}
        match={{
          start: 0,
          end: inline.text.length,
          text: inline.text,
          candidates
        }}
        path={props.path}
      />
    )
  })
}

function ReferenceBlockView(props: {
  block: ReferenceBlock
  path: readonly ReferenceTarget[]
  dynamic: boolean
}) {
  const content = (inlines: readonly ReferenceInline[]) => (
    <ReferenceInlines
      inlines={inlines}
      path={props.path}
      dynamic={props.dynamic}
    />
  )
  if (props.block.kind === 'heading') {
    const Heading = `h${props.block.level}` as 'h2' | 'h3' | 'h4'
    return <Heading>{content(props.block.inlines)}</Heading>
  }
  if (props.block.kind === 'paragraph')
    return <p>{content(props.block.inlines)}</p>
  if (props.block.kind === 'list') {
    const List = props.block.ordered ? 'ol' : 'ul'
    return (
      <List>
        {props.block.items.map((item, index) => (
          <li key={index}>{content(item)}</li>
        ))}
      </List>
    )
  }
  return (
    <table>
      <thead>
        <tr>
          {props.block.columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.block.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{content(cell)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
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
  }, [key, reference.loadDetail, reference.cacheRevision])
  return state
}
