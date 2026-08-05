import { readFile, stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { SvgSymbolFileResult } from '../../shared/contracts/location-symbol.js'

const maximumSvgBytes = 262_144

/** Reads only one bounded SVG source; parsing remains utility-owned. */
export async function readLocationSymbolFile(
  filePath: string
): Promise<SvgSymbolFileResult> {
  if (extname(filePath).toLocaleLowerCase() !== '.svg')
    return { status: 'rejected', reason: 'not_svg' }
  try {
    const metadata = await stat(filePath)
    if (!metadata.isFile()) return { status: 'rejected', reason: 'not_svg' }
    if (metadata.size > maximumSvgBytes)
      return { status: 'rejected', reason: 'too_large' }
    const source = await readFile(filePath, 'utf8')
    if (source.length === 0 || source.length > maximumSvgBytes)
      return { status: 'rejected', reason: 'too_large' }
    return { status: 'selected', fileName: basename(filePath), source }
  } catch {
    return { status: 'rejected', reason: 'read_failed' }
  }
}
