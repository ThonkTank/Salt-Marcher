# SMR-00-P01 – Ausführbare Beweise für den Plattformentscheid

Stand: 9. Oktober 2026

Basis: `d09513e103ed6e40a8973d6941961cde37f376a8`

Art: Planlauf; keine Produkt-, Host- oder Fachabnahme

## Zweck und Entscheidungsgrenze

Dieser Plan zerlegt die vier in
[`ROADMAP-SALTMARCHER-PLATFORM-ADR.md`](ROADMAP-SALTMARCHER-PLATFORM-ADR.md)
geforderten Prototypen `ADR-P01` bis `ADR-P04` in kleine, ausführbare
Beweispakete. Sie entscheiden, ob ein hostneutraler Kern mit eigenständiger
Desktop-Zielshell die vorhandene Kartenarbeit und die bindenden
SaltMarcher-Verträge tragen kann. Sie implementieren noch kein zweites Produkt
und ratifizieren die ADR nicht allein.

Die bestätigte Inventur ist der Ausgangspunkt: Auf Revision `b7e06f0`
importierten 68 von 78 ausgewerteten TypeScript-Dateien Obsidian nicht direkt;
zehn direkte Hostdateien umfassten rund 9.100 Zeilen. Der Prototyp muss diese
Wiederverwendung praktisch belegen. Er darf die zehn Hostdateien weder kopieren
noch in einer neuen Shell nachbauen und keine pauschale Portierbarkeit aus der
Importzählung ableiten.

Vor Ratifikation gilt:

- Prototypcode liegt ausschließlich unter `tools/adr-prototypes/`, zugehörige
  automatisierte Prüfungen unter `tests/adr-prototypes/`. `.build` enthält nur
  lokalen Scratch; dauerhafte Rohbelege liegen im ausdrücklich gesetzten
  externen Evidence-Root, kleine gehashte Aggregatbelege im Toolpfad. Nichts
  davon ist aus `src/main.ts`, dem Obsidian-Bundle oder dem installierten Vault
  erreichbar.
- Bestehende Produktmodule dürfen als unveränderte Eingabe importiert werden.
  Eine erforderliche Änderung an `src/`, `styles.css`, `build.mjs` oder einer
  vorhandenen Roadmap beendet das jeweilige Paket mit `No-Go: boundary` und
  benötigt erst einen eigenen, reviewten Nachbesserungsplan.
- Abhängigkeiten und reproduzierbare Befehle dürfen in einem späteren
  Umsetzungslauf ausschließlich über `package.json` und `package-lock.json`
  ergänzt werden. Kein Paket besitzt gleichzeitig Produkt- oder Hostdateien.
- Es gibt keine Dual Writes. Jeder Lauf benennt genau eine Testdatenwahrheit.
  Bestehende Vault-, Karten- und Nutzerdateien werden nur gehasht oder aus
  einer ausdrücklich erzeugten Kopie gelesen.
- SaltMarcher-Anforderungen, aktuelle Zielrepo-Abnahmen und vorhandene
  Original-/Hostbelege bleiben offen, sofern dieses Dokument sie nicht als
  enges Prototyptor bezeichnet. Testzahlen oder ein erfolgreicher Smoke-Test
  sind keine Fachfreigabe.

## Verhältnis zum Dreioptionenentscheid

P01 bis P04 qualifizieren ausschließlich die bevorzugte Hypothese
„hostneutraler Kern plus Desktop-Zielshell mit befristetem Obsidian-Adapter“.
Sie dürfen weder Obsidian-only noch eine direkte Standalone-Neuübernahme allein
durch ihren Erfolg verwerfen. Der spätere ADR-Ratifikationslauf benötigt
zusätzlich eine gehashte Vergleichsmatrix mit drei belegten Spalten:

- **Obsidian-only:** aktueller Host-Kontrolllauf mit denselben Karten- und
  Datenorakeln sowie expliziten Belegen, welche Prozess-, Fenster-, Recovery-,
  Distributions- und Erweiterungsgrenzen der fremde Host kontrolliert oder
  nicht kontrollieren lässt;
- **direkte Standalone-Neuübernahme:** ein auf den exakten SaltMarcher-SHA
  gebundener Donor-Inventar-/Kompatibilitätslauf, der für dieselben Fixtures
  wiederverwendete, zu kopierende und neu zu implementierende Grenzen sowie
  nicht lesbare V4-/Vaultdaten ausweist; ein fehlender Importpfad ist ein
  Risikobeleg, kein Auftrag zum Big-Bang-Rewrite;
- **schrittweise Entkopplung:** die Receipts P01 bis P04 dieses Plans und der
  identische Obsidian-Kontrolllauf auf den verwendeten Kartenfixtures.

Die Matrix bewertet mindestens UX-/Kartenwiederverwendung, Datenbesitz,
Crashsicherheit, Prozess-/Fenstersicherheit, Distribution/Update/Rollback,
Extensions, Audio/Hintergrundarbeit, Plattformportabilität und Migrations-
beziehungsweise Rückfallpfad. Eine leere Zelle ist ein offener Blocker, kein
neutraler Wert. P01 bis P04 können daher ein `Go zur bevorzugten Richtung`,
aber niemals allein die endgültige ADR-Ratifikation liefern.

## Gemeinsamer Ausführungsvertrag

### Lauflebenszyklus

Jeder Prototyp ist ein eigener, sequentieller Kandidatenbranch mit der Folge
`Planreview -> Umsetzung -> unabhängiger Review -> gegebenenfalls
Nachbesserung -> erneuter Review -> Prototyp-Aufräumen`. Ein Prototyp beginnt
erst auf einer sauberen, mit dem aktuellen gemeinsamen Branch integrierten
Basis. Änderungen anderer Geräte oder Stränge werden vor jedem Lauf erneut
abgerufen; veröffentlichter Verlauf wird nicht umgeschrieben. Jeder geprüfte
Zwischenstand wird ohne Force-Push auf seinem Kandidatenbranch veröffentlicht.
Nur der Koordinator integriert nach bestandenem Review die kleine Roadmap-,
Contracts- und Evidence-Änderung in den gemeinsamen Branch. Ein No-Go
verbleibt mit seinen Belegen auf dem Kandidatenbranch; ein eigener
Aufräumcommit entfernt den
paketlokalen ausführbaren Prototypcode und seine temporären Abhängigkeiten,
bevor etwas zur Integration vorgeschlagen wird. Die reviewten, versionierten
Port-, DTO- und Schema-Verträge unter `tools/adr-prototypes/contracts/**` sowie
der Aggregatbeleg bleiben erhalten. Ein Folgepaket setzt keinen gelöschten
Harness voraus; es bindet die erhaltenen Verträge und den reviewten
Aggregatbeleg als Eingangsoracle.

P01 bis P04 bleiben wegen ihrer fachlichen Eingangsorakel in dieser Reihenfolge
sequenziell; kein Folgepaket beginnt vor dem Aufräumreview des Vorgängers. Jedes
Paket hat genau einen Besitzer und ausschließlich die unten genannten Dateien.
Diese Paketexklusivität sperrt keine andere, nicht überlappende Produktarbeit:
statische und nichtgrafische Läufe dürfen in getrennten Worktrees parallel
arbeiten. Pro physischem Gerät läuft jedoch gleichzeitig höchstens eine
grafische Host-, Original- oder Prototypinstanz und nur ein GUI-, Fault- oder
Lastlauf. Getrennte Geräte dürfen für denselben freigegebenen Paketkandidaten
ihre plattformspezifischen Receipts parallel erzeugen; kein Lauf teilt dabei
einen Evidence-Root oder schreibt dieselben Dateien. Kontrollierte Samples
eines funktionierenden Kandidaten dürfen die unten geforderte Anzahl haben;
nach höchstens zwei erfolglosen Versuchen oder 45 Minuten an derselben
Hypothese wird anhand der vorhandenen Belege Go, No-Go oder eine neue
Hypothese entschieden.

### Versionierte Verträge und abschließende Composition

Jedes Paket ergänzt nur additive, explizit versionierte JSON-Schemas und
TypeScript-Port-/DTO-Typen unter `tools/adr-prototypes/contracts/**`. Eine
Schemaänderung nach einem bestandenen Paket erzeugt eine neue Version und
erzwingt die Wiederholung aller davon abhängigen Contract-Tests; stilles
Überschreiben ist verboten. Die ausführbaren Adapter bleiben paketlokal und
dürfen beim Aufräumen entfernt werden, die Verträge und Golden DTO Fixtures
nicht.

Nach P04 und vor jedem `Go zur bevorzugten Richtung` folgt ein eigener
`ADR-C01`-Composition-Lauf. Er baut aus den erhaltenen Verträgen einen kleinen
neuen Harness mit genau einer Main-/Utility-, einer typisierten Preload-, einer
Renderer- und einer Speichergrenze. Ohne Stub- oder Direktzugriff führt er in
einem Profil nacheinander P01-Karte öffnen/ändern/speichern, P02-Campaign-Write,
P03-sichere Projektion und P04-Export/Import aus. Correlation-ID, Revision,
Schema-Version und semantischer Digest werden an jeder Grenze durchgängig
geprüft. Der Lauf besitzt eigenen Plan, Review, Faultmatrix, Aggregatbeleg und
Aufräumcommit; eine zweite Utility-/Speicherautorität oder paketlokale
Sonderbrücke ist `No-Go`. Sein exklusiver Besitz ist
`tools/adr-prototypes/composition/**`,
`tools/adr-prototypes/evidence/c01-aggregate.json`,
`tests/adr-prototypes/c01-*.test.*` und nur vorübergehend die exakt gepinnten
Dev-Abhängigkeiten in `package.json`/`package-lock.json`.

### Reproduzierbarkeit und Receipt

Jeder ausführbare Befehl erzeugt eine einmalige, nicht überschreibbare
Receipt-ID aus Paket, Source-Commit, Plattform und UTC-Zeit. Lokaler Scratch
liegt unter `.build/adr-prototypes/<paket>/<receipt-id>/`; das kanonische
`receipt.json` und umfangreiche Rohbelege liegen unter einem expliziten,
plattformnativen absoluten
`SMR_ADR_EVIDENCE_ROOT/<paket>/<receipt-id>/`. Fehlt dieser Root oder existiert
die Receipt-ID bereits, startet der Lauf nicht. Ein kleiner gehashter
Aggregatbeleg unter
`tools/adr-prototypes/evidence/<paket>-aggregate.json` bindet nach Review alle
Pflichtreceipts und OS-Artefakthashes; `.build` ist keine dauerhafte Evidenz.
Auf dem Repository-Linux-Host muss `SMR_ADR_EVIDENCE_ROOT` unter
`/home/aaron/.cache/dungeon-native-qa/smr-adr-prototypes/` liegen; Windows und
macOS verwenden einen im Receipt genannten gleichwertigen nativen QA-Cache
außerhalb produktiver Nutzerdaten, Campaign und Vault.
Ein Receipt ist nur gültig, wenn es mindestens enthält:

- Paket-ID, Git-Commit und Dirty-Zustand;
- Node-, Paketmanager-, Desktop-Runtime-, Betriebssystem- und
  Architekturversion;
- kalibriertes Hardwareprofil, freier Speicher, Netzwerkzustand und
  Fenster-/Skalierungsprofil;
- SHA-256 jedes Fixtures, Ausgangs, Backups, Exports und erwarteten Orakels;
- vollständigen Befehl, Warmup-, Sample-, p95- und Timeoutdefinition;
- jeden Fault-Injection-Punkt, beobachteten terminalen Zustand sowie alle
  verbliebenen Dateien, Prozesse, Handles und temporären Artefakte;
- Einzelmessungen statt nur Mittelwerten sowie ein eindeutiges
  `passed`, `failed` oder `not-run` pro Tor.

Ein Dirty-Lauf darf diagnostisch sein, aber kein Go-Tor erfüllen. Fehlende oder
fremde Receipts, ein nicht reproduzierter Fixture-Hash und ein übersprungenes
Pflichttor sind `No-Go`, nicht `passed with warning`.

Der in allen Paketen verwendete semantische Digest ist SHA-256 über
kanonisches UTF-8-JSON: Objektschlüssel werden codepunktweise sortiert, die
fachliche Reihenfolge von Arrays bleibt erhalten, Zahlen verwenden ihre
validierte JSON-Darstellung und Laufzeit-, Pfad-, Zeit- oder Locale-Metadaten
werden nur einbezogen, wenn sie zum jeweiligen Vertrag gehören. Das Receipt
nennt Schema und Digestalgorithmus; ein Paket darf keinen eigenen stillen
Vergleich definieren.

### Gemeinsame Daten- und Rollbackregeln

- Jeder Lauf erhält mit `mktemp` beziehungsweise dem plattformgleichen sicheren
  Tempmechanismus einen neuen Profil-, Daten- und Exportroot. `$HOME`, ein
  Nutzervault, ein installierter Pluginordner und produktive Karten sind als
  Schreibziel verboten.
- Eingangsfixtures sind read-only. Vor jedem mutierenden Schritt werden
  Dateiliste, Größen, SHA-256 und semantischer Digest gespeichert. Änderungen
  erfolgen ausschließlich in einer neuen Arbeitskopie.
- Fault Injection darf nur den gestarteten Prototypprozess oder dessen
  Testprofil beenden. Kein fremder Prozess wird geschlossen. Nach Abbruch
  bleiben Rohbytes erhalten, bis die alte oder neue vollständige Wahrheit und
  die Rollbackfähigkeit bestimmt sind.
- Ein Backup zählt erst nach Wiederherstellung in einen dritten, leeren Root
  und Vergleich des semantischen Digests. Ein Export zählt erst, wenn die
  Quelle für den Importlauf nicht mehr erreichbar ist.
- `No-Go` lässt den gemeinsamen Branch, das Obsidian-Plugin und alle
  Nutzerdateien unverändert. Der Kandidatenbranch und seine Belege bleiben
  nachvollziehbar; Prototypdaten werden erst nach Review gelöscht, Receipts
  und minimale Fehlerbelege bleiben erhalten.

### Messregeln

Zeitbudgets verwenden monotone Uhren. p95 ist der nach oben gerundete Rang
`ceil(0,95 * n)` der aufsteigend sortierten Einzelwerte. Interaktive
Populationen besitzen fünf ungewertete Warmups und mindestens 30 gemessene
Wiederholungen je Plattformzustand. Kaltstart, Crash-Resume und große
Dateioperationen besitzen mindestens zehn voneinander unabhängige gemessene
Profile. Ein Timeout ist immer ein Fehler; verworfene Ausreißer sind verboten.

Sicherheits-, Datenintegritäts-, Berechtigungs- und Exactly-once-Invarianten
sind unabhängig von der Fixturegröße harte Entscheidungstore. Die folgenden
Zeitwerte sind dagegen bis zu einer fachlich normativen Population nur
provisorische Mess- und Vergleichsbudgets:

| Bereich                                      | Provisorisches Mess-/Vergleichsbudget                            | Harte Invariante                              |
| -------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| direkte Eingabe                              | Anerkennung p95 <= 100 ms                                        | keine Mutation vor bestätigtem Befehl         |
| häufige Liveaktion / erste nützliche Anzeige | p95 <= 1 s, Lauf-Timeout 10 s                                    | Timeout wird sichtbar und verändert nichts    |
| bestätigter sicherer Write                   | Anerkennung p95 <= 1 s, Lauf-Timeout 10 s                        | Verlust bestätigter Arbeit = 0                |
| Crash-Resume der Prototypfixture             | p95 <= 5 s                                                       | alte oder neue vollständige Wahrheit          |
| passive Projektion                           | Feedback p95 <= 100 ms; vollständige Projektion p95 <= 1 s       | private Leaks = 0                             |
| Abbruch vor Commit                           | Bestätigung p95 <= 1 s; Bereinigung <= 10 s                      | keine neue fachliche Wirkung                  |
| Kartennavigation                             | Render-/Navigationsbild p95 <= 33 ms; Werkzeugvorschau <= 100 ms | Rendererprivilegien = 0                       |
| Ressourcen                                   | RSS, CPU, Handles und temporäre Bytes vollständig messen         | keine unbeschränkte Verstärkung oder Leckspur |

Eine Budgetüberschreitung ist ein protokollierter Performancebefund und
verhindert eine Performanceaussage, aber allein kein Plattform-No-Go. Ein
Performancewert wird erst zum harten Go/No-Go, wenn ein eigener
Kalibrierungsreceipt die normative Population, das Hardwareprofil, mindestens
einen Referenzlauf, Warmups/Samples und die Herleitung der Schwelle bindet.
P01 bis P04 erfüllen mit ihren synthetischen Populationen weder `TN-16` noch
`TN-19`, `TN-20` oder `TN-21`.

Für neue Tests gelten keine feste Speicherobergrenze und keine hohe
Startreserve. Ein Lauf stoppt nur bei der im Repository freigegebenen
Notbremse: weniger als 256 MiB systemweit verfügbar oder mehr als 50 %
Vollspeicherblockade über zwei Sekunden. Ein solcher Schutzstopp ist `not-run`
für noch nicht ausgeführte Tore und niemals Performanceabnahme.

Die vorhandenen einzelnen Obsidian-Messungen von 522 ms Öffnen, 246 ms
Geschosswechsel und 0 zusätzlichen Leerlaufbildern sind Vergleichswerte, keine
neue Baseline. Der Prototyp darf nur aus seiner definierten Population ein
Urteil ableiten.

### Paketgates und Bundle-Isolation

Jeder P01-P04- und C01-Umsetzungs-, Nachbesserungs- und Aufräumkandidat muss
`npm run check`, `npm test` und `npm run build` bestehen. Prototypabhängigkeiten
sind exakt gepinnte Dev-Abhängigkeiten. Vor und nach dem Lauf werden
Obsidian-`main.js`, `manifest.json` und `styles.css` gehasht; der Prototyp darf
keinen Importpfad in das Produktbundle und keine zusätzliche installierte Datei
erzeugen. Der Build-Importgraph belegt diese Isolation. Änderungen des
Produktbundlehashs ohne eine zuvor reviewte Produktänderung sind `No-Go`.

## Plattform- und Darstellungs-Matrix

Die bevorzugte Richtung darf erst weiterempfohlen werden, wenn derselbe
Source-Commit und dasselbe Lockfile auf den drei unterstützten
Betriebssystemfamilien geprüft sind. Native Artefakte dürfen OS-spezifische
Bytes besitzen; jedes erhält einen eigenen Hash und ein gemeinsames
Quell-/Toolchainmanifest:

| Tor                                                              | Linux           | Windows         | macOS           |
| ---------------------------------------------------------------- | --------------- | --------------- | --------------- |
| reproduzierbarer Build und nichtgrafische Contract-Tests P01-P04 | Pflicht         | Pflicht         | Pflicht         |
| P01 Desktop-Start, große Karte, Save/Restart und Sandbox         | Pflicht         | Pflicht         | Pflicht         |
| P02 Commit-, Kill- und Recovery-Matrix                           | Pflicht         | Pflicht         | Pflicht         |
| P03 zweites Fenster, Fokuswechsel und Negativkanäle              | Pflicht         | Pflicht         | Pflicht         |
| P04 Export/Import                                                | Quelle und Ziel | Quelle und Ziel | Quelle und Ziel |
| C01 integrierte Vertragskomposition                              | Pflicht         | Pflicht         | Pflicht         |

P04 prüft alle neun gerichteten Kombinationen aus Linux, Windows und macOS,
einschließlich gleicher Quell-/Zielplattform. Ein Receipt benennt jeweils
Quelle, Ziel, kanonischen Manifest-/Entry-Digest, Archivhash und
Toolchainprofil. Ein lokaler Dateitransfer darf keinen nicht deklarierten
Metadatenkanal ersetzen.

P01 und P03 laufen je Plattform mindestens bei 1366 x 768, 1920 x 1080 und
200 % Skalierung. Die ersten kompakten Abläufe werden zusätzlich bei 900 x 650
und 1150 x 700 geprüft. Tastaturbedienung, sichtbarer Fokus, kein Color-only-
Status, automatisierte Accessibility-Prüfung und ein dokumentierter
Screenreader-Smoke bleiben getrennte Pflichtzeilen. Fehlende reale
Plattform-/Screenreader-Hardware bleibt offen und verhindert Ratifikation; sie
wird nicht durch Emulation geschlossen.

## ADR-P01 – Kartenkern in einer isolierten Desktop-Shell

### Beweisfrage und Nichtziele

P01 beweist, dass die vorhandenen hostneutralen Module für V4-Modell, Session,
Kommandos, Persistenz und Pixi-Renderer in einer restriktiven Desktop-Shell
laufen, ohne Obsidian-Code zu kopieren und ohne Node-, Dateisystem- oder
Datenbankzugriff im Renderer. Ein React-Neubau, die Migration von
`src/editor.ts`, ein neues Kartenformat und eine Installation sind ausdrücklich
keine P01-Ziele.

### Besitzdateien des späteren Umsetzungslaufs

- `tools/adr-prototypes/p01/**`
- `tools/adr-prototypes/contracts/p01-v1/**`
- `tools/adr-prototypes/evidence/p01-aggregate.json`
- `tests/adr-prototypes/p01-*.test.*`
- `package.json` und `package-lock.json` nur für exakt gepinnte
  Prototypabhängigkeiten und P01-Befehle

P01 liest unverändert `src/model.ts`, `src/session.ts`, `src/commands.ts`,
`src/persistence.ts`, `src/renderer.ts`, `src/rendering.ts`,
`src/render-drawing.ts`, `src/selection.ts` und deren aktuelle Abhängigkeiten.
Diese Dateien sind nicht in P01-Besitz. Ein notwendiger Edit an ihnen ist das
oben definierte Boundary-No-Go.

### Ports und Prozessgrenzen

P01 legt `FileStore` und den unveränderten `MapRepository` vollständig in die
privilegierte Utility-Grenze. Nur dort existieren Kartenpfad, `.journal`,
`.draft`, die durch `MapRepository.assertAllowed` zugelassenen Markdown-
Notizpfade und Rohbytes. Main bindet beim Öffnen einen undurchsichtigen, nicht
erratbaren `MapHandle` an genau einen kanonisch aufgelösten Testroot, eine
Map-ID, die erwartete Revision und zulässige Asset-IDs. Der validierte Preload
bietet dem Renderer ausschließlich fachliche DTO-Operationen:

- `openMap({ mapId, expectedRevision })` liefert Handle, validierten Snapshot,
  Revision und Digest;
- `executeMapCommand({ mapHandle, expectedRevision, command })` liefert ein
  typisiertes Ergebnis, nie Pfade oder Bytes;
- `saveMap({ mapHandle, expectedRevision })` führt Draft-, Journal-, Karten-
  und Notizspeicherung innerhalb der Utility-Grenze aus;
- `readAsset({ mapHandle, assetId, expectedHash })` und
  `subscribeMapInvalidation({ mapHandle, revision })`.

Handle, Schema-Version, Größe, Hash, Revision und Ergebnis werden beidseitig
validiert und als unveränderliche DTOs übertragen. Der Renderer erhält weder
Pfade noch `fs`, `process`, `require`, SQLite oder eine allgemeine
IPC-Sendeoberfläche. Jeder Map-, Journal-, Draft-, Notiz- und Assetpfad wird
rootgebunden ohne Linkfolge geöffnet; Symlink/Hardlink, Identitäts-, Root- und
Mountwechsel werden sowohl beim Binden als auch unmittelbar vor jedem
Dateisystemschritt abgewiesen. Recovery-, Denied-path- und TOCTOU-Faults laufen
für jede dieser Pfadklassen, nicht nur für die `.dungeon`-Datei.

Der plattformspezifische `FileStore.compareAndWrite` verwendet ein dauerhaftes
Transaktionsreceipt sowie gleichverzeichnisige, exklusiv erzeugte Temp- und
Backupnamen. Linux bindet den Root per Verzeichnis-FD und `openat2` mit
`RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS`, schreibt mit `O_CREAT|O_EXCL`, synchronisiert
Dateien per `fdatasync`/`fsync`, veröffentlicht per `renameat2` mit
`RENAME_NOREPLACE` und synchronisiert das Verzeichnis per `fsync`. macOS
verwendet `openat`/`O_NOFOLLOW`, `F_FULLFSYNC`, `renameatx_np(RENAME_EXCL)` und
nachgewiesenen Verzeichnissync. Windows verwendet root-relative Handles mit
`CreateFileW(FILE_FLAG_OPEN_REPARSE_POINT)`, verweigert Write/Delete-Sharing,
erzeugt mit `CREATE_NEW`, synchronisiert per `FlushFileBuffers` und
veröffentlicht über `SetFileInformationByHandle`/`FileRenameInfoEx` mit
Write-through-Semantik. Das Receipt bindet Before-/After-Hash, Dateidentität und
jeden Zustand `prepared`, `old-captured`, `new-published`, `committed`.

Der Ablauf ist je Pfad fest: Receipt `prepared` durable schreiben; den aktuellen
Zielnamen ohne Überschreiben auf den exklusiven Backupnamen bewegen und den
Verzeichniszustand synchronisieren; Backupbytes/-identität gegen `before`
prüfen; die bereits synchronisierte Tempdatei nur bei weiterhin freiem Zielnamen
ohne Replace veröffentlichen; Verzeichnis synchronisieren; Receipt
`new-published` und danach `committed` durable setzen. Erst dann dürfen Backup
und Receipt eines alleinstehenden Writes entfernt werden. Gehört der Write zu
einem `MapRepository`-Receipt, bleiben Child-Backup und Child-Receipt trotz
lokalem `committed` gesperrt erhalten. Sie werden ausschließlich durch eine
Parent-Freigabe nach durablem repositoryweitem `committed` oder nach vollständig
verifiziertem repositoryweitem Rollback gelöscht. Recovery entscheidet
ausschließlich aus Receipt, Namen, Identitäten und Before-/After-Hashes: vor
Capture bleibt `old`, nach Capture wird entweder das alte Backup
wiederhergestellt oder ein vollständig hashgleiches neues Ziel als `new`
abgeschlossen. Ein dritter Hash, ein neu belegter Zielname oder eine nicht
zuzuordnende Phase bleibt als Konflikt erhalten und wird nie überschrieben. Das
`MapRepository`-Journal koordiniert darauf aufbauend die alte/neue Wahrheit
über Map und Notizen.

Das unveränderte `MapRepository`-Journal bildet zusammen mit einem
P01-Repository-Receipt das repositoryweite Commit-Orakel. Wenn der
`FileStore`-Adapter den vorhandenen Journalwrite `prepared` empfängt, validiert
er dessen vollständigen, stabil geordneten Write-Satz aus Karte und allen
zulässigen Notizen. Bevor er den Write bestätigt, schreibt er ein dauerhaftes
Begleitreceipt, das die unveränderten Journalbytes, den Draftzustand, alle
Child-Receipts und jeden Before-/After-Hash sowie je einen aggregierten
Before-/After-Digest bindet. Das ändert weder `MapRepository` noch dessen
Journalformat. Erst nachdem alle Karten- und Notizwrites samt Verzeichnissen
synchronisiert sind, darf das vorhandene Journal durable `committed` werden;
erst danach darf `saveMap` Erfolg bestätigen und den dazugehörigen Draft
zurückziehen. Recovery rollt `prepared` vollständig auf den aggregierten
Before-Zustand einschließlich seines Drafts zurück und prüft dessen Digest.
Bei `committed` stellt sie den vollständigen After-Zustand her, prüft dessen
Digest und zieht erst dann den dazu passenden Draft zurück. Ein unbekannter
oder gemischter dritter Hash ist ein fail-closed Konflikt und darf weder
Rendererbestätigung noch Teilpublikation erzeugen. Faults nach jedem Karten-,
Notiz-, Draft-, Journal- und Receipt-Schritt belegen, dass niemals eine neue
Karte mit alter Notiz oder altem Draft und niemals eine alte Karte mit neuer
Notiz sichtbar bleibt. Zusätzliche Faults zwischen jedem Child-`committed` und
der Parent-Freigabe belegen, dass alle erforderlichen Backups bis zur
repositoryweiten Entscheidung erhalten bleiben.

Ein Adapter gilt nur auf einem lokalen Dateisystem, für das die jeweilige
Primitive und Verzeichnissync-Grenze im Receipt nachgewiesen sind. Fehlt eine
Primitive oder kann ein konkurrierender nicht kooperierender Writer zwischen
Validierung und Veröffentlichung unbemerkt gewinnen, ist die Plattform
`No-Go`; ein generisches `rename()`-Versprechen genügt nicht. Faults vor und
nach Capture, Datei-Sync, Publication, Verzeichnis-Sync und Receipt-Commit
müssen nach Recovery exakt alte oder neue vollständige Bytes und ein
`old`-/`new`-Receipt, nie Teilstand oder stilles Überschreiben ergeben.

### Fixtures und Ablauf

1. `tools/large-fixture.cjs::prepareLargeV4` erzeugt die deterministische
   aktuelle P01-Inventurfixture; sie ist keine normative Produktpopulation.
   Ihr Manifest muss vor Timing exakt 4 Flächen, 193 Räume, 64 Portale,
   4.001 Objekte und 33 Lichter, zusammen 4.295 Entitäten, ausweisen. Die
   ältere Bezeichnung „4.293-Entitäten-Szene“ ist nur historischer
   Vergleichstext; eine ungeklärte Zähldifferenz stoppt den Lauf.
2. Eine kleine V4-Karte aus den bestehenden Core-Fixtures prüft dieselbe Folge
   schneller und fault-injizierbar: laden, Auswahl, einen bestehenden
   Gegenstand verschieben, genau ein Undo und Redo, save, Prozess beenden,
   frischen Prozess starten und erneut lesen.
3. Die große Karte prüft Gesamtansicht, Raumfokus, Geschosswechsel,
   Objektänderung, Undo/Redo, Save, einen frischen Prozess und den exakten
   verlinkten Key-Wortlaut. Ausgangsfixture und Arbeitskopie erhalten getrennte
   Hashes; der Ausgang bleibt bytegleich.
4. Nach jedem Save stimmen serialisiertes Dokument, stabile IDs,
   Entitätenreihenfolge, Geometrie, Key-Abschnitte und semantischer Digest mit
   dem erwarteten Zustand überein. Undo stellt den gesamten vorherigen Digest,
   Redo den gesamten neuen Digest her.

### P01-Abnahme

- Keine gebaute Rendererabhängigkeit erreicht `obsidian`, `node:*`,
  `better-sqlite3`, `electron` oder einen dynamischen allgemeinen IPC-Kanal.
  Nur der Main-Prozess und der enge Preload dürfen die Desktop-Runtime
  importieren.
- Das unveränderte Produktionsmodell verarbeitet beide Fixtures; keine Kopie
  von Model-, Session-, Command- oder Rendererlogik liegt im Prototyp.
- Große Karte, provisorisches Vergleichsbudget: öffnen p95 <= 1 s warm und
  <= 5 s kalt, Geschosswechsel p95
  <= 1 s, Pan-/Zoom-/Drag-Anerkennung p95 <= 100 ms, tatsächliches
  Navigationsbild p95 <= 33 ms und 0 zusätzliche Renderbilder in einem
  gemessenen Intervall von 1 s ohne Invalidation.
- Save-Anerkennung p95 <= 1 s; harter Neustart liest genau den bestätigten
  Digest. Konflikt, verweigerter Write und verlorener Utility-Prozess zeigen
  einen Fehler, ohne den Ausgang zu überschreiben.
- Die Plattform- und Darstellungs-Matrix ist vollständig; Tastatur und
  pointerbasierte Kernfolge erzeugen denselben Dokumentdigest.

### P01 Go/No-Go

`Go` erlaubt P02 nur, wenn alle harten P01-Invarianten in unabhängigem Review
reproduziert und alle provisorischen Budgets gemessen sind. `No-Go` gilt bei
notwendigem Kernrewrite, Rendererprivilegien, Format-/ID-Änderung, nicht
erklärter Fixtureabweichung, Datenverlust oder fehlender OS-Durable-Garantie.
Eine nicht kalibrierte Budgetüberschreitung bleibt Performancebefund und
blockiert nur die Performanceaussage. Ein No-Go verwirft keine bestehende
Kartenarbeit; es hält die Plattformempfehlung offen und fordert eine neue
Architekturhypothese.

## ADR-P02 – Atomarer Campaign-Write und Crash-Reconciliation

### Beweisfrage und Nichtziele

P02 beweist eine kontrollierte lokale Mutationsautorität für einen
repräsentativen gekoppelten Campaign-Befehl. Der Testbefehl ändert einen
Campaign-Datensatz und schreibt die dazugehörige erklärende History in genau
einer Transaktion. Er ist synthetisch und wird nicht als vollständiges
Campaign-, Scene- oder Ledger-Modell ausgegeben.

### Besitzdateien des späteren Umsetzungslaufs

- `tools/adr-prototypes/p02/**`
- `tools/adr-prototypes/contracts/p02-v1/**`
- `tools/adr-prototypes/evidence/p02-aggregate.json`
- `tests/adr-prototypes/p02-*.test.*`
- `package.json` und `package-lock.json` nur für die exakt gepinnte lokale
  SQLite-Prototypabhängigkeit und P02-Befehle

P02 ändert keine Karten-, Vault- oder Obsidian-Datei. Seine Datenbank liegt in
einem neuen Testprofil und ist nie Quelle für P01-Karten.

### Ports, Receipt und Faultpunkte

Der Prototyp definiert ausschließlich in seinem Toolpfad:

- `CampaignTransactionPort.execute(request)` mit `commandId`, `commandDigest`,
  `expectedRevision` und `command`;
- `CampaignReceiptPort.reconcile(request)` mit demselben Identitätstripel;
- `CampaignBackupPort.create/verify/restore`;
- die Ergebnisse `not_applied`, `applied`, `already_applied`, `rejected`,
  `revision_conflict` und `outcome_unknown` mit unveränderlichen, validierten
  DTOs.

Die Datenbankoperation läuft außerhalb des Renderers. `commandId` ist stabil,
`commandDigest` ist SHA-256 über das kanonische Command-DTO, und der erwartete
Campaign-Stand wird optimistisch geprüft. Mutation, History, neue
Campaignrevision und dauerhaftes Ergebnis-/Idempotenz-Record mit
`commandId+commandDigest+expectedRevision` werden in derselben Transaktion
committed oder gemeinsam zurückgerollt. Eine vorhandene `commandId` mit anderem
Digest oder anderer Ausgangsrevision wird immer `rejected` und nie ausgeführt.

Das formale Reconciliation-Protokoll liest Receipt und aktuelle Revision in
einem konsistenten Snapshot. Passendes Receipt liefert `applied`; erneutes
`execute` desselben Tripels liefert `already_applied`. Fehlt das Receipt, ist
wegen des gemeinsamen Commits bewiesen, dass dieser Befehl nicht angewendet
wurde: bei unveränderter Revision lautet das Ergebnis `not_applied` und genau
dasselbe Tripel darf bewusst erneut gesendet werden; bei abweichender Revision
lautet es `revision_conflict` und es gibt keinen automatischen Retry.
`outcome_unknown` bedeutet ausschließlich, dass der Receipt-Store selbst nicht
verlässlich lesbar ist, und erlaubt niemals einen Retry. Fault Injection beendet
den Utility-Prozess mindestens vor `BEGIN`, nach `BEGIN` vor Mutation, nach
erster Zeile, nach Historyzeile vor `COMMIT`, direkt nach `COMMIT`, vor
Receipt-Antwort und während Backup. Jeder Punkt läuft zehnmal mit einem neuen
Profil.

### Fixtures und Ablauf

- `campaign-minimal-v1`: eine Campaign, zwei gleichnamige Objekte, ein
  unveränderter Sentinel und leere History.
- Der Befehl ändert genau eines der gleichnamigen Objekte und fügt genau einen
  verknüpften History-Fakt hinzu. Alte oder neue Wahrheit muss vollständig
  sichtbar sein; Mischzustände sind verboten.
- Nach jedem Fault werden Datenbankintegrität, Campaignrevision, beide Objekte,
  History, Receipt und Dateireste vor einem Reconciliation-Versuch gelesen.
  Vor-`BEGIN`- und Rollback-Fälle müssen `not_applied` liefern; nach
  `COMMIT`/vor Antwort muss `applied` und erneutes Execute `already_applied`
  liefern. Die Mutation ist damit sicher null- oder genau einmal sichtbar.
- Ein verifizierter Online-Backupstand wird in einen dritten Root restauriert.
  Erst der semantisch identische Restore darf das Backup als erfolgreich
  markieren. Die beschädigte oder unterbrochene Quelle bleibt unverändert
  erhalten.

### P02-Abnahme

- Nach jedem Fault existiert exakt die vollständige alte oder vollständige
  neue Wahrheit. Teilfolgen, doppelte History und Mutation des namensgleichen
  Sentinelobjekts sind jeweils `0`.
- Jede als gespeichert bestätigte Mutation ist nach hartem Prozessende
  vorhanden; Verlust bestätigter Arbeit ist `0`. Vor Dauerhaftigkeit zeigt der
  Renderer ausschließlich pending/unsafe.
- Provisorisches Vergleichsbudget: Safe-Write-Anerkennung p95 <= 1 s, Timeout
  10 s; Crash-Resume auf der repräsentativen Fixture p95 <= 5 s und akzeptiert
  danach eine weitere dauerhaft bestätigte Mutation.
- Reconciliation desselben Tripels wendet die Mutation höchstens einmal an.
  Wiederverwendung der `commandId` mit anderem Digest/anderer Ausgangsrevision,
  Retry nach `revision_conflict` oder Retry bei `outcome_unknown` erreicht
  keinen Mutationshandler. Ein Folgekommando nach abgewiesenem oder
  fehlgeschlagenem Kommando bleibt möglich.
- Datenbank-, WAL-/Journal-, Backup- und temporäre Dateien sind vollständig im
  Testroot inventarisiert. Backupfehler verändern weder Quelle noch letzten
  verifizierten Backupstand.
- Dieselbe Faultmatrix besteht auf Linux, Windows und macOS mit identischem
  semantischem Digest.

### P02 Go/No-Go

`Go` erlaubt P03 nur bei vollständiger Faultmatrix und unabhängig geprüftem
Restore. Jeder bestätigte Verlust, Mischzustand, Blind-Retry, stiller Fallback
auf Dateidaten oder plattformspezifisch abweichende Semantik ist `No-Go` für die
vorgeschlagene Mutationsgrenze.

## ADR-P03 – Fail-closed passive Spielerprojektion

### Beweisfrage und Nichtziele

P03 beweist, dass eine zweite Desktop-Fensterrolle ausschließlich eine
party-sichere Projektion der fokussierten Scene lesen kann. Sie erhält keine
allgemeine GM-, Datei-, Datenbank-, Audio- oder Mutationsfähigkeit. P03 baut
weder vollständige Scene- noch Knowledge-/Perception-Fachlogik; sein Oracle
ist eine explizite synthetische Projektion.

### Besitzdateien des späteren Umsetzungslaufs

- `tools/adr-prototypes/p03/**`
- `tools/adr-prototypes/contracts/p03-v1/**`
- `tools/adr-prototypes/evidence/p03-aggregate.json`
- `tests/adr-prototypes/p03-*.test.*`
- `package.json` und `package-lock.json` nur für P03-Befehle und die
  Accessibility-Prüfung

### Ports und Sicherheitsmodell

Der Main-/Utility-Prototyp erzeugt aus privater Wahrheit ein validiertes
`PartySafeSceneProjection` mit `sceneId`, monotoner `generation`, öffentlichem
Kartenausschnitt, freigegebenen Markern, freigegebenem Bild und neutralem
Status. Ein eigener passiver Preload exportiert nur:

- `readProjection()`;
- `subscribeProjectionChanged(listener)`;
- `readCoreStatus()`.

Mutation, beliebige IPC-Aufrufe, Dateipfade, Navigation, DevTools-Steuerung und
die GM-Bridge fehlen. Die Main-Grenze prüft die Fensterrolle vor der
Payloadverarbeitung. Bei Fokuswechsel wird die alte Projektion zuerst durch
einen leeren Zustand der neuen Generation ersetzt; eine verspätete alte
Nachricht darf danach kein Bild veröffentlichen.

Das passive Fenster startet mit Sandbox und Context Isolation, ohne Node-
Integration und ohne Remote-Modul. Eine restriktive lokale CSP sowie Main-
Handler verweigern Navigation, `window.open`, Downloads, Permission Requests,
Clipboard, unbekannte Protokolle und jede Netzwerkverbindung. Es verwendet eine
eigene ephemere Sessionpartition; WebStorage, Cache und Service Worker sind
deaktiviert oder werden beim Schließen nachweislich geleert. DevTools bleiben
im qualifizierten Build geschlossen. Crash-Reports, Logs, Titel, URLs und
Diagnostik dürfen nur begrenzte Codes und keine Projektionspayload enthalten.

### Fixture und Negativoracle

Die Fixture enthält zwei Scenes und pro Scene:

- freigegebene Karte, Art und bekannte Marker;
- private GM-Notiz, verstecktes Monster, unbekannten Raum, Mechanikwerte,
  Dateisystempfad, nicht freigegebenes Asset und je einen eindeutigen
  Canary-String;
- ein ausschließlich privates, hochkontrastiges Raster-Canary mit eindeutigem
  Pixelmuster, das in keinem freigegebenen Asset vorkommt;
- unterschiedliche Generationen und eine kontrolliert verspätete Antwort.

Der Test inventarisiert jede Nachricht am passiven Kanal und den sichtbaren DOM
als kanonische Bytes. Zusätzlich liest er nach jedem stabilisierten Erfolgs-,
Fehler-, Fokus-, Asset- und Stale-Frame-Schritt die tatsächlich dargestellten
Framebufferpixel aus. Ein plattformspezifisch kalibriertes Pixeloracle erlaubt
nur die öffentliche Referenzprojektion und sucht mit deklarierter Toleranz nach
dem privaten Raster-Canary; die Toleranz wird vorab an skalierten und
farbtransformierten Canary-Kopien positiv kontrolliert. Keiner der privaten
Canary-Strings, privaten IDs, Mechanikwerte oder Pfade darf in Message, Fehler,
Log, DOM, Accessible Name, Screenshotmetadaten oder URL auftreten; weder das
private Raster-Canary noch ein anderes privates Asset darf in den gerenderten
Pixeln vorkommen. GM-Fehlertexte werden in begrenzte neutrale Codes übersetzt.

### P03-Abnahme

- Verbotene Information am passiven Kanal: `0` Bytes/Identitäten in jeder
  Erfolgs-, Fehler-, Fokus-, Asset- und Restartfolge.
- Verbotene private Bildpixel: `0` Treffer in jedem gelesenen Frame; das
  Pixeloracle erkennt seine positiven Canary-Kontrollen auf jeder Plattform
  und Skalierungsstufe.
- Schreib-, Datei-, Datenbank-, freie IPC- und GM-Fähigkeiten im passiven
  Preload: `0`. Direkte Aufrufversuche werden vor Eingabevalidierung abgewiesen
  und erreichen keinen Handler.
- Negativtests für Sandbox, Context Isolation, Node-Integration, Navigation,
  Popup, Download, Berechtigungen, Clipboard, WebStorage/Cache, Crash-Report,
  CSP und Netzwerk erreichen keinen geschützten Sink und hinterlassen keine
  privaten persistenten Bytes.
- Provisorisches Vergleichsbudget: Fokusfeedback p95 <= 100 ms; vollständige
  neue sichere Projektion p95 <= 1 s. Zwischen Fokuswechsel und neuer Projektion
  erscheint nur neutral leer oder die richtige neue Generation, nie ein altes
  unsicheres Frame.
- Verlust, Crash oder Neustart des zweiten Fensters beeinflusst Campaign-
  Wahrheit, Running Scene und GM-Fenster nicht. Wiederöffnung liest nur die
  aktuelle sichere Generation.
- Matrix aus Scene A/B/A, 0/50/100-% Wissen, kalten/warmen Assets, fehlendem und
  beschädigtem Medium, verspäteter Nachricht sowie zwei heterogenen Displays
  besteht auf allen drei Plattformen.
- Tastatur, 200 %, kleine Fenster, automatisierte Accessibility-Prüfung und
  Screenreader-Smoke bestehen ohne private Accessible Names.

### P03 Go/No-Go

Jeder private Canaryfund, eine erreichbare Mutation, ein stale unsafe frame,
eine implizite gemeinsame Preloadfläche oder eine Beeinträchtigung des
GM-Fensters ist sofortiges `No-Go`. Nur ein vollständig fail-closed Ergebnis
erlaubt P04.

## ADR-P04 – Geschlossener, feindlich geprüfter Datenroundtrip

### Beweisfrage und Nichtziele

P04 beweist, dass Campaignzustand, V4-Karte, nutzerlesbare Dokumente, Assets,
Runtime/Trash und ausdrücklich opaque retained Capability-Daten als eine
geschlossene, versionierte Einheit exportiert und atomar als neue unabhängige
Campaign importiert werden können. Das Prototypformat friert noch kein
First-Real-Use-Dauerformat ein und verspricht keine Kompatibilität für
Entwicklungsdaten.

### Besitzdateien des späteren Umsetzungslaufs

- `tools/adr-prototypes/p04/**`
- `tools/adr-prototypes/contracts/p04-v1/**`
- `tools/adr-prototypes/evidence/p04-aggregate.json`
- `tests/adr-prototypes/p04-*.test.*`
- `package.json` und `package-lock.json` nur für exakt gepinnte,
  offline-verfügbare Archiv-/Hash-Prototypabhängigkeiten und P04-Befehle

P04 importiert niemals direkt in P02s Quellprofil. Jeder Import besitzt einen
neuen Campaign-Identifier und einen neuen Staging-/Zielroot.

### Formatgrenze und Fixture

Das Prototyparchiv besitzt ein kanonisches Manifest mit Formatversion,
Campaign-ID der Quelle, logischen Einträgen, normalisierten relativen Pfaden,
Längen, SHA-256, Medientyp, Eigentümerklasse und Kennzeichnung für
`campaign`, `definition`, `runtime`, `trash`, `asset` oder
`opaque-retained`. Das Manifest selbst ist gehasht. Kernschemafelder werden
fail-closed validiert; nur vertraglich gekennzeichnete opaque Daten werden
uninterpretiert erhalten.

Das Byteformat ist ein exakt gepinntes ZIP-Store-Profil ohne Kompression:
UTF-8-/NFC-Pfade, codepunktweise sortierte Einträge, keine Verzeichniseinträge
oder Daten-Descriptoren, weder ZIP64 noch Extra-Felder oder Kommentare, feste
DOS-Zeit `1980-01-01T00:00:00`, Dateiart/-rechte `0100644` und bytegenau
kanonisches Manifest-JSON. Implementierung, Node-Version und
ZIP-Bibliotheksversion sind im Lockfile und Receipt gebunden; Tests prüfen
lokale und zentrale Header sowie CRC32 bytegenau. Nur unter diesem Profil ist
derselbe vollständige Archiv-SHA-256 auf allen drei Plattformen ein Tor. Falls
eine Plattform dieses Profil nicht erzeugen kann, vergleicht die ADR
ausschließlich den kanonischen Manifest-/Entry-Digest und führt den
Archivbytehash getrennt pro Toolchain; sie behauptet dann keinen OS-identischen
Archivhash.

Die ID-Klassen sind vor dem Export fest: Campaign-ID und alle
campaign-lokalen Identitäten werden beim Import neu geprägt; inhaltshashbasierte
Asset-IDs bleiben stabil; eine bereits vorhandene byteidentische globale
Definition verwendet deren Ziel-ID, eine abweichende importierte Definition
erhält eine neue Ziel-ID. Das Manifest enthält eine kanonisch nach Klasse und
Quell-ID sortierte Source→Target-Bijektion: jede Quell-ID besitzt genau ein
Ziel, kein Ziel gehört zu zwei Quellen, und jeder Verweis nennt seine
ID-Klasse. Der Referenzdigest umfasst Mapping und sämtliche normalisierten
Kanten. Für den semantischen Vergleich werden Ziel-IDs ausschließlich über
diese Bijektion auf Quell-IDs zurückgeführt; rohe ID-Gleichheit wird nicht als
Roundtriporacle missbraucht.

Die deterministische Fixture `ADR-R1` enthält mindestens:

- den P02-Campaignstand mit History und Sentinel;
- die P01-V4-Karte samt Key-Abschnitten und stabilen IDs;
- zwei namensgleiche Campaignobjekte, Runtimezustand, einen Trash-Eintrag und
  eine installationweite Definition sowie einen gleichnamigen, inhaltlich
  abweichenden Zielbestand, der eine explizite Konfliktentscheidung erzwingt;
- Text mit Unicode, Groß-/Kleinschreibungs-Kollisionstest und 40-%-
  Pseudolokalisierung;
- lokale Karte, Bild und Audio sowie ein opaque-retained Capabilityblob;
- 512 MiB deterministisch erzeugte Nutzlast in 500 Dateien als begrenztes
  Prototyp-Leistungsprofil. Diese Fixture ist keine `RP-R`-/`RP-L`-Abnahme.

### Feindliche Importmatrix und Abbruch

Der Lauf verändert je eine Kopie gezielt mit Pfadtraversal, absolutem Pfad,
Symlink/Hardlink, doppeltem oder case-kollidierendem Eintrag, falscher Länge,
falschem Hash, abgeschnittenem Archiv, ungültigem Manifest, unbekanntem
Kernschemafeld, externer URI, deklariertem Größen-/Anzahlüberlauf,
Kompressionsbombe, verschachteltem Archiv, beschädigtem Medium,
Unicode-Normalisierungskollision, Windows-Gerätenamen, Alternate Data Stream,
nachgestelltem Punkt/Leerzeichen, übertiefer/überlanger Struktur,
Sparse-Datei sowie besonderem Dateityp oder Ausführungsmodus. Vor Commit
schreibt Import nur in den Stagingroot, führt keine Daten aus, folgt keinem
Link, löst keine externe Ressource auf und öffnet kein Netzwerk.

Abbruch und Prozessende werden vor Manifestabschluss, nach Manifest, mitten in
Assets, nach Validierung, unmittelbar vor Commit und unmittelbar nach Commit
injiziert. Vor Commit hinterlassen sie keine Campaign- oder
Definitionswirkung; nach Commit wird der neue vollständige Campaignstand per
stabiler Import-ID gefunden, nicht erneut importiert.

Definitionen erhalten einen eigenen Quell-, Ziel-, Staging- und
Referenzmappingdigest. Vor Commit bleiben bestehende installationweite
Definitionen bytegleich. Die Matrix prüft getrennt „vorhandene identische
Definition wiederverwenden“ und „abweichende Definition nach expliziter Wahl
unter neuer unabhängiger ID importieren“. Campaignreferenzen werden im selben
atomaren Commit auf die gewählte Ziel-ID abgebildet. Ablehnung oder Abbruch
verändert weder Campaigns noch Definitionen; kein Konflikt darf dauerhaft nur
als unreferenzierter Stagingrest verschwinden.

Campaign und globale Definitionen werden durch genau eine Utility-eigene
Importautorität veröffentlicht. Alle Datei-/Assetbytes werden zuerst unter
ihrem Inhaltshash in einen unveränderlichen Staging-/Blobroot geschrieben und
durable synchronisiert; sie sind fachlich noch unsichtbar. Danach committed
eine einzige SQLite-Transaktion mit `BEGIN IMMEDIATE` neue Definitionen,
Campaign, Source→Target-Mapping, alle Referenzen und das Importreceipt samt
vorbereiteten Digests. Dieser DB-Commit ist der einzige Veröffentlichungspunkt;
vorhandene Definitionen werden niemals in place mutiert. `importId` plus
Manifestdigest ist der Idempotenzschlüssel. Fehlende Transaktion bedeutet
`not_applied` und macht unreferenzierte Blobs bereinigbar, vorhandenes passendes
Receipt bedeutet vollständig `applied`, ein anderer Digest unter derselben ID
wird abgewiesen. Faults nach jedem Blob-, Sync-, `BEGIN`-, Tabellen-, Receipt-,
`COMMIT`- und Antwortschritt beweisen nach Recovery entweder vollständige neue
Wahrheit oder keinerlei sichtbare Wirkung; ein teilveröffentlichter
Campaign-/Definitionsstand ist `No-Go`.

### P04-Abnahme

- Nach Entfernung der Quelle besitzt der Import über die geprüfte Bijektion
  semantisch identische Campaign-, Karten-, Runtime-, Trash-, Definitionen-/
  Mapping- und opaque-retained-Digests sowie bytegleiche Assethashes. Ein
  Negativscan findet die Quell-Campaign-ID und alle nur in der Quelle gültigen
  lokalen/Definitions-IDs außerhalb des expliziten Mapping-/Provenienzblocks
  nullmal; jede Zielreferenz löst sich innerhalb der Zielwahrheit auf.
- Rejection, Abbruch und jeder Fault lassen bestehende Campaigns und
  installationweite Definitionen byte- und semantikgleich. Stagingreste sind
  fachlich unsichtbar; ihre Entfernung beziehungsweise explizite resumierbare
  Markierung wird gegen das provisorische 10-s-Vergleichsbudget gemessen.
- Provisorisches Vergleichsbudget: Abbruch vor Commit bestätigt p95 <= 1 s.
  Fortschritt erscheint innerhalb 1 s; erwartete Dauer über 10 s zeigt
  bestimmbaren Fortschritt und expliziten Abbruch.
- Auf `ADR-R1` werden Export/Import gegen das provisorische Vergleichsbudget von
  jeweils 60 s und temporärer Platz gegen 120 % von Eingabe plus Ausgabe
  gemessen. Diese Werte sind wegen der nicht normativen 512-MiB-Population kein
  Performance-No-Go. Hart bleiben höchstens ein aktiver plus ein wartender Job,
  begrenzte Eingaben/Verstärkung und vollständige Messung von RSS, CPU, Handles
  und Speicherdruck. `TN-19`, `TN-20`, `RP-R` und `RP-L` bleiben offen.
- Alle neun gerichteten OS-Kombinationen bestehen mit demselben kanonischen
  Manifest-/Entry-Digest und semantischem Zieloracle. Der vollständige
  Exporthash muss nur beim oben definierten identischen ZIP-Profil gleich sein,
  sonst wird er pro Toolchain ausgewiesen. Der Kernlauf besteht mit
  deaktiviertem Netzwerk und meldet unerklärte ausgehende Verbindungen als
  Fehler.
- Jeder feindliche Fall wird vor Commit abgewiesen; Pfadescape, Ausführung,
  Netzwerkauflösung, stilles Weglassen, unbeschränkte Verstärkung und
  unbestätigte Mutation bestehender Definitionen sind jeweils `0`.

### P04 Go/No-Go

`Go` erfordert vollständigen Roundtrip, Fault-/Angriffsmatrix,
Plattformpaarungen, Ressourcenmessung, das harte Queue-/Verstärkungstor und
unabhängigen Restore-/Importreview. Die provisorischen Zeit-/Platzbudgets
begründen keine TN-Erfüllung.
Ein fehlendes Asset, eine nicht geschlossene Referenz, Quellenabhängigkeit,
Teilmutation, stilles Salvage, unbekanntes Kernschema, Egress oder ungebundene
Ressourcennutzung ist `No-Go`.

## Gesamtfolge und ADR-Entscheid

Die Reihenfolge ist verbindlich:

1. `ADR-P01` beweist Kartenwiederverwendung und die Renderergrenze.
2. `ADR-P02` ergänzt die einzige lokale Mutationsautorität und Crashsicherheit.
3. `ADR-P03` verwendet diese Prozess-/Rollenbasis für das passive Fenster.
4. `ADR-P04` schließt Daten, Karten, Assets, Runtime und retained Capability-
   Daten portabel zusammen.
5. `ADR-C01` beweist alle vier Vertragsversionen gemeinsam auf genau einer
   Main-/Utility-/Preload-/Renderer-/Speichergrenze.

P02 wird erst nach abgeschlossenem P01-Aufräumreview spezifiziert und
umgesetzt. P03 baut erst auf dem reviewten Prozess-/Receiptmodell aus P02 auf.
P04 beginnt erst, wenn P01- und P02-Digests als feste Eingangsorakel vorliegen.
C01 beginnt erst nach dem P04-Review und verwendet die erhaltenen
Vertragsartefakte; sein Aufräumen entfernt den Composition-Harness, nicht die
Verträge. Ein späterer Prototyp darf kein früheres No-Go verdecken.

### Außerhalb P01-P04 verbleibende Ratifikationsblocker

Auch vier bestandene Prototypen plus Composition-Lauf reichen nicht für den
Plattformentscheid. Vor Ratifikation benötigen folgende Dimensionen eigene
ausführbare, reviewte Risikobelege und Besitzpläne; sie dürfen nicht still in
P01-P04/C01 wachsen:

- **Distribution:** signierter oder nachvollziehbar identifizierter
  Plattformbuild, frische Installation, Update, fehlgeschlagenes Update mit
  Rollback, Deinstallation ohne Campaignverlust sowie native Abhängigkeiten auf
  Linux, Windows und macOS;
- **Extensions:** explizite Identität und Version, Default-Deny, genaue
  Einwilligung, Widerruf vor dem nächsten geschützten Sink, Update/Reinstall,
  Crash/Inkompatibilität, kein passiver Datenkanal und Roundtrip retained
  opaque data;
- **Audio und lange Arbeit:** lokale portable Musikdatei, Fade/Autoplay mit
  manueller Priorität, fehlendes/beschädigtes Medium sowie ein abbrechbarer
  Hintergrundjob, während alle Livebudgets weiter gelten;
- **Dreioptionenvergleich:** die oben definierte Matrix mit referenzierten
  Obsidian-, Direkt-Standalone- und Hybridbelegen einschließlich
  Distribution, Erweiterbarkeit und Rückfallkosten.

Fehlt einer dieser Belege, lautet der ADR-Status weiter `proposed`, auch wenn
P01-P04 bestanden sind.

Die bevorzugte Richtung erhält erst `Go zur Vervollständigung des
ADR-Entscheids`, wenn:

- P01 bis P04 nach etwaiger Nachbesserung jeweils unabhängig ohne Pflichtbefund
  reviewt sind;
- ADR-C01 alle vier Pakete ohne Sonderbrücke auf einer gemeinsamen Grenze
  zusammengesetzt hat und unabhängig ohne Pflichtbefund reviewt ist;
- die Plattform- und Darstellungs-Matrix vollständig ist;
- jeder unveränderliche P01-P04- und C01-Aggregatbeleg nennt den exakten
  geprüften Paketkandidaten-SHA und dessen Lockfile-Digest; alle fünf belegen
  denselben
  gehashten Produktquellen-/Fixture-Eingabestand. Paketlokale
  Dev-Abhängigkeitsunterschiede sind explizit, eine Änderung dieses gemeinsamen
  Eingabestands erzwingt die Wiederholung aller betroffenen früheren Pakete;
- Hex/Atlas-, Stadt- und Dungeon-Gerätekollegen ihre Formate, Belege,
  Performancegrenzen und offenen Gates bestätigt haben;
- die drei lokalen Integrationsstränge die Scope-/Migrationsgrenzen bestätigt
  und die Cloud-Reviewer Architektur, Sicherheit, Daten und Accessibility
  unabhängig geprüft haben;
- kein ausführbarer Prototyp im Produktbundle, installierten Plugin oder
  Nutzervault liegt, die versionierten Verträge weiter prüfbar sind und der
  Aufräumreview alle temporären Fähigkeiten inventarisiert hat.

Danach dokumentiert ein eigener ADR-Ratifikationslauf die tatsächlichen
Receipts, die Dreioptionenmatrix, alle zusätzlichen Blocker, Abweichungen und
den gewählten Host in den bestehenden Architektur-, Checkpoint- und
Acceptance-Eigentümern. Dieses Plandokument ändert deren Stand nicht. Bei
`No-Go` bleibt Obsidian der laufende Adapter, die vorhandene Facharbeit läuft
weiter und das Team plant eine neue Zielplattformhypothese; es entstehen weder
ein halb migriertes Produkt noch zwei Datenwahrheiten.
