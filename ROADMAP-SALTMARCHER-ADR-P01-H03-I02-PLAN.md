# ADR-P01-H03-I02 – Native Child-State-Machines und Faultmatrix

Planstatus: reviewpflichtig; keine Implementierung, Evidence oder Freigabe.

## Scope und Besitz

I02 implementiert später ausschließlich `tools/adr-prototypes/p01-h03/**`, passende H03-Tests und externe QA unter `/home/aaron/.cache/dungeon-native-qa/smr-adr-prototypes/ADR-P01-H03/`. Produktquellen, Electron, P02 und vorhandene Contracts bleiben unverändert.

## Native Grenze

Ein Linux-Helper hält genau einen Root-FD und nutzt `openat2` mit `RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS|RESOLVE_NO_MAGICLINKS`, `O_CREAT|O_EXCL`, `fdatasync`, `fsync` und ausschließlich `renameat2(RENAME_NOREPLACE)`. Jede Identität prüft Gerät, Inode, Typ und Linkzahl erneut. Ein fehlendes Primitive, Mountwechsel oder unsicherer Directory-Sync ist No-Go.

## Zustandsmaschinen

Der Helper akzeptiert nur den reviewten p01-v3 DTO. Vor jeder Hilfsdatei steht ein durables Parent-/Child-`prepared`. Create folgt `prepared → temp-synced → new-published → committed`; Update folgt `prepared → before-snapshotted → ready-to-capture → old-captured → new-published → committed`; Delete folgt `prepared → before-snapshotted → ready-to-capture → deleted → committed`. Jeder Abbruch schreibt `conflict`; Rollback verwendet nur die vertraglichen `rolling-back`, `rollback-captured`, `rollback-published`, `rolled-back`-Übergänge. Temp, Snapshot, Capture, Rollback-Capture und Staging bleiben retained.

## Fault- und Adversary-Matrix

Jede Create/Update/Delete-Zeile erhält frischen Root und Helper. Killpunkte: vor/während/nach Parent-Staging, Parent-/Child-Prepared, Temp-/Snapshot-Sync, Zielverifikation, Capture, Publish/Delete, Directory-Sync, Child-Commit und jedem Rollback-Schritt. Jede anwendbare Zelle wird zusätzlich gegen Zielersatz, in-place-FD-Write, Neubelegung, Symlink, Hardlink, Parent-/Root-/Mountwechsel, Receipt-Korruption und zweiten Recoverylauf geprüft. Nicht sicher injizierbare Pflichtzellen bleiben `not-run` und erzeugen No-Go.

## Orakel und Abbruch

Create erlaubt nur neues Ziel, verifizierte Abwesenheit oder retained Konflikt. Update erlaubt nur vollständiges Before, vollständiges After oder retained Konflikt mit Payload-Snapshot, Capture, Temp und konkurrierendem Ziel. Delete erlaubt nur Before, Abwesenheit oder retained Konflikt. Dritte Hashes, fremde Namen/Identitäten, unvollständige Receiptketten oder Mischung mehrerer Childzustände brechen sofort ab. Nach zwei vollständigen Fehlversuchen oder 45 Minuten derselben Hypothese wird anhand der Matrix entschieden.

## Provenienz und Gates

Jeder spätere Lauf protokolliert exakten Commit, Contract-/Source-/Binary-Hashes, Compiler/Linker/libc/Kernel, Befehle, Fixture-Digests und vollständige Matrix. Ein separater Code/Security/Evidence-Review und anschließender Cleanup bleiben Pflicht. I02 behauptet weder ausführbaren H03-Nachweis noch Linux-Go, Plattformentscheidung oder P02-Autorisierung.

## Konkreter späterer Umsetzungsumfang

Der spätere I02-Implementierungscommit darf nur `tools/adr-prototypes/p01-h03/helper.c`,
`tools/adr-prototypes/p01-h03/controller.mjs`, `tools/adr-prototypes/p01-h03/adversary.c`,
`tools/adr-prototypes/p01-h03/Makefile` und `tests/adr-prototypes/p01-h03-*.test.mjs`
anlegen oder ändern. Er importiert weder `src/` noch Obsidian/Electron-Code. Der Controller
kompiliert mit `cc -std=c17 -Wall -Wextra -Werror`, startet Helper und Adversary als getrennte
Prozesse, und legt sämtliche Wurzeln ausschließlich unter dem im H03-Plan festgelegten Cachepfad
an. `npm run check`, `npm test` und `npm run build` bleiben zusätzlich Pflicht; keine Ausgabe
gehört ins Repository außer den später ausdrücklich erlaubten H03-Receiptdateien.

Der Helper verwendet einen einmal geöffneten Root-Directory-FD. Jede Komponente wird mit
`openat2(rootfd, relative, { .flags=O_RDONLY|O_DIRECTORY|O_CLOEXEC, .resolve=RESOLVE_BENEATH|
RESOLVE_NO_SYMLINKS|RESOLVE_NO_MAGICLINKS })` oder dem jeweiligen `openat`-Nachfolger geöffnet.
Hilfsdateien nutzen `O_WRONLY|O_CREAT|O_EXCL|O_CLOEXEC`, 0600, `fdatasync`; Verzeichnisse nutzen
`fsync`. Ausschließlich `renameat2(..., RENAME_NOREPLACE)` publiziert Namen. `ENOSYS`,
`EINVAL`, `EXDEV`, fehlendes `openat2`, nicht prüfbarer Directory-`fsync`, `EOPNOTSUPP`,
unerwartetes `errno` oder ein Fallback auf `rename`, `link`, Replace oder Pfadstringzugriff ist
sofortiger No-Go. Vor und nach jedem Namenwechsel prüft der Helper `fstatat`/`fstat` auf regulären
Typ, gleiches Gerät/Mount, erwartetes device/inode/linkCount=1 und den unveränderten Root-FD.

## Ausführbare Übergangstabelle

Jede Zeile publiziert vor der Mutation eine neue, exklusive und synchronisierte
Receiptgeneration; danach folgt `fsync(receipt-dir)`. `P` bedeutet Parent-`prepared`, `C` ein
Child-Receipt, `B` den aus dem Request geschriebenen Before-Snapshot und `T` die After-Temp.

| Operation | Übergang | Precondition | Postcondition und Recovery-Orakel |
| --- | --- | --- | --- |
| Create | `prepared → temp-synced` | P/C prepared, Ziel abwesend | T=After synchron; Recovery hält Ziel abwesend oder Konflikt |
| Create | `temp-synced → new-published → committed` | T=After, Ziel abwesend | T nach Rename abwesend, Ziel=After; Recovery vervollständigt After |
| Create rollback | `rolling-back → rollback-captured → rolled-back` | eigenes Ziel=After | Rollback-Capture=After retained, Ziel abwesend |
| Update | `prepared → before-snapshotted` | P/C prepared, Payload=Before | B=Before synchron und retained |
| Update | `before-snapshotted → ready-to-capture` | B=Before, Ziel=Before/Identität | T=After synchron; Abweichung ist Konflikt ohne Rename |
| Update | `ready-to-capture → old-captured → new-published → committed` | Capture-Ziel frei | Capture=Before retained, Ziel=After, T abwesend |
| Update rollback | `rolling-back → rollback-captured → rollback-published → rolled-back` | eigenes Ziel=After | Rollback-Capture=After und B=Before retained; Restore-Temp nach Rename abwesend, Ziel=Before |
| Delete | `prepared → before-snapshotted → ready-to-capture` | wie Update ohne T | B=Before, Ziel=Before |
| Delete | `ready-to-capture → deleted → committed` | Capture-Ziel frei | Capture=Before retained, Ziel abwesend |
| Delete rollback | `rolling-back → rollback-published → rolled-back` | Capture=Before, Ziel abwesend | Restore-Temp nach Rename abwesend, Ziel=Before |

`conflict-before-capture` und `conflict` dürfen keine Wahrheit entfernen: B, Capture und
Rollback-Capture bleiben, während konkurrierende Evidence einen beliebigen, aber vollständig
gebundenen Hash/Länge/Identität enthält. Eine Recovery darf nur `prepared` zum aggregierten Before
oder `children-committed`/`committed` zum aggregierten After vervollständigen; jede Mischlage,
dritte Wahrheit, fehlende Generation oder fremde Identität endet retained `conflict`.

## Killpoints, Recovery und Adversary

Für jede Tabellenzeile führt der Controller mit frischem Root alle Punkte `before`, `during` und
`after` aus: Parent-Staging, Parent-prepared, Child-prepared, B-Write/B-fdatasync,
Zielverifikation, T-Write/T-fdatasync, Capture, jeder Publish-Rename, jeder Directory-fsync,
Child-commit, Parent-children-committed, Parent-committed und jeder Rollback-Schritt. Nicht
anwendbare Zellen erhalten `not-applicable` mit Begründung; jede anwendbare Zelle muss `passed`
oder `failed` werden, `not-run` ist No-Go. Nach Controller-Kill startet ausschließlich ein frischer
Helper Recovery zweimal; der zweite Lauf muss denselben Terminalzustand, dieselben retained Namen
und denselben Digest liefern.

Zu jedem Killpoint startet der separat aufgezeichnete Adversary genau eine Mutation: Replace vor
Capture, in-place write über vorab offenen FD während Verifikation, Neubelegung nach Capture,
Target-/Parent-Symlink, Hardlink, Root-/Parent-Austausch, Receipt-Duplikat/Korruption und – sofern
der Host es sicher zulässt – Mount-/Gerätewechsel. Jeder Lauf prüft errno, Root-/Parent-FD,
device/inode/linkCount, alle gebundenen Namen und das begrenzte Orphan-Inventar. Nicht sicher
injizierbarer Mountfall bleibt `not-run` und damit H03-No-Go, nie übersprungen.

## Ressourcen, Determinismus und Gates

Der Controller begrenzt Childzahl auf den V3-Satz, Bytes auf `MAX_BYTES`, Orphans auf
`MAX_ORPHANS`, Prozesslaufzeit und Receiptgenerationen pro Szenario. Er beendet nur eigene
Prozesse; nie fremde Anwendungen. Jeder Abbruch speichert Ursache, Killpoint, errno, gebundene
Hashes/Identitäten und retained Inventar. Nach zwei vollständigen Matrixfehlversuchen oder 45
Minuten derselben Hypothese wird nicht weiter variiert: der Status ist anhand der vollständigen
Matrix `failed`/No-Go.

I02-P01 endet erst nach unabhängiger Planprüfung. Erst deren PASS autorisiert I02-Implementierung;
deren exakter Commit benötigt anschließend getrennte Code-/Security-/Evidence-Reviews. Befunde
erzeugen einen separaten Repair-Plan und Repair-Commit. Erst nach Matrix-PASS folgt ein eigener
Cleanup-Plan; weder dieser Plan noch ein späterer PASS autorisiert H03-Go, P02 oder Plattform-Go.

## R01-Reparatur: erzeugbare Receipt- und Matrixzellen

Die folgenden Tabellen ersetzen jede implizite Sammelregel. `RG(n)` bedeutet: exklusive neue
Receiptgeneration schreiben, `fdatasync`, `renameat2(RENAME_NOREPLACE)`, dann `fsync(receipt-dir)`;
der jeweilige Zustand ist erst danach sichtbar. Jede Zeile besitzt damit eine prüfbare Generation.

| Parent-ID | Vorbedingung | Mutation nach RG | nächste RG/fsync | Fresh-Recovery-Orakel |
| --- | --- | --- | --- | --- |
| P01 prepared | kein Child-Schritt | Parent prepared | RG(parent prepared), dir-fsync | Before, kein Child oder retained vorbereitete Wahrheit |
| P02 children-committed | alle vier Child committed, After-Digest | Parent children-committed | RG, dir-fsync | aggregiertes After vervollständigen |
| P03 committed | P02 sichtbar | Parent committed | RG, dir-fsync | aggregiertes After, idempotent |
| P04 rolling-back | P01/P02/P03, keine fremde Wahrheit | Parent rolling-back | RG, dir-fsync | operationale Rollbacks fortsetzen oder conflict |
| P05 rolled-back | alle Child rolled-back, Before-Digest | Parent rolled-back | RG, dir-fsync | aggregiertes Before, retained Artefakte |
| P06 conflict | dritte Wahrheit/Receiptverlust/fremde Identität | keine Überschreibung | RG(conflict), dir-fsync | retained conflict, unverändert beim zweiten Lauf |

Für jede Childoperation erzeugt der Controller exakt diese Transition-IDs; jeder Pfeil bedeutet
vorherige RG, Dateimutation, Identitäts-/Hashprüfung, nachfolgende RG und Directory-fsync.

| Operation | IDs in Reihenfolge | Fresh-Recovery-Orakel |
| --- | --- | --- |
| Create | C01 prepared→temp-synced; C02 temp-synced→new-published; C03 new-published→committed; C04 committed→rolling-back; C05 rolling-back→rollback-captured; C06 rollback-captured→rolled-back; CF-prepared/CF-temp-synced/CF-new-published/CF-committed/CF-rolling-back/CF-rollback-captured/CF-rolled-back jeweils →conflict | Ziel After nach C03, Ziel abwesend nach C06, Rollback-Capture retained |
| Update | U01 prepared→before-snapshotted; U02 before-snapshotted→ready-to-capture; U03 →old-captured; U04 →new-published; U05 →committed; U06 →rolling-back; U07 →rollback-captured; U08 →rollback-published; U09 →rolled-back; UF-prepared/UF-before-snapshotted/UF-ready-to-capture→conflict-before-capture; UF-old-captured/UF-new-published/UF-committed/UF-rolling-back/UF-rollback-captured/UF-rollback-published/UF-rolled-back→conflict | B/Capture retained; Target Before vor U03, After U04–U07, Before U08/U09 |
| Delete | D01 prepared→before-snapshotted; D02 before-snapshotted→ready-to-capture; D03 →deleted; D04 →committed; D05 →rolling-back; D06 →rollback-published; D07 →rolled-back; DF-prepared/DF-before-snapshotted/DF-ready-to-capture→conflict-before-capture; DF-old-captured/DF-deleted/DF-committed/DF-rolling-back/DF-rollback-published/DF-rolled-back→conflict | B/Capture retained; Target Before vor D03, abwesend D03–D05, Before D06/D07 |

Die formal geschlossene Matrix ist das kartesische Produkt
`M = {C01..C06,CF-*,U01..U09,UF-*,D01..D07,DF-*,P01..P06} × {before,during,after} × A`.
`A={replace-before-capture,inplace-fd-write,rebind-after-capture,target-symlink,parent-symlink,
hardlink,root-swap,parent-swap,mount-device,receipt-missing,receipt-duplicate,receipt-corrupt,
second-recovery}`. Zell-ID ist `H03-I02-<transition>-<phase>-<adversary>`; der Controller erzeugt
sie lexikographisch. Applicability: Capture-Klassen nur U03/U04/D03 und deren Recovery; After-capture
nur C02/U03/U04/D03; Mount nur wenn sicher privilegiert, sonst `not-run`=No-Go; übrige Zellen sind
pflichtig. Erwartung jeder anwendbaren Zelle ist exakt das Tabellenorakel der Transition plus:
Temp vor Rename=After/nach Rename=abwesend; B/Capture/Rollback-Capture=retained present; Restore-Temp
nach Rename=abwesend; Receipt=letzte RG oder retained conflict; Parent=P01 Before, P02/P03 After,
P05 Before, P06 conflict. Jeder andere Hash, Name, inode oder Mischzustand ist `failed`.

### N02 Fresh-Recovery-Lookup

Für jede Zell-ID gilt folgende vollständige Lookup-Tabelle; `before` liefert die vorige RG,
`during` nur die vorige RG oder die nächste atomar publizierte RG (nie Mischbytes), `after` die
nächste RG. Target/Temp/B/C/R sind jeweils exakt die im Übergangstableau genannte Wahrheit.

| Klasse | before | during | after | Parent-Digest |
| --- | --- | --- | --- | --- |
| normale `C/U/D 01..09` | Quell-Receipt, Quellorakel | Quell-RG oder Ziel-RG, atomare Namen | Ziel-Receipt/Zielorakel | P01=Before; P02/P03=After |
| Rollback `C04..C06/U06..U09/D05..D07` | Quell-RG, retained B/C/R | Quell-RG oder Ziel-RG | Ziel-RG, moved Temp abwesend | P04 laufend, P05=Before |
| Conflict `CF/UF/DF` | Quell-RG | Quell-RG oder conflict-RG | conflict-RG, konkurrierende Evidence retained | P06=conflict |
| Parent `P01..P06` | vorige Parent-RG, Childsatz unverändert | vorige oder nächste Parent-RG | genau P01..P06-RG | P01/P05 Before; P02/P03 After; P04 laufend; P06 conflict |
