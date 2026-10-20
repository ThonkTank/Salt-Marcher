# Tatsächlicher Repository-Entwicklungsstart

21.10.2026, Quellstand `21a60b5e9ba7a62ea1cba9af7a003c9f96060ad1`.

Der Projektordner `/home/aaron/Schreibtisch/projects/SaltMarcher` verwendet jetzt
`codex/atlas-development-start` mit dem zusammengeführten Hauptatlas.
`npm run start:desktop` baut und startet diese Quellen unmittelbar.
Es gibt keine Weiterleitung in die isolierte Arbeitskopie.

Der vorherige uncommittierte Stand auf `e80b3bfb7` bleibt vollständig erhalten:
Git-Sicherung `b7ef1c63d1235c9ebcb5988c3b072c22cfafa789`, Branch
`archive/atlas-development-before-20261021` und zusätzlich der unveränderte
Stash mit der Beschreibung „Preserve repository terrain work before unified
Atlas development-start cutover 2026-10-21“. Alle 3.489 Quelldateien einschließlich
unversionierter Dateien wurden vor dem Wechsel und anschließend gegen die
Git-Sicherung per SHA-256 geprüft. Die frühere `main`-Referenz bleibt erhalten.
Das zusätzliche Dateiarchiv liegt unter
`~/.cache/saltmarcher/unified-atlas/repository-start-20261020T215309Z/`.
Historische Terrainbelege bleiben im Projektordner; zwei veraltete Dokulinks
wurden angepasst. Benutzerprofile und Kampagnendaten wurden nicht verändert.

## Prüfung

`tools/test-desktop-development-atlas.mjs` führte **im Projektordner** aus:

```sh
npm run start:desktop -- --remote-debugging-address=127.0.0.1 --remote-debugging-port=43651 --data-dir /home/aaron/.cache/saltmarcher/ui/atlas-development-RrMvdU
```

Nur Debuganschluss und isoliertes Testprofil ergänzen den normalen Entwicklungsstart.
Der erste Lauf scheiterte an einer fehlenden, bereits im Lockfile festgelegten
Abhängigkeit (`yauzl`). `npm install --ignore-scripts --no-audit --no-fund`
ergänzte drei Pakete; `package.json` und Lockfile blieben unverändert.
Der zweite Lauf bestand:

- normale Kampagnennavigation in den Hauptatlas;
- Neigung 45°, Drehung 25° und Mausradzoom;
- dieselbe WebGL-Canvas vor/nach Kamerabewegung;
- keine Rendererfehler, reguläres Prozessende mit Code 0;
- Repositoryprüfung bestanden.

Ergebnis und Build-Hashes: `repository-result.json`; Screenshot:
`repository-tilt-zoom.png`; echter Befehlsausgang: `development-command.log`.
Dies qualifiziert den Entwicklungsstart und eine synthetische Testkampagne.
Es ist keine Prüfung bestehender persönlicher Kampagnen, kein CI-/Mainabschluss,
keine Paketinstallation und keine Abnahme des vollständigen Atlasziels.
