# Cartographer

Der Cartographer ist das zentrale Hexkarten-Werkzeug. Er kombiniert Dateiverwaltung, mehrere Arbeitsmodi und eine integrierte Reiseoberfläche.

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
Der Drop-down rechts neben dem Titel öffnet die Moduswahl. Standardmäßig stehen drei Modi zur Verfügung:
- **Travel** – Steuert Reiserouten, Geschwindigkeit und Zeitablauf. Trigger wie „Encounter“ öffnen automatisch den Encounter-Arbeitsbereich und übergeben Kontextinformationen.
- **Editor** – Bietet den Terrain-Pinsel, Werkzeugleisten und Live-Vorschau, um Hexfelder zu bearbeiten.
- **Inspector** – Lies bestehende Karten, prüfe Metadaten und untersuche einzelne Hexfelder ohne versehentliche Änderungen.

### Modus-Module
- `modes/editor.ts` verbindet die Tool-Manager-Infrastruktur mit Hex-Rendering und reagiert auf Kartenwechsel.
- `modes/inspector.ts` liest Hex-Notizen, erlaubt Terrain-Anpassungen und speichert Änderungen sofort.
- `modes/travel-guide.ts` startet Sidebar, Playback-Controller und Encounter-Sync für Reiseverläufe.

### Event-Flow
1. `view-shell` initialisiert die Karte und übergibt das Lifecycle-Context-Objekt an den gewählten Modus.
2. Der Modus bindet seine Controller (Tools, Inspector oder Travel) an Render- und Storage-Services.
3. Aktionen wie „Encounter öffnen“ oder „Terrain speichern“ laufen über `travel/infra` bzw. `core/hex-mapper` zurück in den Store.

## Tipps für den Travel-Modus
- Die Sidebar zeigt den aktuellen Hex, das Tempo und den Status des Reiseverlaufs.
- Über die Wiedergabesteuerung kannst du Reisen pausieren, fortsetzen oder zurücksetzen.
- Terrain-Änderungen und Reisegeschwindigkeit wirken sich sofort auf die Begegnungswahrscheinlichkeit aus; bestätige Begegnungen im Encounter-Bereich.
