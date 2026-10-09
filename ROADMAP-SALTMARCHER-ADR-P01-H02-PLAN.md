# ADR-P01-H02 – Echte Desktop-Prozess- und Linux-Durability-Hypothese

Stand: 9. Oktober 2026

Art: reviewpflichtiger Ersatzhypothesenplan nach dem geprüften ADR-P01-No-Go;
keine Produkt-, Plattform- oder P02-Freigabe

## Ausgang und Entscheidungsfrage

ADR-P01-H01 endete korrekt mit `No-Go`: Der Same-Process-Harness mit Node-`fs`
belegte weder eine echte Desktop-Prozessgrenze noch die geforderten nativen
Durability-Primitiven. Er wurde nach unabhängigem Review aufgeräumt; erhalten
bleiben der versionierte Vertrag `p01-v1` und sein Aggregatbeleg.

H02 prüft genau eine neue Hypothese:

> Eine kleine echte Electron-Shell kann die unveränderte hostneutrale
> Kartenlogik über Renderer, engen Preload, Main, Utility-Prozess und einen
> minimalen nativen Linux-Dateihelper ausführen. Der Renderer besitzt keine
> privilegierte Abkürzung; bestätigte Writes überleben Prozessabbrüche als
> vollständig alte oder vollständig neue Wahrheit beziehungsweise bleiben
> als sichtbarer Konflikt erhalten.

Ein Erfolg qualifiziert diese Architektur nur auf Linux zur anschließenden
vollständigen P01-Wiederholung. Er ratifiziert keine Zielplattform und
autorisiert weder ADR-P02 noch die Entfernung des Obsidian-Adapters.

## Bewertete Alternativen

| Hypothese | Befund |
| --- | --- |
| Electron Main → echter Utility-Prozess → nativer File-Helper | **H02-Kandidat**; kann Prozessgrenze und native Dateisemantik gemeinsam belegen |
| Electron Main → Utility-Prozess → Node-`fs` | verworfen; beweist IPC, wiederholt aber den H01-Durability-Mangel |
| nativer Helper ohne Electron-Prozesskette | nur interne Vorprobe; beweist keine Renderer-/Preload-/Desktop-Grenze |

## Fester H02-Schnitt

### Prozesskette

Der ausführbare Harness besitzt genau diese Kette:

1. ein sandboxed Electron-Renderer ohne Node-Integration;
2. einen isolierten Preload mit `contextIsolation`, der nur die versionierten
   Kartenoperationen anbietet;
3. Electron Main als Kanal- und Lebenszyklusautorität;
4. einen echten Electron-`utilityProcess` als einzige Karten-/Repository-
   Autorität;
5. einen lang laufenden nativen Linux-Helper als einzige Autorität für die
   getesteten Dateioperationen.

Kein Glied darf Utility- oder Helpercode direkt importieren und damit die
Prozessgrenze im Test umgehen. Receipt und Tests binden PID, Parent-PID,
Prozessstart, Prozessende, Kanalregistrierung und einen pro Lauf zufälligen
Prozesstoken für jedes Glied. Ein frischer Reopen verwendet vollständig neue
Renderer-, Main-, Utility- und Helperprozesse.

### Rendererfähigkeiten

Der additive Vertrag `p01-v2` definiert und validiert genau:

- `openMap({ mapId, expectedRevision })`;
- `executeMapCommand({ mapHandle, expectedRevision, command })`;
- `saveMap({ mapHandle, expectedRevision })`;
- `readAsset({ mapHandle, assetId, expectedHash })`;
- `subscribeMapInvalidation({ mapHandle, revision }, listener)` samt enger
  Abmeldung.

Antworten sind validierte, eingefrorene DTOs. Der Renderer erhält keine Pfade,
Rohdateihandles, allgemeinen IPC-Sender, beliebigen Kanalnamen, `require`,
`process`, `fs`, SQLite oder Helperprotokolle. Vertragsvalidierung findet auf
beiden Seiten jeder JS-Prozessgrenze statt. Das Native-Protokoll besitzt eine
eigene feste Versionskennung, erlaubte Operationen und Größenlimits; es ist
kein allgemeiner Dateisystemdienst.

### Native Linux-Grenze

Der Helper ist ein kleiner, aus eingechecktem C-Quelltext reproduzierbar
gebauter Linux-Prozess. Er bindet den einmal übergebenen neuen Testroot als
Verzeichnis-FD und akzeptiert danach nur validierte relative Namen. Seine
H02-Primitiven sind:

- `openat2` mit `RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS`;
- FD-basierte Geräte-/Inode-/Typprüfung vor jedem Schritt;
- exklusive gleichverzeichnisige Temp-/Backup-/Receipt-Erzeugung;
- `fdatasync` beziehungsweise `fsync` für Datei und Receipt;
- `renameat2` mit der jeweils erforderlichen No-Replace-/Exchange-Semantik;
- `fsync` des betroffenen Verzeichnisses nach Namensänderungen.

Root-, Mount-, Parent-, Symlink-, Hardlink- oder Dateiidentitätswechsel werden
fail-closed behandelt. Fehlt eine Primitive oder lässt sich ein konkurrierender
Writer nicht sicher erkennen, endet H02 für Linux mit `No-Go`; ein Fallback auf
generisches `rename()` oder Node-`fs` ist verboten.

Der Helper implementiert nur die im bestehenden P01-Plan festgelegten
Create-, Update-, Delete-, Receipt- und Recovery-Zustände. `MapRepository` und
seine fachlichen Journal-/Draftregeln werden nicht kopiert oder verändert;
der Utility-Prozess verwendet die unveränderten Produktmodule und adaptiert
ihre Dateioperationen auf den engen Helper.

## Besitz und Isolation

Der spätere H02-Umsetzungslauf besitzt ausschließlich:

- `tools/adr-prototypes/p01/**`;
- `tools/adr-prototypes/contracts/p01-v2/**`;
- `tests/adr-prototypes/p01-*.test.*`;
- `tools/adr-prototypes/evidence/p01-aggregate.json`;
- `package.json` und `package-lock.json` nur für exakt gepinnte, temporäre
  H02-Entwicklungsabhängigkeiten und Befehle;
- dieses Plandokument sowie die zugehörigen Statusfelder in `checkpoint.json`
  und `acceptance.json`.

`p01-v1` bleibt unverändert als No-Go-Eingangsoracle erhalten. `src/**`,
`styles.css`, `build.mjs`, die installierte Obsidian-Kopie, Nutzer-Vaults und
andere Roadmaps liegen außerhalb des Besitzes. Benötigt H02 dort eine Änderung,
ist das Ergebnis `No-Go: boundary` und kein still erweiterter Scope.

Vor und nach H02 werden `main.js`, `manifest.json` und `styles.css` gehasht.
Produktbundle und installierter Adapter müssen byteidentisch bleiben. Der
Harness verwendet ausschließlich neue Profile und Testroots unter
`/home/aaron/.cache/dungeon-native-qa/smr-adr-prototypes/ADR-P01-H02/`.

## Ausführungsfolge

1. **Vertrag und negative Grenze:** `p01-v2`, Kanal-Whitelist, Größenlimits,
   unverfälschbare Handles und der Native-Protokollvertrag werden zuerst durch
   reine Contract-Tests fixiert.
2. **Native Vorprobe:** Der Helper besteht Create/Update/Delete, Root-FD,
   Identitäts- und Linkabwehr sowie seine Faultmatrix ohne Electron. Das ist
   noch kein H02-Erfolg.
3. **Echte Prozesskette:** Eine minimale BrowserWindow-Seite ruft ausschließlich
   über Preload → Main → Utility → Helper auf. Direktimport, unbekannter Kanal,
   Nodezugriff und direkter Dateiabruf werden negativ getestet.
4. **Kartenoracle:** kleine Core-Fixture und die bestehende große V4-Fixture
   werden mit unverändertem Modell geöffnet, begrenzt verändert, gespeichert
   und in einer vollständig frischen Prozesskette semantisch identisch erneut
   gelesen. Ausgangsfixtures bleiben bytegleich.
5. **Abbruch und Recovery:** Ein externer Controller beendet ausschließlich den
   aufgezeichneten Renderer, Utility-Prozess oder Helper an den definierten
   Acknowledgement-Punkten. Danach entscheidet eine frische Prozesskette den
   Zustand.
6. **Receipt und Review:** Der saubere exakte Kandidaten-SHA erzeugt ein
   unveränderliches externes Receipt und einen kleinen gehashten Aggregatbeleg.
   Erst ein unabhängiger Technik-/Sicherheitsreview entscheidet Go oder No-Go.
7. **Aufräumen:** Unabhängig vom Ergebnis folgt ein eigener Aufräumcommit samt
   Review. Ausführbarer Harness, H02-Tests, Befehle und temporäre
   Abhängigkeiten werden entfernt; versionierter Vertrag und reviewter
   Aggregatbeleg bleiben.

Nach höchstens zwei erfolglosen vollständigen Versuchen oder 45 Minuten an
derselben Fehlerhypothese wird anhand der vorhandenen Belege entschieden.

## Harte Gates

### Prozess und Capability

- Renderer, Main, Utility und Helper sind gleichzeitig als unterschiedliche
  echte Prozesse mit korrekter Elternkette nachgewiesen.
- `nodeIntegration=false`, `contextIsolation=true`, Sandbox und exakt bekannte
  Kanäle sind im Lauf belegt.
- Rendererzugriffe auf `require`, `process`, Node-/Dateimodule, lokale
  Testdateien und einen unbekannten IPC-Kanal schlagen fehl.
- Rendererantworten enthalten keine absoluten Pfade, nativen Handles,
  Helperdetails oder unvalidierten Zusatzfelder.
- Invalidation ist ein echter, abbrechbarer Stream über die Prozessgrenze;
  eine einmalig konstruierte DTO-Antwort genügt nicht.

### Karten- und Restart-Oracle

- Kleine und große V4-Fixture verwenden unveränderte Produktlogik und stabile
  IDs; keine Modell-, Session-, Command-, Persistence- oder Rendererkopie liegt
  im Harness.
- Open → begrenzte Mutation → Undo → Redo → Save → vollständiger Neustart
  ergibt den erwarteten kanonischen Dokumentdigest.
- Save-Erfolg wird erst nach durablem repositoryweitem Commit bestätigt.
  Verlorener Utility- oder Helperprozess liefert niemals einen bestätigten,
  aber unvollständigen Write.

### Native Faultmatrix

Create, Update und Delete besitzen getrennte Zeilen. Abbruchpunkte liegen
mindestens vor und nach Temp-Sync, Receipt-`prepared`, Backup-Capture,
Publikation beziehungsweise Delete, Verzeichnis-Sync, Receipt-Commit und jeder
Parent-Freigabe. Zusätzlich werden unmittelbar vor jedem Dateisystemschritt
Symlink-, Parent-Symlink-, Hardlink-/Identitäts-, Root- und Mountwechsel
injiziert.

Nach Recovery ist der Zustand ausschließlich:

- vollständige alte Wahrheit samt passendem Receipt;
- vollständige neue beziehungsweise gelöschte Wahrheit samt passendem Receipt;
- oder ein erhaltener, sichtbarer Konflikt ohne Überschreiben.

Gemischte Karte/Notiz/Draft-Zustände, ein dritter still akzeptierter Hash,
vorzeitig gelöschte Child-Belege oder ein unvollständiger bestätigter Write
sind sofortiges `No-Go`.

### Reproduzierbarkeit und Basisprüfungen

- Native Buildbefehl, Compiler/Linker/Libc/Kernel, Quellhash, Binärhash und
  geladene Bibliotheken stehen im Receipt.
- Electron-, Node-, npm-, OS-, Architektur-, Source-/Lockfile- und
  Fixtureidentität sind gebunden; der Lauf ist sauber (`dirty: false`).
- `npm run check`, `npm test` und `npm run build` bestehen auf dem exakten
  Kandidaten-SHA.
- Produktbundle und installierte Obsidian-Eingaben bleiben byteidentisch.
- Alle nicht ausgeführten GUI-, Accessibility-, Windows- und macOS-Zeilen sind
  ausdrücklich `not-run`, nicht implizit bestanden.

## Plattformgrenze

H02 implementiert nur Linux. `p01-v2` trennt den fachlichen FileStore-Port vom
Linux-Backend, behauptet aber keine Portabilität. Spätere echte Gerätepakete
müssen dieselbe Semantik separat belegen:

- Windows: root-relative Handles, Reparse-Point-Abwehr, File-ID/Share-Modus,
  `FlushFileBuffers` und Write-through-Rename;
- macOS: `openat`/`O_NOFOLLOW`, Identitätsprüfung, `F_FULLFSYNC`, atomare
  Publish-Operation und nachgewiesener Verzeichnissync.

Cross-Compile, Emulation oder ein gemeinsames Interface schließen diese
Zeilen nicht. Vor den realen Receipts lautet der einzig zulässige Befund:
`Linux-Hypothese geprüft; Windows und macOS offen`.

## Review- und Geräteaufteilung

- Lokaler Umsetzungsstrang: genau ein H02-Kandidat und die Linux-Receipts.
- Zweiter lokaler Strang: unabhängiger Planreview, später Code-/Evidence- und
  Aufräumreview; keine Mitautorenschaft am jeweiligen Kandidaten.
- abgelöster GM-Cloud-Kollege: Architekturreview von Prozessmodell,
  Vertragsversionierung, IPC-Whitelist und einzelner Speicherautorität.
- Cloud-Sicherheitskollegen: Handle-Unerratbarkeit, Root-FD-, TOCTOU-, Link-
  und Identity-Faultmatrix.
- Dungeon-/Atlas-Gerätekollegen: bestehende V4-Fixture, Kartenidentität und
  semantisches Restart-Oracle; keine konkurrierenden GUI-Läufe auf demselben
  Gerät.
- Windows- und macOS-Gerätekollegen: erst in gesonderten Folgepaketen reale
  Build-, Prozess-, Primitive- und Faultreceipts. Ein Betriebssystem wird nicht
  aus der bloßen Laptopanzahl abgeleitet.

## Entscheidung

`H02-Go` bedeutet nur: Die verworfene H01-Annahme wurde auf Linux durch eine
belegte echte Prozess-/Durability-Architektur ersetzt; darauf darf ein Plan für
die vollständige plattformübergreifende ADR-P01-Wiederholung folgen.

`H02-No-Go` gilt bei Prozessabkürzung, Rendererprivileg, allgemeinem
Dateidienst, fehlender nativer Primitive, unbeherrschtem konkurrierendem
Writer, Datenverlust, Mischzustand, notwendigem Produktrewrite oder nicht
reproduzierbarem Beleg.

ADR-P02, ADR-P03, ADR-P04, ADR-C01 und die Plattform-ADR bleiben in beiden
Fällen gesperrt beziehungsweise vorgeschlagen, bis ihre jeweils eigenen
Voraussetzungen erfüllt sind.

## Planreview ADR-P01-H02-R01

Der unabhängige schreibgeschützte Review auf dem exakten gemeinsamen Commit
`0dd314c1772ebd91f3375d8660f964a731bdf215` ist `PASSED`. Er bestätigte ohne
Pflichtbefund die echte Prozesskette ohne Direktimport, unveränderte
Produktmodule, native Linux-Primitiven, getrennte Create-/Update-/Delete- und
TOCTOU-/Identity-/Root-/Link-Faultmatrizen, reproduzierbare Receipts,
verpflichtendes Cleanup, die ehrliche Linux-only-Grenze und die fortbestehende
Sperre von P02/P03/P04/C01 und Plattform-ADR.

Dies ist ausschließlich eine Planfreigabe. Ein H02-Kandidat benötigt weiterhin
seine vollständigen Gates, unabhängigen Code-/Evidence-Review und
Aufräumreview.
