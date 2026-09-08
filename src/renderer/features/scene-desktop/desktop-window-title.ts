import { message } from '../../i18n/session-runtime.de.js'
import type { SceneDesktopWindow } from '../../../shared/contracts/scene-desktop.js'
export function desktopWindowTitle(window: SceneDesktopWindow): string {
  if (window.kind === 'overview') return message('desktop.overview')
  if (window.kind === 'map') return message('desktop.map')
  if (window.kind === 'combat') return message('desktop.combat')
  if (window.kind === 'loot') return message('desktop.loot')
  if (window.kind === 'search') return message('desktop.search')
  return window.kind === 'reader'
    ? window.entries[window.index]!.title
    : window.entry.title
}
