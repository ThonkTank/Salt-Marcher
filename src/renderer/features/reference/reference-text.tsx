import { useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import type {
  ReferenceCandidate,
  ReferenceTarget
} from '../../../shared/contracts/reference.js'
import {
  ReferenceOverlayParentContext,
  useOptionalReferenceContext,
  useReferenceContext
} from './reference-context.js'
import {
  matchReferenceText,
  referenceTargetKey,
  type ReferenceMatch
} from './reference-matcher.js'
import { message } from '../../i18n/reference-runtime.de.js'

export function ReferenceText(props: {
  children: string
  path?: readonly ReferenceTarget[]
}) {
  const reference = useOptionalReferenceContext()
  const compiled = reference?.compiled
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
  if (!useOptionalReferenceContext()) return <>{props.text}</>
  if (
    props.path?.some(
      (target) =>
        referenceTargetKey(target) ===
        referenceTargetKey(props.candidate.target)
    )
  )
    return <>{props.text}</>
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

export function ReferenceTerm(props: {
  match: ReferenceMatch
  path: readonly ReferenceTarget[]
}) {
  const reference = useReferenceContext()
  const parentId = useContext(ReferenceOverlayParentContext)
  const anchor = useRef<HTMLButtonElement>(null)
  const openTimer = useRef<number | null>(null)
  const onlyCandidate =
    props.match.candidates.length === 1 ? props.match.candidates[0]! : null
  const cancelOpen = () => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current)
    openTimer.current = null
  }
  const scheduleOpen = () => {
    cancelOpen()
    reference.cancelOverlayClose()
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null
      if (anchor.current)
        reference.openOverlay(anchor.current, props.match, props.path, parentId)
    }, 350)
  }
  useEffect(() => cancelOpen, [])
  const activate = () => {
    cancelOpen()
    if (!onlyCandidate) {
      if (anchor.current)
        reference.openOverlay(anchor.current, props.match, props.path, parentId)
      return
    }
    reference.closeOverlayBranch()
    reference.openReference(
      onlyCandidate.target,
      `${targetLabel(onlyCandidate.target)} › ${onlyCandidate.title}`
    )
  }
  return (
    <button
      type="button"
      className="reference-term"
      ref={anchor}
      onClick={activate}
      onFocus={scheduleOpen}
      onBlur={() => reference.scheduleOverlayClose()}
      onPointerEnter={scheduleOpen}
      onPointerLeave={() => {
        cancelOpen()
        reference.scheduleOverlayClose()
      }}
    >
      {props.match.text}
    </button>
  )
}

function targetLabel(target: ReferenceTarget): string {
  if (target.scope === 'srd')
    return message(`reference.kind.${target.definitionKind}`)
  if (target.scope === 'creature') return message('reference.kind.creature')
  if (target.scope === 'creature-part')
    return message(
      target.partKind === 'trait'
        ? 'reference.kind.ability'
        : 'reference.kind.action'
    )
  return message(`reference.kind.${target.entityKind}`)
}
