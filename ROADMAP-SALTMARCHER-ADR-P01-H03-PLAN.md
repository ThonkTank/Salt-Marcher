# ADR-P01-H03 – Durable Capture/Publish- und Recovery-Hypothese

Stand: 9. Oktober 2026

Art: reviewpflichtiger Ersatzhypothesenplan nach dem geprüften und aufgeräumten
ADR-P01-H02-No-Go; keine Produkt-, Plattform- oder P02-Freigabe

## Ausgang und Entscheidungsfrage

H02 belegt auf Linux eine echte getrennte Kette aus sandboxed Renderer,
restriktivem Preload, Main, `utilityProcess` und nativem Helper. Kleine und große
V4-Fixture bestanden Open, Mutation, Undo, Redo, Save und vollständig frischen
Reopen. H02 endete trotzdem korrekt mit `No-Go`, weil sein Helper weder die
durable Receipt-/Recovery-State-Machine noch die vollständige Create-/Update-/
Delete-Faultmatrix ausführte. Der ausführbare H02-Harness ist aufgeräumt;
`p01-v2` und der reviewte Aggregatbeleg bleiben erhalten.

H03 prüft genau eine engere Hypothese:

> Ein nativer Linux-Transaktionsdienst kann einen erwarteten alten Zielnamen
> zuerst ohne Überschreiben in einen exklusiven Backupnamen capturen und erst
> danach die synchronisierte neue Datei mit `RENAME_NOREPLACE` publizieren.
> Greift ein unkooperativer Writer dazwischen ein, bleiben dessen Bytes am
> Zielnamen und die alten beziehungsweise neuen Bytes unter gebundenen Namen
> erhalten; der Vorgang endet sichtbar als Konflikt und niemals als stiller
> Erfolg.

H03 entscheidet nur diese native repositoryweite Write-/Recovery-Hypothese.
Es baut keinen neuen Renderer und wiederholt die H02-Prozessgates nicht. Ein
H03-Go erlaubt lediglich einen Plan für die vollständige P01-Wiederholung auf
Linux mit der belegten H02-Prozesskette. Windows, macOS, Plattform-ADR und P02
bleiben offen beziehungsweise gesperrt.

## Bewertete Alternativen

| Ansatz | Entscheidung |
| --- | --- |
| Ziel → exklusives Backup, dann Temp → Ziel jeweils ohne Replace | **H03-Kandidat**; kein Schritt überschreibt einen neu belegten Namen |
| `RENAME_EXCHANGE` nach Vorprüfung | verworfen; tauscht einen zwischenzeitlich konkurrierenden Inode aus, ohne den erwarteten Inode atomar zu vergleichen |
| advisory Lock oder Linux Lease | verworfen; bindet keinen unkooperativen Writer |
| SQLite/WAL als bloßer Dateiersatz | verworfen; löst Rohdatei-Manipulation und bestehende MapRepository-Mehrdateisemantik nicht automatisch |
| Berechtigungen oder gleicher Nutzer als Vertrauensannahme | verworfen; kein Beleg gegen andere Prozesse desselben Kontos |

## Fester H03-Schnitt

### Prozess und Besitz

Ein externer Controller startet pro Szenario genau einen nativen Linux-Helper
in einem neuen Testroot. Ein zweiter, separat aufgezeichneter Adversary-Prozess
führt ausschließlich die geplante konkurrierende Namens-/Link-/Mountmutation
aus. Der Controller beendet an Faultpunkten nur eigene H03-Prozesse und startet
Recovery immer in einem frischen Helperprozess.

H03 besitzt ausschließlich:

- `tools/adr-prototypes/p01-h03/**`;
- `tools/adr-prototypes/contracts/p01-v3/**`;
- `tests/adr-prototypes/p01-h03-*.test.*`;
- `tools/adr-prototypes/evidence/p01-h03-aggregate.json`;
- `package.json` und `package-lock.json` nur für exakt gepinnte temporäre
  H03-Befehle oder Abhängigkeiten;
- dieses Plandokument sowie die H03-Felder in `checkpoint.json` und
  `acceptance.json`.

`src/**`, H02-`p01-v2`, Produktbundle, installierter Adapter, Vaults und
Nutzerdaten liegen außerhalb des Besitzes. H03 importiert keine Produktlogik.
Vor und nach jedem Lauf werden `main.js`, `manifest.json` und `styles.css`
gehasht. Test- und Evidence-Roots liegen ausschließlich unter
`/home/aaron/.cache/dungeon-native-qa/smr-adr-prototypes/ADR-P01-H03/`.

### Native Namen und Identität

Der Helper öffnet den neuen Root einmal als Verzeichnis-FD und verwendet nur
validierte relative Namen. Jeder Dateischritt verwendet `openat2` mit
`RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS|RESOLVE_NO_MAGICLINKS`, prüft Root,
Parent, Mount, Gerät, Inode, Typ und Linkzahl neu und verweigert Hardlinks.
Temp-, Backup-, Child-Receipt- und Parent-Receipt-Namen enthalten eine zufällige
Transaktions-ID und entstehen mit `O_CREAT|O_EXCL` im selben Verzeichnis.

Der additive Vertrag `p01-v3` definiert kein allgemeines Dateisystem. Er kennt
nur gebundene `beginRepositoryTransaction`, Child-Create/Update/Delete,
`commitRepositoryTransaction`, `recoverRepository` und `inspectConflict` mit
festen Größenlimits. Pfade werden vom Controller nicht frei gewählt, sondern
aus einer beim Start gebundenen Fixture-Manifest-ID aufgelöst.

### Child-State-Machines

Jedes Child-Receipt bindet Operation, Parent-ID, Before-/After-Hash,
Gerät/Inode/Linkzahl, Temp-/Backupnamen und genau einen Zustand. Jeder
Receiptwrite wird in eine exklusive neue Receiptdatei geschrieben,
`fdatasync`/`fsync`-synchronisiert und per `RENAME_NOREPLACE` als nächste
Generation publiziert; anschließend wird das Receipt-Verzeichnis synchronisiert.
Vorherige Generationen bleiben bis zur Parent-Freigabe erhalten.

**Create**

1. After-Bytes in exklusives Temp schreiben und synchronisieren.
2. Child-Receipt `prepared` durable publizieren.
3. Temp per `renameat2(..., RENAME_NOREPLACE)` zum freien Ziel publizieren.
4. Zielidentität/After-Hash prüfen, Verzeichnis synchronisieren und Receipt
   `new-published`, danach `committed`, durable publizieren.

Ist der Zielname jemals belegt, bleibt dessen Inhalt unangetastet; Temp und
Receipt bleiben als sichtbarer Konflikt erhalten.

**Update**

1. Ziel per FD gegen Before-Hash und gebundene Identität prüfen; After-Temp
   schreiben und synchronisieren; Receipt `prepared` durable publizieren.
2. Ziel per `renameat2(target, exclusive-backup, RENAME_NOREPLACE)` capturen.
3. Backupidentität/Before-Hash prüfen, Verzeichnis synchronisieren und Receipt
   `old-captured` durable publizieren.
4. Temp ausschließlich mit `RENAME_NOREPLACE` am nun freien Ziel publizieren.
5. Zielidentität/After-Hash prüfen, Verzeichnis synchronisieren und Receipt
   `new-published`, danach `committed`, durable publizieren.

Belegt ein Writer den Zielnamen nach Capture neu, schlägt Schritt 4 ohne
Überschreiben fehl. Konkurrent, altes Backup und neue Tempbytes bleiben
erhalten; Recovery meldet Konflikt. `RENAME_EXCHANGE` ist verboten.

**Delete**

1. Ziel gegen Before-Hash/Identität prüfen und Receipt `prepared` durable
   publizieren.
2. Ziel per `RENAME_NOREPLACE` in den exklusiven Backupnamen capturen.
3. Backupidentität/Before-Hash und Zielabwesenheit prüfen, Verzeichnis
   synchronisieren und Receipt `deleted`, danach `committed`, durable
   publizieren.

Eine neue Belegung nach Capture wird nicht entfernt. Das Backup bleibt bis zur
Parent-Entscheidung erhalten und Recovery meldet den konkurrierenden Zielnamen.

### Parent-State-Machine und Recovery

Ein Parent-Receipt bindet den stabil sortierten gesamten Write-Satz aus Karte,
Notiz, Draft und Journal, jede Child-ID und aggregierte Before-/After-Digests.
Es besitzt `prepared`, `children-committed`, `committed`, `rolling-back`,
`rolled-back` oder `conflict`. Child-Backups, Temps und Receiptgenerationen
dürfen vor durablem Parent-`committed` oder verifiziertem Parent-`rolled-back`
nicht gelöscht werden.

Recovery liest in einem frischen Helper ausschließlich Receipts, gebundene
Namen, Identitäten und Hashes:

- Parent `prepared` oder ein unvollständiger Child-Satz wird vollständig auf
  den aggregierten Before-Zustand zurückgeführt;
- Parent `children-committed`/`committed` wird vollständig auf den
  aggregierten After-Zustand vervollständigt;
- jeder dritte Hash, fremde Inode, unerwartete Namensbelegung, fehlende
  Receiptgeneration oder verlorene Child-Retention wird `conflict`;
- Konfliktrecovery überschreibt und löscht nichts, sondern liefert ein
  begrenztes Inventar aller erhaltenen Wahrheiten.

Erst nach erneutem Hash-/Identitätsvergleich und Verzeichnissync darf Cleanup
die nicht mehr benötigten internen Namen entfernen. Zweifacher Recovery-Aufruf
ist idempotent und erzeugt denselben terminalen Zustand.

## Vollständige Fault- und Adversary-Matrix

Create, Update und Delete sind getrennte Pflichtzeilen. Für jede Zeile werden
mindestens folgende Killpunkte mit neuem Root und frischem Recoveryprozess
ausgeführt:

- vor/nach Temp-Sync;
- vor/nach durablem `prepared`;
- vor/nach Capture;
- vor/nach Capture-Verzeichnissync;
- vor/nach Publikation beziehungsweise Delete;
- vor/nach Publish-Verzeichnissync;
- vor/nach Child-Commit;
- vor/nach Parent-`children-committed` und Parent-`committed`;
- vor, während und nach Parent-Freigabe.

An jedem anwendbaren Dateisystemschritt werden zusätzlich separat injiziert:

- Zielneubelegung durch einen unkooperativen Prozess;
- Ziel-Symlink, Parent-Symlink und Hardlink;
- Austausch von Zielidentität, Parent und Rootpfad;
- Mount-/Gerätewechsel, soweit der isolierte Host ihn sicher erlaubt;
- beschädigte, fehlende, doppelte oder fremde Receiptgeneration;
- zweiter Recoverylauf und konkurrierter Recoveryversuch.

Jede Matrixzelle nennt `passed`, `failed` oder `not-run`, alle verbliebenen
Dateien und deren Hash/Identität. Eine als Host nicht sicher injizierbare
Pflichtzelle ist `not-run` und damit H03-No-Go, nicht übersprungen.

## Orakel und harte Gates

- Create endet ausschließlich vollständig neu oder als erhaltener Konflikt.
- Update endet ausschließlich vollständig alt, vollständig neu oder als
  erhaltener Konflikt mit allen beobachteten Wahrheiten.
- Delete endet ausschließlich vollständig alt, verifiziert abwesend oder als
  erhaltener Konflikt.
- Der Parent endet ausschließlich im vollständigen aggregierten Before- oder
  After-Zustand oder in einem nicht überschreibenden Konflikt. Mischungen aus
  neuer Karte/alter Notiz oder altem Draft/neuem Journal sind Fehler.
- Kein Write wird vor durablem Parent-Commit bestätigt; kein Backup oder
  Child-Receipt wird vor Parent-Freigabe gelöscht.
- Alle Schritte sind auf demselben lokalen Dateisystem; fehlende Primitive,
  nicht nachweisbarer Verzeichnissync oder unerkannter konkurrierender Writer
  sind sofortiges No-Go.
- Native Quell-/Binärhashes, Compiler, Linker, libc, Kernel, geladene
  Bibliotheken, Buildbefehl, Source-/Lockfile-SHA und komplette Matrix stehen
  im sauberen externen Receipt.
- `npm run check`, `npm test` und `npm run build` bestehen auf dem exakten
  Receipt-Quellcommit; Produktinputs bleiben byteidentisch.
- Windows, macOS, Electron-Recomposition, GUI, Accessibility, Performance und
  installierter Adapter sind ausdrücklich `not-run`.

## Ausführungsfolge

1. `p01-v3` und Golden DTOs fixieren Receiptgenerationen, Zustände, Limits und
   Konfliktinventar; unabhängiger Contract-Review.
2. Native Child-State-Machines und reine Create/Update/Delete-Faultmatrix.
3. Parent-/Child-Retention, Mehrdatei-Before/After und idempotente Recovery.
4. Separater Adversary-Prozess für jede TOCTOU-/Link-/Identity-/Root-/Mount-
   Zelle; keine simulierte Funktionsabkürzung im Helper.
5. Sauberer exakter Kandidaten-SHA erzeugt unveränderliches externes Receipt
   und gehashten Aggregatbeleg; unabhängiger Code-/Security-/Evidence-Review.
6. Eigener Cleanup-Commit und Cleanup-Review entfernen Helper, Runner, Tests,
   Befehle und temporäre Abhängigkeiten; `p01-v3`, Golden DTOs und Aggregat
   bleiben.

Nach höchstens zwei vollständigen Fehlversuchen oder 45 Minuten an derselben
Hypothese wird anhand der Belege entschieden.

## Review- und Geräteaufteilung

- Lokaler Umsetzungsstrang: Vertrag, Linux-Helper, Controller und Receipts.
- Zweiter lokaler Strang: unabhängiger Plan-, Contract-, Code-/Evidence- und
  Cleanup-Review; keine Mitautorenschaft am jeweiligen Kandidaten.
- abgelöster GM-Cloud-Kollege: Architekturreview der Capture/Publish-
  State-Machine und der Trennung H02-Prozessbeleg/H03-Durability.
- Cloud-Sicherheitskollegen: unkooperative Writer, TOCTOU, Root-/Parent-/Mount-,
  Link-/Identity- und Receipt-Korruptionsmatrix.
- Dungeon-/Atlas-Gerätekollegen: nur das spätere Mehrdatei-Orakel; keine
  parallelen GUI-Läufe für H03.
- Windows-/macOS-Kollegen: keine H03-Freigabe durch Linuxdaten; eigene native
  Folgepläne bleiben erforderlich.

## Entscheidung

`H03-Go` bedeutet nur, dass die fehlende Linux-Durability-/Recovery-Hypothese
für einen anschließenden vollständigen ADR-P01-Linux-Wiederholungsplan taugt.

`H03-No-Go` gilt bei stillem Überschreiben, Datenverlust, drittem akzeptiertem
Hash, unvollständigem Parentzustand, vorzeitiger Bestätigung/Freigabe,
fehlender Pflichtmatrixzelle oder nicht reproduzierbarem Receipt.

ADR-P02 bis ADR-P04, ADR-C01 und die Plattform-ADR bleiben in beiden Fällen
gesperrt beziehungsweise vorgeschlagen.
