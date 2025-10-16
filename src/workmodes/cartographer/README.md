# Cartographer

Der Cartographer ist das zentrale Hexkarten-Werkzeug. Er kombiniert Dateiverwaltung mit mehreren Arbeitsmodi für Bearbeitung und Analyse.

## Starten
- Klicke auf das Kompass-Symbol in der Ribbon-Leiste oder nutze den Befehl „Open Cartographer“.
- Der aktive Markdown-Tab wird als Karte übernommen, sofern er eine `smMap`-Frontmatter besitzt. Andernfalls lässt sich jederzeit eine Karte wählen.

## Karten verwalten
Die Kopfzeile bietet alle Dateiaktionen:
- **Open** – Wähle eine bestehende Karte aus `SaltMarcher/Maps/`.
- **Create** – Lege eine neue Karte an. Das Plugin erzeugt dazu passende Hex-Notizen im angegebenen Zielordner.
- **Delete** – Entferne die aktuelle Karte aus dem Vault (mit Bestätigung).
- **Save / Save as…** – Speichere Änderungen oder schreibe eine Kopie unter neuem Namen.
Der Dateiname erscheint links unter der Kopfzeile. Wechselst du die Datei, aktualisieren sich Karte, Sidebar und verfügbare Routen.

## Modi wechseln
Der Drop-down rechts neben dem Titel öffnet die Moduswahl. Standardmäßig stehen zwei Modi zur Verfügung:
- **Editor** – Bietet den Terrain-Pinsel, Werkzeugleisten und Live-Vorschau, um Hexfelder zu bearbeiten.
- **Inspector** – Lies bestehende Karten, prüfe Metadaten und untersuche einzelne Hexfelder ohne versehentliche Änderungen.

Der Travel-Workflow lebt seit der Extraktion in der Session-Runner-App und nutzt dort dieselben Karten- und Encounter-Schnittstellen.

### Modus-Module
- `modes/editor.ts` verbindet die Tool-Manager-Infrastruktur mit Hex-Rendering und reagiert auf Kartenwechsel.
- `modes/inspector.ts` liest Hex-Notizen, erlaubt Terrain-Anpassungen und speichert Änderungen sofort.

### Event-Flow
1. `controller.ts` baut Header, Kartenfläche und Sidebar auf, lädt die statisch hinterlegten Modi und übergibt ihnen das Lifecycle-Context-Objekt.
2. Der Modus bindet seine Controller (Tools oder Inspector) an Render- und Storage-Services.
3. Aktionen wie „Terrain speichern“ laufen über `core/hex-mapper` zurück in den Store.

## Session Runner Hinweis
- Das Session-Runner-View (`apps/session-runner`) bietet die bisherigen Reise-Features inklusive Playback, Sidebar und Encounter-Integration.
