import type { ReactNode } from 'react'
import type { ReferenceTarget } from '../../../shared/contracts/reference.js'
import { ReferenceText } from './reference-text.js'

/** The only renderer primitive for user-visible, read-only prose. */
export function ReadOnlyProse(props: {
  children: string
  path?: readonly ReferenceTarget[]
}): ReactNode {
  return (
    <ReferenceText {...(props.path ? { path: props.path } : {})}>
      {props.children}
    </ReferenceText>
  )
}

/** Explicit name for prose that may contain compiled or runtime references. */
export const ReferenceRichText = ReadOnlyProse
