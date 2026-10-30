# SaltMarcher · Atlas

Lokaler 2D-Dungeoneditor mit mehreren benannten Geschossen. Tauri und Rust stellen das Desktop-Fenster und die Dateiverwaltung bereit, React die Oberfläche und Canvas-2D die Zeichenfläche. Keine Konten oder externen Laufzeitressourcen.

## Starten

Benötigt werden Node.js 22+, npm, Rust stable und die Linux-Bibliotheken für Tauri.

```bash
# Fedora: einmalige Systemvoraussetzungen
sudo dnf install -y gcc-c++ make webkit2gtk4.1-devel openssl-devel libappindicator-gtk3-devel librsvg2-devel libxdo-devel
npm ci
npm run desktop
```

Rust wird über [rustup](https://rustup.rs/) installiert. `npm run dev` startet die Browseransicht zum Entwickeln; native Dateifunktionen stehen in der Desktop-App zur Verfügung.

## Bedienung

| Eingabe | Funktion |
| --- | --- |
| R / E / V / H | Raum zeichnen / Radieren / Auswählen / Verschieben |
| Links ziehen | Aktives Werkzeug; Auswahl als Rechteck |
| Raum anklicken | Gesamte Raumidentität auswählen |
| Mitteltaste ziehen oder Leertaste + links | Ansicht verschieben |
| Mausrad | Am Mauszeiger zoomen |
| F / Pos1 | Auswahl / Karte einpassen |
| Bild ↑ / Bild ↓ | Höheres / tieferes Geschoss wählen |
| Escape | Laufende Aktion abbrechen |
| Strg+Z / Strg+Umschalt+Z / Strg+Y | Rückgängig / Wiederholen |
| Strg+S / Strg+Umschalt+S | Speichern / Speichern unter |
| Strg+O / Strg+N | Öffnen / neue Karte |

Eine Rasterzelle misst 5 × 5 Fuß. Überzeichnen verschmilzt betroffene Räume einschließlich ihrer übrigen Flächen; die älteste Identität bleibt bestehen. Aneinandergrenzende Identitäten behalten ihre gemeinsame Wand. Beim Radieren erhält jedes neu abgetrennte Stück eine eigene Identität. Das größte Stück behält die bisherige; bei Gleichstand entscheidet die Position oben/links. Diagonale Berührung verbindet nicht.

„Raum zuweisen“ ordnet ausgewählte belegte Zellen einem vorhandenen oder neuen Raum zu. Bewusst getrennte Flächen dürfen dieselbe Identität besitzen. Sie werden beim Radieren erst neu zugeordnet, wenn eine einzelne zusammenhängende Fläche zerteilt wird.

Geschosse besitzen unabhängige Räume und Rasterflächen. Neue Geschosse erscheinen oberhalb des aktiven; die Pfeile ändern ihre Reihenfolge. Das letzte Geschoss bleibt erhalten. Belegte Geschosse erfordern vor dem Löschen eine Bestätigung. Geschossänderungen sind rückgängig machbar.

Beim Öffnen wird das erste belegte Geschoss ausgewählt und sein Grundriss eingepasst; leere Karten beginnen auf dem ersten Geschoss. Beim Geschosswechsel bleibt der Bildausschnitt erhalten. „Unteres Geschoss“ blendet den unmittelbar darunterliegenden Grundriss blass ein. Laufende Gesten werden bei Werkzeug- oder Geschosswechsel und beim Öffnen eines Dialogs abgebrochen. Während einer Geste bleiben Zoom und Einpassen gesperrt; nach dem Loslassen stehen sie sofort wieder zur Verfügung.

## Dateien

Das V3-Format `.saltatlas.json` enthält ausschließlich Kartendaten: Rastermaß, geordnete Geschosse sowie deren Räume und Zellen. Die Geschossliste ist von unten nach oben geordnet; die Raumliste hält die Erstellungsreihenfolge fest. IDs bleiben bei Änderungen stabil. Ansicht, Auswahl, Werkzeuge und Undo-Historie werden nicht gespeichert. Ältere Dateiversionen werden ausdrücklich abgelehnt; es gibt keine Migration.

Es gibt kein automatisches Speichern. Ungespeicherte Änderungen werden vor Neu, Öffnen und Schließen abgefragt. Abgebrochene oder fehlgeschlagene Speichervorgänge verwerfen keine Änderungen. Jede abgeschlossene Bearbeitung erzeugt einen Undo-Schritt, maximal 100. Navigation und wirkungslose Bearbeitungen erzeugen keinen Schritt.

Grenzen: 100 Geschosse, insgesamt 100.000 Räume und 1.000.000 belegte Zellen, 100.000 Zellen pro Geste und 64 MB pro Datei. Namen enthalten 1 bis 120 Zeichen.

## Aufbau und Prüfung

- Das Modell enthält Kartendaten und Bearbeitungsfunktionen. Änderungen kopieren nur betroffene Daten; unveränderte Geschosse behalten ihre Referenzen.
- Der Editor-Reducer verwaltet Dokumenthistorie und davon getrennten Bedienzustand. Der Dateihook bündelt native Dateiaktionen und den Schutz ungespeicherter Änderungen.
- Der Canvas zeichnet bei Änderungen. Wandgrenzen werden unabhängig von der Oberfläche berechnet. Es gibt keine dauerhafte Render-Schleife.
- Rust prüft Dateistruktur, Größenlimits und Referenzen und speichert atomar über eine temporäre Datei im Zielverzeichnis. Gemeinsame Testdateien sichern den Vertrag mit TypeScript ab.

```bash
npm test                 # Modell, viele kleine Räume, Historie, Dateivertrag, Wandgrenzen
npm run test:e2e          # Bedienung, Gestenschutz, Öffnen entfernter Karten und 10.000 Zellen
npm run test:rust         # Dateivalidierung und atomische Speicherung
npm run build            # TypeScript und Frontend-Build
npm run package          # Nativer Release-Build und Fedora-RPM
```

Vor dem ersten Browser-Test: `npx playwright install chromium`. Das RPM liegt unter `src-tauri/target/release/bundle/rpm/`, die ausführbare Datei unter `src-tauri/target/release/saltmarcher`. Native Dateidialoge werden zusätzlich im Desktop-Fenster geprüft.
