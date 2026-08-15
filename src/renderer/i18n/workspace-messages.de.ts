export const workspaceMessagesDe = {
  'workspace.loading': '{name} wird geladen …',
  'workspace.loadFailed':
    'Der Arbeitsbereich „{name}“ konnte nicht geladen werden.',
  'workspace.reloadHint':
    'Versuche den Arbeitsbereich erneut zu öffnen oder lade die Anwendung neu.',
  'action.retryWorkspace': 'Arbeitsbereich erneut öffnen',
  'action.retry': 'Erneut versuchen',
  'action.reloadApplication': 'Anwendung neu laden',
  'core.unavailable': 'Der lokale Programmkern ist nicht erreichbar.',
  'core.recovering': 'Der lokale Programmkern wird wiederhergestellt …',
  'core.incompatibleData':
    'Die Kampagnendaten stammen aus einer inkompatiblen Version. Alle Dateien wurden unverändert erhalten. Starte einen kompatiblen Build oder führe eine geprüfte Migration aus.',
  'core.corruptData':
    'Die Kampagnendaten sind beschädigt. Sie wurden nicht verändert. Stelle eine geprüfte Sicherung wieder her, bevor du fortfährst.',
  'core.accessDenied':
    'Der lokale Programmkern darf nicht auf die benötigten Daten zugreifen. Prüfe die Dateiberechtigungen; die Daten wurden nicht verändert.',
  'core.resourceMissing':
    'Eine benötigte Programmressource fehlt. Installiere denselben Build erneut; vorhandene Kampagnendaten wurden nicht verändert.',
  'core.invalidConfiguration':
    'Der lokale Programmkern wurde mit einer ungültigen Konfiguration gestartet. Installiere einen vollständig geprüften Build erneut.',
  'core.retry': 'Erneut starten',
  'action.close': 'Schließen',
  'action.cancel': 'Abbrechen',
  'action.save': 'Speichern',
  'action.create': 'Erstellen',
  'action.createAndLink': 'Erstellen und verknüpfen',
  'app.menu': 'Menü',
  'app.workspaces': 'Arbeitsbereiche',
  'app.sessionControls': 'Sitzungssteuerung',
  'menu.settings': 'Einstellungen',
  'nav.campaigns': 'Kampagnen',
  'nav.session': 'Session',
  'nav.planner': 'Session-Planer',
  'nav.catalog': 'Katalog',
  'nav.hex': 'Hex-Editor',
  'quick.weather': 'Wetter',
  'quick.rest': 'Rast',
  'theme.toLight': 'Zum Pergamentmodus wechseln',
  'theme.toDark': 'Zum Kerzenlichtmodus wechseln',
  'theme.light': 'Tageslicht',
  'theme.dark': 'Kerzenlicht',
  'campaign.statusActive': 'Live-Session',
  'campaign.archive': 'Kampagnenarchiv',
  'campaign.choose': 'Kampagne auswählen',
  'campaign.menuHint':
    'Wähle oder erstelle eine Kampagne über das geöffnete Burgermenü.',
  'action.add': 'Anlegen',
  'passive.heading': 'Passive Anzeige',
  'passive.intro':
    'Eine party-sichere Projektion wurde noch nicht ausgewählt. Bis dahin bleiben Kampagnen- und GM-Daten verborgen.',
  'passive.shared': 'Freigegebene Projektion',
  'error.unknown': 'Unbekannter Fehler',
  'passive.empty': 'Keine Datenfreigabe aktiv',
  'error.validation_failed': 'Die Eingabe ist ungültig.',
  'error.idempotency_conflict':
    'Diese Befehls-ID wurde bereits für eine andere Änderung verwendet.',
  'error.unsupported_svg':
    'Das SVG muss genau einen direkten Pfad ohne Transformationen oder weitere Grafikelemente enthalten.',
  'error.svg_too_large': 'Die SVG-Datei ist größer als 256 KiB.',
  'error.file_read_failed': 'Die SVG-Datei konnte nicht gelesen werden.',
  'error.catalog_unavailable':
    'Der für diese Generierung benötigte Katalog ist nicht installiert.',
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
  'error.core_unavailable': 'Der lokale Programmkern ist nicht erreichbar.',
  'error.protocol_violation': 'Die lokale Prozessantwort war ungültig.',
  'error.internal': 'Ein interner Fehler ist aufgetreten.'
} as const
