import { DOMParser } from '@xmldom/xmldom'
import {
  locationSymbolDraftSchema,
  type LocationSymbolDraft
} from '../../shared/contracts/location-symbol.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'

const maximumPathCommands = 4_096
const allowedRootAttributes = new Set(['xmlns', 'viewBox'])
const allowedPathAttributes = new Set(['d', 'fill', 'fill-rule'])

/** Converts a deliberately narrow one-path SVG into renderer-safe catalog data. */
export function parseLocationSymbolSource(
  source: string,
  displayName: string
): LocationSymbolDraft {
  if (/<\s*!DOCTYPE/i.test(source)) unsupported()
  const errors: string[] = []
  const document = new DOMParser({
    errorHandler: {
      warning: () => undefined,
      error: (message) => errors.push(String(message)),
      fatalError: (message) => errors.push(String(message))
    }
  }).parseFromString(source, 'image/svg+xml')
  const root = document.documentElement
  if (errors.length > 0 || root.localName !== 'svg') return invalid()
  assertAttributes(root, allowedRootAttributes)
  const elements = Array.from(root.childNodes).filter(
    (node): node is Element => node.nodeType === 1
  )
  if (
    elements.some((node) => !['path', 'title', 'desc'].includes(node.localName))
  )
    return unsupported()
  const paths = elements.filter((node) => node.localName === 'path')
  if (paths.length !== 1) return invalid()
  const path = paths[0]!
  assertAttributes(path, allowedPathAttributes)
  const values = (root.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value)))
    return invalid()
  const pathData = path.getAttribute('d') ?? ''
  const commands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz]/g)?.length ?? 0
  if (commands === 0 || commands > maximumPathCommands) return invalid()
  const [minX, minY, width, height] = values as [number, number, number, number]
  return locationSymbolDraftSchema.parse({
    displayName,
    viewBox: { minX, minY, width, height },
    pathData,
    fillRule:
      path.getAttribute('fill-rule')?.toLocaleLowerCase() === 'evenodd'
        ? 'evenodd'
        : 'nonzero'
  })
}

function assertAttributes(
  element: Element,
  allowed: ReadonlySet<string>
): void {
  for (const attribute of Array.from(element.attributes))
    if (!allowed.has(attribute.name)) {
      if (attribute.name === 'transform') unsupported()
      invalid()
    }
}

function invalid(): never {
  throw new CapabilityError('validation_failed', false)
}

function unsupported(): never {
  throw new CapabilityError('unsupported_svg', false)
}
