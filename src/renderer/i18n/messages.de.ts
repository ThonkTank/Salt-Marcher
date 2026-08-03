import {
  capabilityErrorCode,
  type CapabilityError
} from '../../shared/errors/capability-error.js'

export const messagesDe = {
  'app.loading': 'Anwendung wird geladen …',
  'core.unavailable': 'Der lokale Programmkern ist nicht erreichbar.',
  'core.recovering': 'Der lokale Programmkern wird wiederhergestellt …',
  'core.retry': 'Erneut starten',
  'action.close': 'Schließen',
  'action.cancel': 'Abbrechen',
  'error.unknown': 'Unbekannter Fehler',
  'hex.loading': 'Karte wird geladen …',
  'hex.none': 'Keine Hex-Karte',
  'passive.empty': 'Keine Datenfreigabe aktiv',
  'error.validation_failed': 'Die Eingabe ist ungültig.',
  'error.stale': 'Die Daten wurden zwischenzeitlich geändert. Bitte neu laden.',
  'error.not_found': 'Der angeforderte Eintrag wurde nicht gefunden.',
  'error.read_only': 'Dieses Fenster hat nur Leserechte.',
  'error.timeout': 'Die Anfrage hat zu lange gedauert.',
  'error.outcome_unknown':
    'Der Ausgang der Änderung ist unklar. Der aktuelle Stand wird neu geladen.',
  'settings.outcome_committed':
    'Die Einstellung ist trotz unterbrochener Antwort sichtbar gespeichert.',
  'settings.outcome_not_committed':
    'Die Einstellung ist nach der unterbrochenen Antwort nicht sichtbar gespeichert; sie wurde nicht erneut gesendet.',
  'error.development_data_incompatible':
    'Die lokalen Entwicklungsdaten haben eine inkompatible Version.',
  'error.core_unavailable': 'Der lokale Programmkern ist nicht erreichbar.',
  'error.protocol_violation': 'Die lokale Prozessantwort war ungültig.',
  'error.internal': 'Ein interner Fehler ist aufgetreten.'
} as const

export type MessageKey = keyof typeof messagesDe

export function message(
  key: MessageKey,
  pseudo = pseudoLocaleEnabled()
): string {
  const value = messagesDe[key]
  return pseudo ? pseudoExpand(value) : value
}

export function pseudoExpand(value: string): string {
  const expanded = value.replace(/[aeiouäöüAEIOUÄÖÜ]/g, '$&$&')
  const minimum = Math.ceil(value.length * 1.4)
  return `⟦${expanded.padEnd(Math.max(expanded.length, minimum), '·')}⟧`
}

export function capabilityErrorMessage(error: unknown): string {
  const code = capabilityErrorCode(error)
  if (code === null) return message('error.unknown')
  const base = message(`error.${code}`)
  const data = (error as Partial<CapabilityError>).data
  return code === 'development_data_incompatible' && data?.developmentDataPath
    ? `${base} ${data.developmentDataPath}`
    : base
}

function pseudoLocaleEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('locale') === 'pseudo'
}
