import { lazy, Suspense } from 'react'
import type {
  ReferenceDocument,
  ReferenceTarget
} from '../../../shared/contracts/reference.js'
import { message } from '../../i18n/messages.de.js'

const LazyDocument = lazy(async () => {
  const module = await import('./reference-ui.js')
  return { default: module.ReferenceDocumentView }
})

export function LazyReferenceDocument(props: {
  document: ReferenceDocument
  compact?: boolean
  path?: readonly ReferenceTarget[]
}) {
  return (
    <Suspense fallback={<p role="status">{message('reference.loading')}</p>}>
      <LazyDocument {...props} />
    </Suspense>
  )
}
