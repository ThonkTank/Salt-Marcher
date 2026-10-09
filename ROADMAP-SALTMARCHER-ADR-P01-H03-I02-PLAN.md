# ADR-P01-H03-I02 – Native Child-State-Machines und Faultmatrix

Planstatus: reviewpflichtig; keine Implementierung, Evidence oder Freigabe.

## Scope und Besitz

I02 implementiert später ausschließlich `tools/adr-prototypes/p01-h03/**`, passende H03-Tests und externe QA unter `/home/aaron/.cache/dungeon-native-qa/smr-adr-prototypes/ADR-P01-H03/`. Produktquellen, Electron, P02 und vorhandene Contracts bleiben unverändert.

## Native Grenze

Ein Linux-Helper hält genau einen Root-FD und nutzt `openat2` mit `RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS|RESOLVE_NO_MAGICLINKS`, `O_CREAT|O_EXCL`, `fdatasync`, `fsync` und ausschließlich `renameat2(RENAME_NOREPLACE)`. Jede Identität prüft Gerät, Inode, Typ und Linkzahl erneut. Ein fehlendes Primitive, Mountwechsel oder unsicherer Directory-Sync ist No-Go.

## Zustandsmaschinen

Der Helper akzeptiert nur den reviewten p01-v3 DTO. Vor jeder Hilfsdatei steht ein durables Parent-/Child-`prepared`. Create folgt `prepared → temp-synced → new-published → committed`; Update folgt `prepared → before-snapshotted → ready-to-capture → old-captured → new-published → committed`; Delete folgt `prepared → before-snapshotted → ready-to-capture → old-captured → deleted → committed`. Jeder Abbruch schreibt `conflict`; Rollback verwendet nur die vertraglichen `rolling-back`, `rollback-captured`, `rollback-published`, `rolled-back`-Übergänge. Before-Snapshot, Capture, Rollback-Capture und Receiptgenerationen bleiben retained; durch `RENAME_NOREPLACE` verschobene Temp- und Restore-Temp-Namen sind anschließend ausdrücklich abwesend.

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

## Normative N03-Transitions- und Faultmatrix

Die einzige normative Übergangs- und Zellspezifikation dieses Plans ist
`ROADMAP-SALTMARCHER-ADR-P01-H03-I02-MATRIX.json`. Frühere R01-, R02- und
R03-Tabellenregeln sind durch dieses Artefakt ersetzt und dürfen nicht als
Fallback verwendet werden. Das JSON ist Planung, kein Helper, Testreceipt oder
Evidence.

Das Artefakt enthält 87 einzeln benannte Transitionen. Jede nennt Operation,
einen einzigen Quellzustand, einen einzigen Zielzustand, Mutation, vollständige
durable Receiptfolge und für `before`, `during` und `after` jeweils einen
vollständigen Vektor aus Receipt, Target, Temp, BeforeSnapshot, Capture,
RollbackCapture, RestoreTemp, Parentzustand/-digest und terminalem
Fresh-Recovery-Ergebnis. Die Phasen sind im JSON abschließend definiert:
`before` liegt vor der Mutation, `during` nach Mutation und erforderlichem
Datei-/Directory-Sync bei noch nicht publizierter Zielgeneration, `after`
nach Publikation und Receipt-Directory-Sync.

Die Contract-Ausrichtung ist bindend:

- Create besitzt nur `prepared → temp-synced → new-published → committed`;
  nicht vorhandene Before-/Capture-/Restore-Namen sind `not-applicable`.
- Update besitzt keinen `temp-synced`-Zustand. Die After-Temp wird in
  `before-snapshotted → ready-to-capture` erzeugt und gebunden.
- Delete besitzt ausdrücklich
  `ready-to-capture → old-captured → deleted → committed`.
- Jeder zulässige Rollback-Startzustand ist eine eigene Transition. Auch
  Fortsetzungen aus `rolling-back` sind nach ihrer Startprovenienz getrennt,
  damit der p01-v3-Artefaktvektor deterministisch bleibt.
- Jeder zulässige Child-Konfliktquellzustand führt in einer eigenen Transition
  zu `conflict-before-capture` oder `conflict`. Jeder Parent-Rollback- und
  Parent-Konfliktquellzustand ist ebenfalls einzeln aufgeführt.
- Der Parent bindet weiterhin den stabil sortierten vollständigen Vierer-Satz
  `draft`, `journal`, `map`, `note` und dessen p01-v3 Before-/After-
  Aggregatdigests.

## Geschlossene Zellerzeugung

Die Matrix besitzt genau drei Dimensionen: eine der 87 Transitionen, genau eine
der drei Phasen und genau eines der 13 Adversary-Overlays. Daraus entstehen
3.393 zulässige Zell-IDs. Für jede Zell-ID wird genau ein Base-Vektor mit genau
einem transition- und phasenspezifischen Overlay-Eintrag per der im JSON
definierten Deep-Merge-Regel kombiniert. Jedes Overlay partitioniert in jeder
Phase sämtliche 87 Transition-IDs exakt einmal in `results` oder
`notApplicable`; Klassenbereiche, implizite Defaultregeln und Fallbacks sind
unzulässig.

Jeder anwendbare Overlay-Eintrag enthält genau eine `oracleId`. Sie verweist
auf genau einen deduplizierten, unveränderlichen Resultat-Patch im
`overlayOracles`-Inventar mit konkretem Konfliktzustand,
Target-/Receipt-Effekt, retained Wahrheiten, Parent-`conflict`/-Digest und
identischem zweiten Recoveryergebnis. Die Deduplizierung ist rein
referenziell; sie führt keine semantische Klasse oder Ableitungsregel ein.
Unzulässige Dimensionen enthalten pro Transition und Phase
`not-applicable` samt Grund. `mount-device` ist ein Pflichtoverlay; kann der
Host es nicht sicher injizieren, lautet das Ergebnis `not-run` und damit H03
`No-Go`.

Ein späterer Controller muss die JSON-Zell-ID lexikalisch unverändert in sein
externes Receipt übernehmen und jede anwendbare Zelle als `passed`,
`failed` oder `not-run` ausgeben. `not-run` ist für jede Pflichtzelle
No-Go. Zweite Recovery muss Zustand, retained Namen und Digest exakt
reproduzieren. Kein Helper darf aus dem Markdown zusätzliche Zustände,
Applicability oder Orakel ableiten.

## Planhistorie und nächstes Gate

R01 auf `e0cff1d0d112633fa3f6288d95973de936a5dbc3`, R02 auf
`2c5e765a62c6a1f8210a0bd53255b97df5b821d2` und R03 auf
`b4f50c52e926d6ee7d7016d29b2d58192c0377d8` wurden unabhängig geprüft und
wegen der jeweils dokumentierten Matrix-/Orakellücken nicht freigegeben. N03
ersetzt ausschließlich die fehlerhaften Planregeln; der reviewte p01-v3-
Contract und die frühere Historie bleiben unverändert.

N03 endet erst nach unabhängiger read-only Prüfung des exakten Candidate-SHA.
Erst ein PASS autorisiert einen getrennten I02-Implementierungslauf. Weder
dieser Plan noch sein Review erzeugt einen Helper, eine Test- oder
Evidence-Datei, ein Linux-Durability-Go, eine Plattformentscheidung oder eine
P02-Autorisierung.
