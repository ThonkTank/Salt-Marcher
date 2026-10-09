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

> Ein nativer Linux-Transaktionsdienst kann die vom engen Compare-and-Write-
> Auftrag gelieferten erwarteten alten Bytes zuerst in einen exklusiven,
> synchronisierten Before-Snapshot materialisieren, danach den aktuellen Zielnamen ohne
> Überschreiben capturen und erst dann die synchronisierte neue Datei mit
> `RENAME_NOREPLACE` publizieren. Greift ein unkooperativer Writer vor oder
> nach dem Capture ein, bleiben erwartete alte Bytes, beobachtete konkurrierende
> Bytes und neue Bytes getrennt erhalten; der Vorgang endet sichtbar als
> Konflikt und niemals als stiller Erfolg.

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
Temp-, Before-Snapshot-, Capture-, Child-Receipt- und Parent-Receipt-Namen
enthalten eine zufällige 256-Bit-Transaktions-ID. Temp-, Snapshot- und
Receiptdateien entstehen mit `O_CREAT|O_EXCL` im selben Verzeichnis.
Capture-Zielnamen bleiben bis zum `RENAME_NOREPLACE` unbelegt; erst dieser
Rename belegt sie exklusiv. Dasselbe gilt für Rollback-Capture-Zielnamen.
Alle vorgesehenen Namen sind vor dem ersten Hilfsdateischritt im durablen
Receipt gebunden; eine zufällige Kollision oder fremde Belegung ist Konflikt.

Der H03-Adversary ist ein unkooperativer Editor des gebundenen fachlichen
Zielnamens: Er darf ihn ersetzen, neu anlegen, löschen oder über einen bereits
offenen FD in-place verändern. Er erhält keine interne Transaktions-ID und
keinen Zugriff durch den H03-Vertrag. Ein bösartiger Prozess desselben
OS-Kontos, der das interne Transaktionsverzeichnis enumeriert und gezielt
manipuliert, ist mit gewöhnlichen Dateirechten nicht isolierbar und deshalb
eine ausdrücklich offene spätere OS-Principal-/Sandbox-Frage, kein durch H03
behauptetes Sicherheitstor.

Der additive Vertrag `p01-v3` definiert kein allgemeines Dateisystem. Er kennt
nur gebundene `beginRepositoryTransaction`, Child-Create/Update/Delete,
`commitRepositoryTransaction`, `recoverRepository` und `inspectConflict` mit
festen Größenlimits. Pfade werden vom Controller nicht frei gewählt, sondern
aus einer beim Start gebundenen Fixture-Manifest-ID aufgelöst.

Update und Delete erhalten wie der bestehende `FileStore.compareAndWrite`-Port
die erwarteten Before-Bytes als unveränderlichen, größenbegrenzten Payload. Der
Vertrag bindet diese Bytes und ihren Hash an Parent, Child und Ziel-ID. Der
Before-Snapshot wird ausschließlich aus diesem Payload geschrieben, nie aus
dem gleichzeitig extern beschreibbaren Ziel-Inode. Der Ziel-FD dient nur zur
Verifikation gegen die bereits unabhängig erhaltene Before-Wahrheit. Ein
falscher Payload, torn Read oder abweichender Zielhash stoppt vor jeder
Namensmutation als Konflikt.

### Child-State-Machines

Das Parent-Receipt `prepared` wird vor dem ersten Child- oder Hilfsdateischritt
durable publiziert und bindet sämtliche Child-IDs und vorgesehenen Namen. Jedes
Child-Receipt `prepared` wird vor dessen erster Hilfsdatei durable publiziert;
es bindet Operation, Parent-ID, Before-/After-Hash, Temp-/Before-Snapshot-/
Capturenamen und genau einen Zustand. Identität (Gerät/Inode/Linkzahl) einer
noch nicht vorhandenen Datei bleibt zunächst ausdrücklich `pending` und wird
erst nach deren Erzeugung und Sync in einer neuen Receiptgeneration gebunden. Jeder
Receiptwrite wird in eine exklusive neue Receiptdatei geschrieben,
`fdatasync`/`fsync`-synchronisiert und per `RENAME_NOREPLACE` als nächste
Generation publiziert; anschließend wird das Receipt-Verzeichnis synchronisiert.
Vor der ersten Parent-Publikation darf nur dessen Receipt-Stagingdatei
entstehen, keine Child-Hilfsdatei und keine Zielmutation. Ein Kill in dieser
Phase lässt den Zielzustand durch H03 unverändert. Vor Anlage der
Stagingdatei belegen Controller-Killpunkt, vollständige Zielprüfung gegen das
Fixture-Before-Inventar und ein leeres Transaktionsverzeichnis den Zustand
`no-transaction`; es gibt dann weder Receipt noch Orphan. Nach Anlage
inventarisiert Recovery die Stagingdatei auch bei unvollständigem Inhalt und
behält sie als ungebundenen Orphan-Beleg. Sie wird nie als gültiges `prepared`
interpretiert. Eine abweichende Zielwahrheit ist in beiden Fällen Konflikt.
Vorherige Generationen bleiben bis zur Parent-Freigabe erhalten. H03 löscht
Before-Snapshot, Capture oder Receiptgenerationen auch nach Parent-Commit
nicht: sichere Reclamation gegenüber einem noch offenen fremden FD ist eine
eigene Folgefrage. Retentionbytes stehen vollständig im Receipt und ein H03-Go
enthält ausdrücklich keine Storage-/GC-Freigabe.

**Create**

1. Child-Receipt `prepared` mit vorgesehenem Tempnamen durable publizieren.
2. After-Bytes in exklusives Temp schreiben und synchronisieren; Identität und
   After-Hash in `temp-synced` durable publizieren.
3. Temp per `renameat2(..., RENAME_NOREPLACE)` zum freien Ziel publizieren.
4. Zielidentität/After-Hash prüfen, Verzeichnis synchronisieren und Receipt
   `new-published`, danach `committed`, durable publizieren.

Ist der Zielname jemals belegt, bleibt dessen Inhalt unangetastet; Temp und
Receipt bleiben als sichtbarer Konflikt erhalten.

**Update**

1. Child-Receipt `prepared` mit vorgesehenen Snapshot-, Temp- und freien
   Capturenamen durable publizieren. Die gebundenen erwarteten Before-Bytes aus
   dem unveränderlichen Auftrag in
   einen exklusiven Before-Snapshot schreiben, synchronisieren und dessen Hash
   gegen den gebundenen Before-Hash prüfen; Identität und Hash als
   `before-snapshotted` durable publizieren.
2. Ziel-FD öffnen, Identität festhalten und seine beobachteten Bytes gegen den
   bereits unabhängig erhaltenen Before-Snapshot prüfen. Ein torn Read oder
   abweichender Hash stoppt ohne Namensmutation als Konflikt.
3. After-Temp schreiben und synchronisieren; Identität und After-Hash im
   Receipt `ready-to-capture` durable publizieren.
4. Den zu diesem Zeitpunkt aktuellen Zielnamen per
   `renameat2(target, exclusive-capture, RENAME_NOREPLACE)` capturen.
5. Captureidentität/-hash prüfen und Verzeichnis synchronisieren. Entspricht
   die Capture nicht der ursprünglichen Zielidentität und dem Before-Hash,
   bleibt sie neben Before-Snapshot und Temp als `conflict-before-capture`
   erhalten; es wird nichts Neues publiziert.
6. Nur bei passender Capture Receipt `old-captured` durable publizieren und
   Temp ausschließlich mit `RENAME_NOREPLACE` am nun freien Ziel publizieren.
7. Zielidentität/After-Hash prüfen, Verzeichnis synchronisieren und Receipt
   `new-published`, danach `committed`, durable publizieren.

Ersetzt oder verändert ein Writer den Zielnamen vor Capture, bewahrt der
vom Auftrags-Payload erzeugte Before-Snapshot die erwartete alte Wahrheit und die Capture dessen
beobachtete konkurrierende Wahrheit. Belegt er den Zielnamen nach Capture neu,
schlägt die Publikation ohne Überschreiben fehl. Before-Snapshot, Capture,
Konkurrent am Ziel und neue Tempbytes bleiben erhalten; Recovery meldet
Konflikt. `RENAME_EXCHANGE` ist verboten.

**Delete**

1. Wie bei Update zuerst Child-Receipt `prepared` mit vorgesehenem Snapshot-
   und freiem Capturenamen durable publizieren. Danach die gebundenen
   erwarteten Before-Bytes aus dem Auftrag in
   einen exklusiven Before-Snapshot schreiben, synchronisieren und hashen;
   danach Ziel-FD/Identität/Bytes gegen diesen Snapshot verifizieren. Torn Read
   oder Abweichung stoppt ohne Namensmutation. Nach Snapshot-Sync wird dessen
   Identität in `before-snapshotted`, nach Zielverifikation in
   `ready-to-capture` durable publiziert.
2. Den aktuellen Zielnamen per `RENAME_NOREPLACE` in den exklusiven
   Capturenamen bewegen.
3. Captureidentität/Before-Hash prüfen. Bei Abweichung Snapshot und
   konkurrierende Capture als `conflict-before-capture` erhalten; Delete nicht
   bestätigen. Nur bei Übereinstimmung Zielabwesenheit prüfen, Verzeichnis
   synchronisieren und Receipt `deleted`, danach `committed`, durable
   publizieren.

Eine neue Belegung nach Capture wird nicht entfernt. Before-Snapshot und
Capture bleiben dauerhaft erhalten und Recovery meldet den konkurrierenden
Zielnamen.

### Parent-State-Machine und Recovery

Ein Parent-Receipt bindet den stabil sortierten gesamten Write-Satz aus Karte,
Notiz, Draft und Journal, jede Child-ID und aggregierte Before-/After-Digests.
Es besitzt `prepared`, `children-committed`, `committed`, `rolling-back`,
`rolled-back` oder `conflict`. Child-Snapshots, Captures, Temps und
Receiptgenerationen dürfen vor durablem Parent-`committed` oder verifiziertem
Parent-`rolled-back` nicht gelöscht werden; H03 selbst gibt sie auch danach
nur logisch, nicht physisch, frei.

Recovery liest in einem frischen Helper publizierte Receipts, gebundene
Namen, Identitäten und Hashes sowie ein begrenztes Inventar aller
Receipt-Stagingnamen im Transaktionsverzeichnis. Ohne publiziertes
Parent-Receipt verwendet sie das gebundene Fixture-Before-Inventar als Orakel:

- Ein Parent-`prepared` ohne Child-Receipt hat noch keine Child-Hilfsdatei;
  ein Child-`prepared` darf fehlende oder teilweise geschriebene gebundene
  Hilfsdateien haben. Recovery inventarisiert auch diese Namen samt
  Abwesenheit, Länge und vorhandenem Hash, lässt unvollständige Dateien
  retained und bestätigt keinen After-Zustand. Für Create ist der alte Zustand
  der verifiziert abwesende Zielname. Für Update/Delete darf vor Capture nur
  ein erneut gegen den gebundenen Before-Hash verifiziertes Ziel als alter
  Zustand gelten; jede Abweichung wird retained Konflikt. Erst nach
  synchronisiertem Before-Snapshot darf Recovery einen Restore daraus
  versuchen;

- Parent `prepared` oder ein unvollständiger Child-Satz wird pro Child nach
  dem oben beschriebenen Frühzustand oder aus verifizierten Before-Snapshots
  vollständig auf den aggregierten Before-Zustand zurückgeführt; Restore-
  Publikation ist nur per `RENAME_NOREPLACE` auf freie Zielnamen zulässig;
- Parent `children-committed`/`committed` wird vollständig auf den
  aggregierten After-Zustand vervollständigt;
- jeder dritte Hash, fremde Inode, unerwartete Namensbelegung, nach Beginn
  eines Child-Hilfsdateischritts fehlende erforderliche Receiptgeneration
  oder verlorene Child-Retention wird `conflict`;
- Konfliktrecovery überschreibt und löscht nichts, sondern liefert ein
  begrenztes Inventar aller erhaltenen Wahrheiten.

Rollback ist pro Child-Operation explizit und schreibt für jeden Schritt eine
durable Receiptgeneration `rolling-back`, `rollback-captured`,
`rollback-published`, `rolled-back` oder `conflict`:

- **Create:** Ist das neue Ziel noch nicht publiziert, bleibt der Zielname
  abwesend und Temp wird nur retained. Ist es publiziert, muss Zielidentität und
  After-Hash exakt der eigenen Publication entsprechen. Dann wird es per
  `RENAME_NOREPLACE` in einen exklusiven retained Rollback-Capture bewegt,
  Zielabwesenheit geprüft und das Verzeichnis synchronisiert. Weicht das Ziel
  vor dem Move ab, bleibt es unangetasteter Konflikt. Weicht die Capture nach
  einer Race ab, bleibt sie erhalten und eine Wiederherstellung an den
  Zielnamen wird höchstens per `RENAME_NOREPLACE` versucht; der Parent endet
  in jedem Fall als Konflikt, nicht als `rolled-back`.
- **Update:** Ein noch nicht publiziertes Child muss das ursprüngliche Ziel
  erneut gegen Before verifizieren. Ein eigenes publiziertes After-Ziel wird
  wie bei Create identitätsgebunden in einen retained Rollback-Capture bewegt.
  Danach wird eine neue Restore-Temp ausschließlich aus dem retained
  Before-Snapshot geschrieben, synchronisiert und per `RENAME_NOREPLACE` am
  freien Ziel publiziert. Zielhash, Verzeichnissync und Before-Digest müssen
  bestehen, bevor `rolled-back` zulässig ist.
- **Delete:** Ist der Zielname nach gültiger Capture abwesend, wird ebenfalls
  eine neue Restore-Temp aus dem retained Before-Snapshot synchronisiert und
  nur per `RENAME_NOREPLACE` publiziert. Jede fremde Belegung oder abweichende
  Capture wird `conflict`; sie wird weder entfernt noch überschrieben.

Nach jedem Rollback-Namensschritt wird Identität und Hash erneut geprüft. Ein
Writer zwischen Prüfung und Capture/Restore kann damit den Erfolg verhindern,
aber keine seiner beobachteten Bytes verlieren und niemals einen falschen
`rolled-back`-Status erzeugen.

Zweifacher Recovery-Aufruf ist idempotent und erzeugt denselben terminalen
Zustand. Physische Reclamation der retained Transaktionsnamen liegt außerhalb
H03 und darf nicht als bestanden behauptet werden.

## Vollständige Fault- und Adversary-Matrix

Create, Update und Delete sind getrennte Pflichtzeilen. Die folgenden
Killpunkte werden je genannter Operation mit neuem Root und frischem
Recoveryprozess ausgeführt. Ein Schritt, den die Operation nicht besitzt,
steht als `not-applicable` mit Begründung im Matrixreceipt und ist keine
Pflichtzelle. `not-run` bleibt für jede anwendbare Pflichtzelle ein No-Go:

- Update/Delete: vor/während/nach Before-Payload-Snapshot und Snapshot-Sync;
- Update/Delete: vor/während/nach Ziel-FD-Verifikation gegen den
  Before-Snapshot;
- Create/Update: vor/nach initialem Temp-Sync;
- alle Operationen: vor Anlage, während und nach Anlage der ersten
  Parent-Receipt-Stagingdatei sowie vor/während/nach durablem Parent- und
  jedem Child-`prepared`;
- Update/Delete: vor/nach Capture und Capture-Verzeichnissync;
- Create/Update: vor/nach After-Publikation und Publish-Verzeichnissync;
- alle Operationen: vor/nach Child-Commit, Parent-`children-committed` und
  Parent-`committed` sowie vor/während/nach logischer Parent-Freigabe;
- Create: vor/während/nach jedem Rollback-Capture;
- Update/Delete: vor/während/nach Restore-Temp-Sync und Restore-Publication.

An jedem anwendbaren Dateisystemschritt werden zusätzlich separat injiziert:

- Zielneubelegung durch einen unkooperativen Prozess;
- Zielersatz vor Capture sowie In-place-Änderung über einen vorab offenen FD,
  insbesondere während jeder Zielverifikation;
- Ziel-Symlink, Parent-Symlink und Hardlink;
- Austausch von Zielidentität, Parent und Rootpfad;
- Mount-/Gerätewechsel, soweit der isolierte Host ihn sicher erlaubt;
- beschädigte, fehlende, doppelte oder fremde Receiptgeneration;
- zweiter Recoverylauf und konkurrierter Recoveryversuch.

Jede anwendbare Matrixzelle nennt `passed`, `failed` oder `not-run`, alle verbliebenen
Dateien und deren Hash/Identität. Eine als Host nicht sicher injizierbare
Pflichtzelle ist `not-run` und damit H03-No-Go, nicht übersprungen.

## Orakel und harte Gates

- Create endet ausschließlich vollständig neu, nach frühem Kill/Rollback im
  verifiziert alten Zustand mit abwesendem Ziel oder als erhaltener Konflikt.
  Nach durablem Child-`prepared` benötigt der alte Zustand ein Parent-/Child-
  `prepared`- und `rolled-back`-Receipt, Zielabwesenheit und ein Inventar des
  gebundenen Tempnamens (fehlend, teilweise oder vollständig) samt
  Hash/Identität, falls vorhanden. Vor der ersten Parent-Publikation gilt:
  Vor Staging-Anlage belegen Controller-Killpunkt, gegen das Fixture geprüfte
  Zielabwesenheit und leeres Transaktionsverzeichnis `no-transaction`; nach
  Staging-Anlage kommt der retained Orphan-Receipt-Stagingbeleg hinzu. Bloße
  Zielabwesenheit ohne zugehörigen Phasenbeleg genügt nicht.
- Update endet ausschließlich vollständig alt, vollständig neu oder als
  erhaltener Konflikt mit verifiziertem Before-Snapshot, beobachteter Capture,
  neuer Temp und gegebenenfalls konkurrierendem Ziel.
- Delete endet ausschließlich vollständig alt, verifiziert abwesend oder als
  erhaltener Konflikt.
- Der Parent endet ausschließlich im vollständigen aggregierten Before- oder
  After-Zustand oder in einem nicht überschreibenden Konflikt. Mischungen aus
  neuer Karte/alter Notiz oder altem Draft/neuem Journal sind Fehler.
- Create-Rollback belegt verifizierte Zielabwesenheit; Update-/Delete-Rollback
  belegt den aus retained Before-Snapshots wiederhergestellten aggregierten
  Before-Digest. Ein bloßes Receipt ohne Namens-/Hash-Orakel genügt nicht.
- Kein Write wird vor durablem Parent-Commit bestätigt; kein Before-Snapshot,
  Capture oder Child-Receipt wird in H03 physisch gelöscht.
- Alle Schritte sind auf demselben lokalen Dateisystem; fehlende Primitive,
  nicht nachweisbarer Verzeichnissync oder unerkannter konkurrierender Writer
  sind sofortiges No-Go.
- Native Quell-/Binärhashes, Compiler, Linker, libc, Kernel, geladene
  Bibliotheken, Buildbefehl, Source-/Lockfile-SHA und komplette Matrix stehen
  im sauberen externen Receipt.
- `npm run check`, `npm test` und `npm run build` bestehen auf dem exakten
  Receipt-Quellcommit; Produktinputs bleiben byteidentisch.
- Windows, macOS, Electron-Recomposition, GUI, Accessibility, Performance,
  physische Transaktions-GC und installierter Adapter sind ausdrücklich
  `not-run`.

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

## Planreview ADR-P01-H03-P01-R01

Der unabhängige schreibgeschützte Review bestand nach drei gezielten
Nachbesserungen auf dem exakten Kandidatenkopf
`a9de899262163f355f627931f527c6f5bd1d16d9` ohne verbleibenden Pflichtbefund.
Er bestätigte insbesondere den vom Ziel-Inode unabhängigen Before-Payload-
Snapshot, getrennte Zielverifikation und Capture, retained Konfliktwahrheiten,
operationsspezifische Create-/Update-/Delete-Rollbacks, Parent-/Child-Retention,
Rollback-Faultpunkte, Linux-only-Grenze, H02-Nichtwiederholung, P02-Sperre und
verpflichtendes Cleanup.

Dies ist ausschließlich eine Planfreigabe. Vertrag, Helper, vollständige
Matrix, sauberes Receipt, Code-/Security-/Evidence-Review und Cleanup bleiben
vor jedem H03-Befund erforderlich.

## Nachprüfung ADR-P01-H03-P01-R02

Die unabhängige Nachprüfung auf `daa053967b4e7fa7228cfd89fd11996bb363d420`
fand drei verbliebene Pflichtlücken: belegter Capture-Zielname bei
`RENAME_NOREPLACE`, Hilfsdateien vor dem ersten durablen Receipt und das
unvollständige Create-Abwesenheitsorakel. Die vorstehende R01-Freigabe ist
damit kein gültiges Umsetzungsgate mehr. Diese R02-Fassung repariert die drei
Stellen als Planentwurf. Der erste unabhängige Review auf
`2f7f8fa7712b99c30c452aec9cc0c25a3cc5738d` bestätigte die drei
Reparaturziele, fand aber zwei neue Matrix-/Frühzustandswidersprüche (Issue #1,
Kommentar 6084779594). Diese Fassung präzisiert die operationsspezifischen
Pflichtzellen und `no-transaction` vor Staging-Anlage. Der erneute unabhängige
schreibgeschützte Review bestand auf dem exakten Shared-Head
`25885d543c8576a3ae1d0556e7b04a51d40209c7` ohne weiteren Pflichtbefund
(Issue #1, Kommentar 6084812709). Dies ist ausschließlich ein Plan-PASS;
ausführbarer H03-Nachweis, Linux-Durability-Go, Plattform-ADR und P02 bleiben
offen.
