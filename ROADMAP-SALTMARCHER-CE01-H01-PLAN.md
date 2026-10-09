# CE-01-H01 – Echte Obsidian-Abnahme des Monsterkatalogs

## Zweck und Grenze

Dieser Lauf prüft den auf `active/installed-phase1` integrierten CE-01-Kandidaten
in einer echten, isolierten Obsidian-Desktopinstanz. Er ändert keine
Produktdatei und erteilt allein keine CE-01-Fachfreigabe. Automatisierte
Playwright-Eingaben belegen den echten Hostpfad, ersetzen aber keine spätere
physische Tastatur-/Mausprüfung; diese Grenze bleibt im Receipt ausdrücklich
offen.

Die Abnahme verwendet ausschließlich das QA-Vault unter
`/home/aaron/.cache/dungeon-native-qa/`. Produktive Vaults, Karten und
Benutzerdaten werden nicht verändert. Auf diesem Gerät läuft gleichzeitig nur
eine grafische Obsidian-, Original- oder Prototypinstanz.

## Besitz

Der Umsetzungslauf besitzt ausschließlich:

- `tools/host-test.cjs` für die neuen CE-01-Schalter und das Routing;
- `tools/host/ce01-catalog.cjs` für den Hostablauf;
- diese Plan-Datei sowie nach Abschluss die CE-01-Abschnitte in
  `checkpoint.json` und `acceptance.json`.

`src/**`, `main.js`, `styles.css`, bestehende Host-Szenarien und fremde
Acceptance-Eigentümer bleiben unverändert. Der Lauf baut das Plugin vor der
Abnahme reproduzierbar aus dem exakten sauberen Git-SHA und kopiert nur dessen
Releaseeingaben in das isolierte QA-Vault.

## Läufe und Belege

### H01-A – Kernablauf und frischer Prozess

1. `npm run check`, `npm test` und `npm run build` müssen auf sauberem SHA
   bestehen. SHA-256 und Größe von `main.js`, `manifest.json` und `styles.css`
   werden vor dem Start erfasst.
2. Obsidian startet mit eigenem Config-/Cache-/Data-Root und genau dem
   `dungeon-editor`-Plugin. Der Katalog wird über die sichtbare Command Palette
   mit `Monsterkatalog öffnen` geöffnet, nicht durch einen direkten View-Aufruf.
3. Zwei überlappende Command-Ausführungen ergeben genau einen
   `dungeon-creature-catalog`-Leaf; der kanonische Leaf ist aktiv und sichtbar.
4. Suche, mindestens zwei kombinierte Filter, Chipentfernung, Sortierung,
   Paging, Zeilenauswahl, Enter, Pfeiltaste, Escape und `Quelle & Lizenz` werden
   über echte Host-DOM-Eingaben geprüft. Filter, Auswahl, Paging, Ergebnis- und
   Detailscroll bleiben bei Fokuswechsel und Rückkehr erhalten.
5. Bei 900×650 und 1150×700 bleiben Filter, Ergebnistabelle, Status, Inspector
   und Lizenzzugang erreichbar; der Hauptcontainer besitzt keinen horizontalen
   Überlauf. Bounding-Boxen, Scrollmaße und Screenshots werden gespeichert.
6. Der Edit-Lauf beendet Obsidian normal. Ein eigener `--restart`-Lauf öffnet
   denselben QA-Workspace in einem frischen Prozess und verifiziert exakt den
   serialisierten Viewzustand. Danach wird der Leaf geschlossen und über die
   Command Palette sauber als genau ein neuer Default-Leaf geöffnet.

### H01-B – Beschädigte Payload und Retry

Ein separater frischer Hostlauf injiziert vor dem ersten Katalogzugriff genau
einmal beschädigte, von `atob` gelieferte Gzip-Bytes. Der unveränderte
Produktdecoder muss einen sichtbaren `role=alert`-Fehler mit
`Erneut versuchen` zeigen; es darf weder ungefangenen Pagefehler noch einen
zweiten Katalogleaf geben. Nach Rücknahme der Fault-Injection lädt derselbe
Retry-Button den vollständigen Katalog. Das Receipt bezeichnet dies als
kontrollierte Host-Fault-Injection und nicht als Nachweis eines manipulierten
Releasebundles.

Jeder Lauf schreibt unter einem neuen unveränderlichen Verzeichnis in
`/home/aaron/.cache/dungeon-native-qa/` mindestens `build.json`,
`plugin-state.json`, `result.json`, `catalog-state.json`, Layoutmessungen,
Screenshots, Console-/Pagefehler und Speichertelemetrie. Vorhandene Receipts
werden nicht überschrieben.

## Gates

- Exakter sauberer Git-SHA und Pluginhash stimmen in Edit-, Restart- und
  Faultlauf überein.
- 0 ungefangene Pagefehler und 0 unerwartete Consolefehler.
- Genau ein sichtbarer Katalogleaf nach jeder Einzel- oder Doppelöffnung.
- Kombinierte Filter, Detailauswahl, Fokus, Scroll und Lizenz erfüllen den
  dokumentierten CE-01-Vertrag.
- Restart stellt den gespeicherten Zustand im frischen Prozess wieder her;
  manuelles Schließen und Neuöffnen erzeugt einen sauberen einzelnen
  Default-Leaf.
- Beide Größenprofile sind ohne horizontalen Hauptüberlauf bedienbar.
- Faultlauf zeigt den expliziten Fehler und besteht nach Retry.
- Ein erzwungener Prozessabbruch, fremde QA-Prozesse, geänderte Produktdateien
  oder fehlende Belege sind `failed`, nicht `passed with warning`.

## Review und verbleibende Grenzen

Nach den Läufen prüft ein unabhängiger Read-only-Review den exakten SHA,
Szenariocode und sämtliche Receipts. Pflichtbefunde werden in einem getrennten
Nachbesserungslauf repariert und erneut geprüft. Physische Eingabe und jede
nicht ausgeführte Plattform-/Screenreaderprüfung bleiben offen. Erst nach
bestandenem H01-Review darf `CE-01-C01` mit eigenem Plan, Umsetzung und Review
beginnen.

## Ergebnis vom 9. Oktober 2026

Der automatisierte H01-Scope ist auf dem sauberen Commit
`aa6d92d6cb1d8c8e06a0a61233ad837d25e40c05` unabhängig geprüft und
freigegeben. `npm run check`, 242/242 Tests und `npm run build` bestanden;
`main.js` ist 1.339.676 Byte groß, liegt mit 150.306 Byte Wachstum unter dem
180.000-Byte-Limit und besitzt in allen drei Läufen denselben SHA-256
`3a383cbc8853133e4d55af388c86ec70e93230cee8dffc32ba35cf0676f3cdad`.

Maßgebliche Receipts:

- `/home/aaron/.cache/dungeon-native-qa/evidence/1791557643230-ce01-catalog-edit`
- `/home/aaron/.cache/dungeon-native-qa/evidence/1791557649842-ce01-catalog-reopen`
- `/home/aaron/.cache/dungeon-native-qa/evidence/1791557655176-ce01-catalog-damaged-edit`

Jeder Lauf bindet eine eigene systemd-Unit und Invocation-ID sowie MainPID,
Obsidian-PIDs, Startticks und Cgroup. Alle drei Receipts belegen normalen
`app.quit()`-Ausstieg, `Result=success`, `ExecMainStatus=0` und keine erzwungene
Terminierung. Der reale Hostlauf fand zwei Produktfehler: browsernative Timer
wurden mit einem unzulässigen Empfänger aufgerufen, und normalisierte
`undefined`-Werte überschrieben nach leerem Restore die expliziten
Sortier-/Richtungs-/Seitendefaults. Beide Fehler und die Hostharness-Belege
wurden repariert und regressionsgetestet.

Dieses Ergebnis schließt ausschließlich den automatisierten Real-Host-Scope.
Physische Tastatur/Maus, Screenreader und nicht ausgeführte Plattformen bleiben
offen und werden durch Playwright nicht ersetzt. CE-01 erhält deshalb noch
keine vollständige Fachfreigabe.
