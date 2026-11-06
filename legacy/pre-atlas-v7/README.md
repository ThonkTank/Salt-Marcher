# SaltMarcher

Status: Aktuell
Owner: SaltMarcher
Last Reviewed: 2026-10-24
Source of Truth: docs/INDEX.md (Facheinstiege), package.json (Befehle)

Ein lokaler Arbeitsraum für Spielleitungen: Eine Kampagnenkarte und ihre Raum-Keys bearbeiten, Kampagnen vorbereiten und zusammenhängend live spielen. Das Produkt ist eine eigenständige Desktopanwendung mit Electron, TypeScript und SQLite. Obsidian wird nicht weitergeführt; sein Code und frühere Nachweise bleiben als historische Quellen im Repository.

**Entwicklungsstand:** Dungeon-, Atlas-, Stadt- und Kampagnenfunktionen sind in unterschiedlicher Tiefe umgesetzt. Der dokumentierte Gesamtumfang und die plattformübergreifende Produktabnahme sind noch offen.

SaltMarcher wird seit dem 16. Oktober 2026 auf Basis der bisherigen Kampagnenwerkstatt weiterentwickelt. Das frühere SaltMarcher ist im Archivzweig `archive/saltmarcher-before-workbench-20261016` und in der Git-Historie erhalten. [Übernahme, Daten und Arbeitsweise](docs/project/delivery/workbench-migration.md).

## Hier anfangen

- [Produktziele](docs/project/requirements/product.md#für-wen-und-wozu): Zweck und Nutzungsergebnisse.
- [Umfang und Quellenvorrang](docs/project/requirements/scope.md#quellen-und-vorrang): Anforderungen und ihre verbindlichen Quellen.
- [Lieferfolge](docs/project/delivery/roadmap.md#lieferfolge-des-gesamtprodukts): Abnahmefolge und fachliche Abhängigkeiten.
- [Atlas auf einen Blick](docs/atlas/requirements/atlas.md#atlas-auf-einen-blick): integrierter Atlasstand und offene Lücken.
- [Dokumentationsindex](docs/INDEX.md): Fachanforderungen und Nachweise.
- [Architektur](docs/project/architecture/overview.md#prozesse-und-verantwortlichkeiten): Prozesse, Fachbesitzer und Schutzgrenzen.
- [Code nach Zuständigkeit](docs/project/architecture/overview.md#code-nach-zuständigkeit-finden): Appbereiche, Tests und historischer Adapter.


## Lokal entwickeln

Node.js 22 und npm verwenden; diese Version entspricht der PR-CI.

```bash
npm ci
npm run dev -- --data-dir /tmp/campaign-workbench-smoke
```

Gezielt prüfen (die gemeinsamen Testartefakte werden automatisch vorbereitet):

```bash
npm test -- tests/runtime/desktop-combat-switch.test.mjs
npm test -- --list
npm run check
npm run check:desktop
```

Vollständige Qualifikation entspricht dem Candidate-Check:

```bash
npm run check:repo
npm run check
npm run check:desktop
npm test
npm run build
npm run build:desktop
```

`npm run build` und `npm run build:desktop` bauen dieselbe aktive Anwendung
unter `.build/desktop`. Beide Befehle bleiben Teil des vorgeschriebenen Candidate.
Der historische Adapter wird nur ausdrücklich mit `npm run build:legacy:obsidian`
gebaut; seine Ausgaben liegen unter `.build/legacy-obsidian`. Historische Adapter-,
ADR- und externe Referenztests wurden aus dem Testbestand entfernt.
`npm test` führt ohne Dateiauswahl die vollständige aktive Suite lokal mit einem
Testprozess aus. Die [Testanleitung](docs/project/verification/testing.md)
beschreibt Auswahl, serielle Diagnose und Laufberichte.
Native GUI-Prüfungen bleiben getrennte Aufrufe.

### Lesbarer Code

`npm run format` formatiert den aktiven App- und Desktopcode sowie die zugehörigen
Node-Tests und Entwicklungswerkzeuge mit der gemeinsamen Prettier-Konfiguration.
`npm run format:check` prüft dieselbe Auswahl, ohne Dateien zu ändern; der
Candidate-Check führt diese Prüfung ebenfalls aus.

Die Auswahl steht in `package.json`; `.prettierignore` schützt generierte Daten,
Katalogreferenzen, Fixtures und historische Quellen. HTML und eingebettete
Sprachen werden nicht pauschal umgeschrieben. Formatierungsänderungen separat
von fachlichen Änderungen und Verschiebungen committen.

### Desktop-Testlauf

```bash
npm run start:desktop -- --data-dir /tmp/campaign-workbench-smoke
```

Für laufende Produktarbeit startet `npm run dev` einen inkrementellen Watch-Zyklus
mit CSS-Aktualisierung, sicheren Neustarts und eigenem dauerhaftem Entwicklungsprofil.
Details und Grenzen: [Kurzer Entwicklungszyklus](docs/project/verification/testing.md#kurzer-desktop-entwicklungszyklus).

Die Desktopanwendung speichert ohne `--data-dir` im lokalen Appdatenordner `CampaignWorkbench`. Er verbindet Kampagnenverwaltung, Vorbereitung, Live-Spiel, Katalog, Gegenstände, einen gemeinsamen Atlas für Landschaft, Städte und Dungeonräume, Musik und eine getrennte Spieleranzeige. Die Desktopfunktion ist ein Entwicklungsstand; offene Produktlücken und Abnahmen stehen in den Fachplänen.

Ein lokales Linux-x64-Paket entsteht mit:

```bash
npm run package:desktop -- /tmp/saltmarcher-linux-x64
```

Der Linux-Updatepfad mit Erstinstallation und bewusster Releasefreigabe steht unter
[GitHub-Updates](docs/project/delivery/github-updates.md).

Die ursprünglichen Produktanforderungen bleiben erhalten. Für neue Kampagnen gilt das [gemeinsame Atlasmodell](docs/atlas/guide.md); alte Testbestände ohne Atlaswurzel werden nicht als mehrere Karten migriert.

## Repositorykarte

- `src/`: Produktcode, historischer Obsidian-Anschluss und Desktopoberfläche unter `src/app/`.
- `desktop/`: privilegierter Desktopprozess und schmale Preload-Brücken.
- `tests/`: automatisierte Prüfungen und synthetische Fixtures.
- `tools/`: Build-, Paket-, Referenz-, Fixture- und Hostwerkzeuge.
- `docs/`: Produktziele, Fachanforderungen, Architektur und Prüfwege; Einstieg in `docs/INDEX.md`.
- `docs/project/architecture/overview.md`: Architekturentscheidungen; `acceptance.json`: Anforderungen und Abnahmen.

Historische Laufstände und Einzelpläne bleiben im Git-Verlauf zugänglich. Quellen- und Datenattribution: [NOTICE.md](NOTICE.md), [SRD 5.1](src/features/catalog/SRD-5.1-ATTRIBUTION.md) und [Itemquellen](src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md).

## Noch zu prüfen und umzusetzen

Es gilt **Make it Work → Make it Efficient →
Make it Beautiful**, mit KISS und YAGNI. Neue Oberfläche oder grüne Tests
schließen fehlende Fachfunktionen nicht ab.

Native Speicherung nach einem neuen Prozessstart, Dateidialog-/Fehlerwege,
Spielerfenster auf externen Monitoren, vollständige Hex-/Stadt-/Dungeonparität,
große reale Pläne und durchgängige Vorbereitung/Spiel/Nachbereitung benötigen
jeweils ihren eigenen Nachweis. Lokale Store- und kontrollierte DOMtests belegen
nur die dort geprüften Abläufe. Verbindlich sind die betroffenen Einträge in
`acceptance.json` und die Fachpläne; Build, Push oder Paketierung sind keine
Produktabnahme.
