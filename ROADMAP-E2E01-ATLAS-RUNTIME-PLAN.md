# E2E-01-SPACE-I01c-RUNTIME-P01: Kampagne zum bestehenden Atlas verbinden

## Konkreter nächster HEX-04-Eingang

[D01-Modellbefund](docs/reference/atlas-detail-binding-d01/README.md) auf
`7ec9f85ef9d6b263504ea2398ca1bbfc41b97899`, E2E-01 Nutzerzeile13:
Save eines Detaillinks am bestehenden Ort und des geänderten Parents einer
bestehenden Dungeonplatzierung gelingt, behält jedoch veraltete Atlas-Registryreferenzen.
Eine frische Modell-Repositoryinstanz bestätigt die gespeicherten nativen Bindungen
und ihre abweichende Registryclosure; Dungeonbytes und Undo/Redo bleiben exakt.
Die [N01-Reparatur](docs/reference/atlas-detail-binding-d01/repair-n01.json) auf
`9784d03ec33cccefebb6878383f6f7e80e034102` leitet die Atlasreferenzen aus exakten
nativen Before-/Afterdaten ab und nutzt die vorhandene Campaign-Erweiterungsautorität.
Neun neue Regressionen prüfen Save/Undo/Redo, frischen Modell-Mount, Recovery und
gefälschte Referenzbelege; der gemeinsame Stand mit Shared527398c besteht Typprüfung,
880 Tests (ein optionaler PDF-Test ausgelassen) und Build. Der unabhängige
Campaign/Data-Review und die separate [PR78-Integration](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/7#issuecomment-6102632284)
sind konsumiert. [I01: sichtbarer Dungeon-am-Ort-Anschluss](docs/reference/atlas-detail-binding-d01/dungeon-at-location-i01.json)
nutzt jetzt vorhandene Platzierungen und die gemeinsame History; neue Placementkennungen
werden weiterhin nicht freigegeben. Aktuelle Fortsetzung führt #80.
N01 liefert keinen GUI-/Electron-/physischen oder Gesamt-E2E-Nachweis und keine neue allgemeine
Plan-/Reviewrunde. Der begrenzte abgeschlossene #40-Scope bleibt erhalten.

Der begrenzte Orts-/Key-/Verschiebe-/UndoRedo-/Save-/Frischstart-Meilenstein
[#40](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/40) ist
qualifiziert: [Stadt H02](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/40#issuecomment-6101960077),
[Campaign/Data-Dateiorakel](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/40#issuecomment-6101957277),
[Chronik R02-N01](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/40#issuecomment-6102084191)
und [separate PR72-Stewardintegration](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/72#issuecomment-6102108341)
sind konsumiert. [Qualifikationsentscheidung](docs/reference/atlas-shared-location-h02/qualification.json).
Der tatsächliche native Source bleibt `4515088772b759cda2e19d249367699c9868c72c`;
spätere Shared-Commits sind kein neuer nativer Hostlauf. Das gemeinsame E2E-01-Gate
bleibt offen. Die [eigene begrenzte Bereinigung](docs/reference/atlas-shared-location-h02/cleanup.json)
ist abgeschlossen: vollständiges hashgeprüftes Archiv des H02-Prüfcheckouts,
danach normale Entfernung nur dieses Checkouts; Belege und Testvault erhalten.
Nächster produktiver Hex-Anschluss bleibt die konkrete Detail-/verortete-Dungeon-/
Raum-Key-Folge derselben E2E-01-Zeile. In diesem Bereinigungslauf werden keine
Produktänderung, GUI, CITY oder E2E-02–04 begonnen.

#### Arbeitsstand #80

Hex besitzt Dungeon-am-Ort und Orts-/Raum-Inspector in Canvas, Repository und
History: E2E-01 Nutzerzeile13, E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001.
Stadt besitzt City. Parent #80 bleibt offen; Branch
`hex/dungeon-at-location-inspector-n01-20261011`. Historische Belege sind keine Aufträge.

**Integrierter Produkteingang:** [PR157](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/157)
ist separat im Shared b9ce2385 angekommen, Produktquelle b6ec69d4.
N01 managed Suspend/Retain/Dispose und N02 eindeutige Pfad+World-ID-Zuordnung sind
[gezielt unabhängig geprüft](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/157#issuecomment-6108108606).
Unregistrierte geschlossene Copy darf neben fremden gültigen Manifesten öffnen;
keine Campaign-/Registryautorität. Closure/Codecs/Draft/Journal lesend vor Writes,
gepinnt, gewonnene alte Journale enden unter alten Pfaden; kein widerrufener Editor.
Der Merge erweitert keine Produkt-/Fachfreigabe und verlangt keinen neuen allgemeinen Review.

**Konsumierter Nutzerweg:** PR81/87/78 liefern Verorten/Raum-Key/Rückkehr;
PR91/100/110 Escape/Scroll/Fit. [N04](docs/reference/atlas-detail-binding-d01/inspector-horizontal-fit-n04.json)
belegt horizontalen Dock-Fit100/131%; vertikales Scrollen bleibt nötig.
[GM-Same-session](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80#issuecomment-6105400641)
und [FreshReuse](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80#issuecomment-6105912997)
belegen Torheim/Suche Torraum/Eingangstext auf87ccdb2;131%-Fit nur PR115.
S01 konsumierte6d03e5a in3af22a1; fremde Tester-PIDs sind kein Hex-Host-PASS.

**Erhaltene Speicher-/Copybelege:** Ctrl/Meta+S-Kompositionsschutz im DOM ist kein
nativer IME-/Meta-PASS. [R01](docs/reference/atlas-detail-binding-d01/inspector-save-routing-r01.json),
F01/R02/F02 belegen Orts-/Raum-Save und exakte Bytes/IDs im frischen Prozess;
D02-N02 tatsächlichen Discard mit neuen Sources/History0. R03 belegt unsaved Raumtext
im echten v3-Draft nach normalem Quit/Fresh, voller Dungeon/Markdown/Geometrie exakt,
History0/dirty/kein Redo, Original8/Draft bytegleich; kein Hardcrash/Kamera-History-Fresh.
C01 Leafwechsel `_cancelResize` und [C02 QA-Orakelfehler](docs/reference/atlas-detail-binding-d01/room-draft-copy-c02/README.md)
bleiben unverändert als FAIL. [C03](docs/reference/atlas-detail-binding-d01/room-draft-copy-c03/README.md)
belegt sichtbares Copy/Abbrechen und normalen Frischeinstieg derselben unabhängigen
Kopie:7 native Dateien/23 frische geschlossene IDs, exakter unsaved Raumtext,
Vollworld/SpatialState/Dungeon, eine Repository/History clean0; Original8/Draft exakt.
N01/N02-Reparaturen und C03 sind konsumiert; Quelle/Buildpfad bleiben in P01 und committed-Copy-C01 identisch.

**Konsumierte Speicher-Recovery:** [P01 prepared Copy](docs/reference/atlas-detail-binding-d01/room-copy-journal-p01/README.md)
nimmt7 Ziele zurück; Retry erzeugt23 neue geschlosseneIDs. [Committed Copy](docs/reference/atlas-detail-binding-d01/room-copy-committed-journal-c01/README.md)
öffnet dieselben7 After-Dateien/23IDs ohne Replay. [J01 committed Room-Save](docs/reference/atlas-detail-binding-d01/room-save-committed-journal-j01/README.md)
bewahrt alle3 After-Zustände trotz Cleanupfehler und übernimmt dieselben8 Dateien/IDs
beim normalen Freshstart. Steward hat [J01 in50b74fb4 konsumiert](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/165#issuecomment-6108940024).
Historische Rohbelege/FAILs und damaliger Anzeigefehler bleiben erhalten.

**Jetzt konsumierbare Produktkorrektur J02:** Der entzogene alte Editor zeigt
„Entwurf erhalten; Bearbeitung angehalten.“; eine späte erfolgreiche Saveantwort
überschreibt dies nicht. Zwei Produktzeilen, zwei direkte vorher rote Regressionen;
Storage-/Journal-/Identitätssemantik bleibt gleich. [Native Fehler-/Freshnachprobe](docs/reference/atlas-detail-binding-d01/room-save-retained-status-j02/README.md)
zeigt den korrigierten Status tatsächlich im Bild, bewahrt Vollstate/Kamera/History
und übernimmt beim normalen Freshstart gleiche8 After-Dateien/IDs und Raumtext,
eine aktuelle Repository/History clean0, kein Draft/Journal. Beide neue Prozesse
regulär beendet/PIDs weg;1175 historische/fremde Dateien/Nutzervault erhalten,
[Slot zurück](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/11#issuecomment-6109012729). Native Quelle61684630, Sharedbasis50b74fb4;
danach integrierte dd7311e0 regulär übernommen. Atlaspfade gleich, optionale
Dungeon-Volumes geändert; separater Kompositionsbeleg,78 Hosttests bestehen.
Native Quelle bleibt gebunden, finale Kandidaten-CI getrennt.

**Anschluss:** Steward kann konkrete Produktkorrektur, Regressionen und J02-Nachprobe
unabhängig verwenden. Hex behält #80/Branch; nächster eigener Speichereingang ist
prepared Room-Savejournal-Recovery. Vor neuer lokaler GUI erneut Slot koordinieren.
Keine zusätzliche allgemeine Reviewrunde/Selbstintegration.

Eingang: https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80
Kanonisch acceptance.hexAtlas.requirements[30].dungeonAtLocationRetainedSaveStatusJ02;
historische Records bleiben erhalten.

**Offen:** prepared Room-Savejournal, unabhängige Verwendung des Fixes, vollständige
Save-UX, Komposition/Meta/physische IME, äußeres Clipping, Gesamt-E2E sowie
Original-/Großkarten-/Nutzervaultabnahme. Kontrollierter Storagefehler/synthetische
UI ist kein Hardcrash/physischer PASS.

## Historische Planbasis und Lieferbelege

Die folgenden Anschlüsse, Lücken und nächsten Schritte beschreiben ihre jeweils
genannte Quellbasis. Sie sind keine aktuelle Aufgabenfolge; auch alte Planreview-,
I01a/b/c- oder Aufräumanweisungen starten keine neuen Pakete. Die verlinkten
H01-/D01-/R01-/N02-Artefakte einschließlich des hashgebundenen R01-README bleiben
unveränderte Belege ihrer damaligen Ausführung. Für die Fortsetzung #80 lesen.

## Nutzerziel, Basis und unveränderte Abnahmelinie

Beitrag zu [E2E-01, Nutzerzeile 13](ROADMAP-E2E-GATES-CANDIDATE.md#e2e-01--kampagne-und-gemeinsamer-raum--saverestart):
Eine bestätigte Kampagne öffnet ihren tatsächlichen Atlas. Derselbe Canvas erlaubt
Hex → Ort/Key → Stadt/Haus → Dungeon/Raum/Key und zurück durch Zoom; Bearbeitung,
Undo/Redo und lokale Speicherung bleiben in einer Atlas-Lebensdauer verbunden.
Ein Kampagnenwechsel darf offene Arbeit nicht verlieren und keine Auswahl,
Kamera, History oder verspätete Antwort in eine andere Aktivierung übertragen.

Planbasis: alleiniger PR-13-Kandidat
`ebcbbadcef2425b843a46e69e4eb29599386dc63`, mit vollständig konsumiertem Shared
`e09d1959e26536c9dcaff7d2d13b601cf3077e36`. Das integrierte Campaign-Vertragspaket
`d06354c37ea24c249a23310f1a186a0a5ee4e936`, sein unabhängiger
[Kompositionsreview](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/13#issuecomment-6093998767)
und dessen getrenntes
[Aufräumen](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6094023183)
sind Vorbelege. Sie werden nicht neu abgenommen. Der
[räumliche Integrationsplan](ROADMAP-E2E01-SPATIAL-INTEGRATION-PLAN.md), die
[Campaign-Kontextgrenze](ROADMAP-E2E01-CAMPAIGN-CONTEXT-PLAN.md) und der
[Ownership-Vertrag](ROADMAP-E2E01-CAMPAIGN-OWNERSHIP-PLAN.md) bleiben maßgeblich.
Der dort historische offene Stand wird durch tatsächliche Quellnachweise ergänzt,
nicht als zweiter Lieferplan erneut gestartet.

Das aktive Fixture bleibt **e2e01-spatial-v2**; sein
[Manifest](tests/fixtures/atlas-e2e-spatial-v2/manifest.json), alle sieben nativen
Dateien und historische Fixtures bleiben bytegleich. Campaign-/Registry-Eingaben
werden später separat durch ihre tatsächlichen Owner geliefert. Bis dahin beweist
ein kontrollierter Port im Kerntest ausschließlich Consumerverhalten.

## Tatsächliche Anschlüsse und konkrete Lücken

| Vorhandener Anschluss auf der Planbasis | Verwendung / noch notwendige Änderung |
| --- | --- |
| `CampaignLifecycle.context`, `activate(commandId, campaignId, kind)` | Konsumiert eine bestätigte immutable `CampaignContextProjection`; `applied=false` oder inzwischen fremder Context wird verworfen. `activate` setzt seinen Context vor einem Atlas-Mount. Deshalb muss der Host eigene offene Arbeit vor einem angeforderten Wechsel sichern; der Adapter erfindet keine rückrollbare Lifecycle-Transaktion. |
| `CampaignOwnerRegistryPort.read/verify` | Autoritative, injizierte Grenze. Liefert Campaign-/Registry-/Owner-/Schema-/Snapshot-/Policy-Bindungen; native Dateisuche ersetzt sie nicht. Ein produktiver Provider fehlt. |
| `AtlasRepository.spatialGraph.world()`, `TerrainSource.history`, `location`, `ensureLocation`, `detail`, `ensureDetail` | Tatsächliche World-/Location-/City-/Dungeonquellen einer History. Der private Repository-Snapshot enthält nur geladene Terrainchunks und ist noch kein vollständiger Campaign-Ownerexport. |
| `AtlasHistory.addPreflight`, `subscribe` | Contextbindung vor jedem bestätigten Execute/Undo/Redo prüfen. Hydration und Repository-Speicherung brauchen zusätzliche Guards; ein History-Preflight allein schützt sie nicht. |
| `AtlasView.generation`, `sequence`, `closeEditor` | Bestehende Dateilebensdauer. Kampagnenbindung und widerrufbare async Repositoryoperationen fehlen; die bisherige vaultweite Detail-ID-Suche ist keine Campaign-Scopeprüfung. |
| `AtlasEditor.pendingKey`, `flush` | Keys werden übernommen; Stadtgesten/Gelände/Ortsdrag werden beendet, Dungeonvorschau wird abgebrochen. Ungültiger Abschluss oder fehlgeschlagene Draftsicherung muss den angeforderten Wechsel anhalten. Neue ausdrücklich benannte Prepare-/Suspend-/Navigate-Verträge verwenden diese Semantik. |
| `SpatialGraph.frame`, `AtlasRenderer.relativeCamera`, `AtlasKeyTarget` | Navigation richtet Kamera/Auswahl im vorhandenen Editor aus. Keine zusätzliche View, kein Bearbeitungsmodus und kein schreibender Dungeon-`Session`-Wrapper. |

In `src/main.ts`/`src/ui` existiert aktuell kein Campaign-Hostanschluss.
Hex implementiert weder dessen Lifecycle-Speicherung noch einen eigenen
Registryprovider, P02/P04-Publisher oder Medienowner. Die folgenden lokalen
Capture- und Navigationsteile sind unabhängig davon umsetzbar. Ein echter
Campaign-Hostlauf benötigt anschließend konkrete Providerobjekte mit belegter
Herkunft; ohne sie zeigt der Einstieg einen nicht verfügbaren Kampagnenatlas und
öffnet keine namensähnliche Ersatzwelt.

## I01a: Native Atlasquelle erfassen und gegen Veränderung prüfen

**Kleiner erster Codeabschluss:** eine immutable, lesende `AtlasNativeCaptureV1`
aus tatsächlichen World-/Location-/Placement-Daten samt exakten Nutzbytes und
prüfbarem lokalem Source-Stand. Kein Campaign-Publish und keine neue Dateiformatversion.

Vorgesehene eigene Dateien:

- neu `src/features/atlas/atlas-campaign-source.ts`: Capturetypen, native
  Identitäts-/Referenzprojektion, Digestvergleich und Current-Prüfung;
- `src/features/atlas/atlas-repository.ts`: schmaler Capture-/Lebensdauerzugang zur
  bestehenden Warteschlange, Baselines und Sources; keine zweite Speicherklasse;
- neu `tests/core/atlas-campaign-source.test.ts`, ein Include in
  [tests/core.test.ts](tests/core.test.ts).

Der Capture trennt **lokalen Quellstand** von **autoritativer Campaign-Bindung**.
Er enthält native World-ID/Formatversion, Repository-/History-Lebensdauer,
Worldplacements und Detailbindings, Atlas-eigene Ortsdokumente und Abschnitte,
Terrainreferenzen/-bytes sowie abhängige native Detailidentitäten/-Digests zur
Raumvalidierung. City-/Building- und Dungeon-/Floor-/Room-/Route-/Section-Payloads
bleiben bei ihren Fachownern; der Atlas erzeugt dafür keine Ersatzinventare.
Domain-`ownerId` ist der vom Registryprovider bestätigte Ownername, nicht die
World-UUID des Historyowners. Bestehende UUIDs bleiben identisch; Hexadressen und
Chunkkoordinaten bleiben Unterdaten des Worldpayloads und erhalten keine erfundenen UUIDs.

Ein ausdrücklich vollständiger Atlas-Capture lädt alle vorhandenen referenzierten
Chunks und alle vom autoritativen Atlasbestand benannten Ortsdokumente, auch gerade
unsichtbare/unverortete Records. Er erzeugt keine fehlenden Chunks und materialisiert
keine unendliche Hexfläche. Der Registry-/Ownerbestand muss diese Vollständigkeit
bestätigen: die räumliche Closure allein beweist keine vollständige Kampagne.
Fehlt dieser Bestand, bleibt ein Capture ausdrücklich `spatial-closure`, niemals
`confirmed complete` oder `emptyConfirmed`. Fehlende/unbekannte Formate und Quellen
liefern einen Fehler statt eines leeren Bestands.

Die Erfassung wartet auf bestehende Pointer-/Keyarbeit außerhalb des Repository;
danach erfasst sie synchron dessen native Historywerte. Datei-/Hashlesen passiert
ohne rekursives Warten innerhalb derselben Repositorywarteschlange. Vor Rückgabe
werden Lebensdauer, Kontext und der eingefrorene native Stand erneut verglichen.
Ein inzwischen geänderter Key/Placement/Chunk/Owner, Save/Discard/Reopen oder eine
externe Dateiänderung macht den Capture stale; kein automatischer Mischsnapshot.

Digest-Eingaben sind versionierte, deterministisch geordnete strukturelle Bytes
mit explizitem Schema und UTF-8. Gespeicherte Beforebytes und native Afterbytes
werden getrennt gehasht; Markdowninhalt und Abschnittsreihenfolge bleiben exakt.
Arrays werden nicht pauschal sortiert. Runtime-Mutabilität von Maps/Arrays wird
durch defensive Werte-Kopien und Freeze verhindert, nicht allein durch TypeScript.
Ein lokaler Source-Digest ist Evidenz zur Current-Prüfung. Er wird nicht als
Registry-, Campaign-, Owner- oder Snapshotrevision ausgegeben; solche Revisionen
werden erst aus einer passenden bestätigten Ownerprojektion übernommen.
Eine solche Bindung verlangt gleiche aktive Campaign-ID/Revision/Namespace/Token,
identische Registry- und Owner-/Schema-/Snapshot-/Policyrevisionen sowie passende
Record-/Payloaddigests. `verify` wird nach asynchronem Lesen erneut ausgeführt;
falsche, ausgelassene oder zusätzlich untergeschobene Records werden nicht
übernommen. Unveränderliche native Werte und autoritative Revisionen werden
gemeinsam erfasst, keine Revision aus einem anderen Lesezeitpunkt angeklebt.

Native Referenzen werden aus geprüften Payloads abgeleitet: World→Placement→Ort,
Ort→Abschnitt/Detail-/Keyziel, Detailplacement→native City/Dungeon-/Parent- und
Eingangskennungen. Ihre Klassifikation als campaign-local/shared/external kommt
vom bestätigten Schema-/Ownervertrag. Insbesondere ein externer Atlas-Key ist
nicht automatisch eine globale shared Definition. Unknown oder widersprüchliche
Klassifikation verhindert die bestätigte Ownershipprojektion, erhält aber Bytes.

**Abnahme I01a:** Realer bestehender Spatial-V2-Bestand wird immutable erfasst;
IDs/Markdown/Referenzen stimmen, ungeladene Chunks werden berücksichtigt,
Source-/Context-/Dateiänderung wird rejected, Quelldateien bleiben unverändert.
Typecheck, fokussierte Regressionen, Gesamttests und sauberer Build. Dies ist der
erste eigenständig nutzbare Codebaustein, noch kein UI- oder Complete-Importbeleg.

## I01b: Dünnen Context- und Navigationsadapter liefern

**Nächster kleiner Codeabschluss:** `AtlasCampaignNavigation` hält genau einen
aktiven Mount und navigiert darin nach stabilen IDs. Neu
`src/features/atlas/atlas-campaign-navigation.ts` samt
`tests/core/atlas-campaign-navigation.test.ts`; Source-/Repository-API nur bei
tatsächlichem Bedarf ergänzen. Campaign/Data-Dateien bleiben unverändert.

Der neue Hex-eigene Consumerport liefert keine Registrywahrheit. Er konsumiert:

1. `currentContext()` und die tatsächlich gelieferten `CampaignOwnerRegistryPort.read/verify`;
2. einen injizierten **bestätigten Atlasbestand**: gleiche Context-/Registry- und
   Ownerbindung, World-ID, benannte native Records/Dateiorte und belegte
   Verfügbarkeit. Ein Dateipfad dient nur als verifizierter Locator;
3. `openNative`, `prepareLeave`, `suspend`, `navigate` und `dispose` des bestehenden
   Atlas-Mounts. Diese Adapteroperationen sind neue Verträge, keine heute schon
   vorhandenen Methoden und keine P02/P04-Publishreceipts.

Der minimale Navigationsauftrag benennt erwarteten Context, World-ID, Orts-/Detail-/
Raum-/Abschnittsziel, lokale Mountgeneration und erwartete Owner-/Sourcebindung.
Alle Targets werden vor Kamera-/Keyänderung gegen aktuelle native Quellen geprüft.
Name, Dateinamenkonvention, zuletzt offener Pfad und fremde Tokens sind keine
Ersatzauflösung. Dateien müssen ihre tatsächlichen IDs und Typen bestätigen;
null Treffer, mehrere Treffer, retired/unavailable oder ein fremder Namespace
lassen den aktuellen Editor und seine Kamera unverändert und melden die Ursache.

Bei Navigation **innerhalb desselben Atlas** werden Repository, History und
derselbe Renderer als Besitzer der einen relativen Kamera erhalten. Kamerawerte
dürfen sich natürlich ändern; eine neue immutable Kameraprojektion ist kein zweiter
Kamerabesitzer. Räumliche Welt-/Haus-/Dungeontransforms
bestimmen nur den Kamerazielpunkt. Vor dem Wechsel des Keyziels werden offene Keys
validiert/übernommen; ungültige Eingabe bleibt sichtbar, das alte Ziel bleibt
aktiv. Die Detailanzeige bleibt durch Zoomgröße bestimmt. Der Auftrag schreibt
keine Szene, Party, LiveSession, Travel, Clock oder Weather/Music-Verbraucher an.

**Angeforderter Campaignwechsel:** zuerst weitere Eingaben kurz sperren und
`prepareLeave` auf dem noch gültigen Context ausführen. Es übernimmt gültige Keys
und die bestehenden Abschlussgesten, bricht Dungeonvorschau ab und wartet auf die
Draftsicherung. Fehler/ungültige Vorschau halten den alten Context und Editor
bearbeitbar; `CampaignLifecycle.activate` wurde dann noch nicht aufgerufen.
Erst danach darf der Campaign-Host aktivieren. Der Consumer montiert ausschließlich
den resultierenden, aktuell identischen, aktiven Context mit `applied=true`.

**Externer Contextwechsel oder verspäteter Mount:** sofort alte Aktionen suspendieren
und dessen Auswahl/Kamera-/Historybindung widerrufen. Alte Repository-/Lade-/Draft-
Callbacks besitzen nur ihre erfasste alte Lebensdauer; sie dürfen weder Sources
hydratisieren noch einen neuen Context rendern oder schreiben. Ein abgelöster Mount
wird entsorgt, aber seine bereits gesicherte alte Arbeit bleibt unter der alten
Identität wiederherstellbar. Noch ungesicherte Arbeit wird erhalten und sichtbar
als blockierter alter Entwurf ausgewiesen; sie wird nicht auf B übertragen oder
nach einem Contextwechsel ungeprüft publiziert. Contextprüfung ist vor jedem
await-Ausgang und vor jeder Mutation/Journalgrenze erforderlich. Die endgültige
dateidauerhafte atomare CAS-/Publishgrenze bleibt beim gelieferten Publisher.
Hat eine bestehende lokale Journalveröffentlichung bereits gewonnen, darf ein
Contextwechsel deren notwendigen Roll-forward unter der alten Zielidentität
nicht in Rollback umdeuten. Der alte Ausgang wird dort aufgelöst und nicht in den
neuen Mount eingeblendet. Für einen späteren Campaign-Publish bleiben ursprüngliche
CommandId/ReceiptId und `outcome_unknown` beim tatsächlichen Coordinator; der
Navigationsadapter erzeugt weder Ersatzauftrag noch angebliche Cancellation.

Scheitert das Laden nach einer bereits bestätigten Aktivierung, bleibt die neue
Aktivierung gültig, der Atlas zeigt ihren Fehler neutral. Kein automatischer
Rückwechsel, kein wieder schreibender A-Editor unter B. A→B→A erhält neue
Context-/Mounttokens und neu gelesene Sources; A1-History/Kamera/Callbacks werden
nicht als A2 übernommen. Normales Wiederöffnen bewahrt persistierte IDs und Bytes.

**Abnahme I01b:** bestehende echte Sources in kontrollierten Ports; Positivroute,
Same-Atlas-Repository-/History-/Rendereridentität und unten benannte
Wechsel-/Fehlerorakel. Kein erfundener
produktiver Registry-/Lifecycleprovider. Kernprüfung und Build getrennt vom Host.

## I01c: Den ersten sichtbaren Einstieg montieren und früh im Host prüfen

Eigene Änderungen in [AtlasView](src/ui/atlas-view.ts),
[AtlasEditor](src/features/atlas/atlas-editor.ts) und erforderlichen schmalen
[Renderer](src/features/atlas/atlas-renderer.ts)-Kameramethoden. `AtlasView` erhält
bestätigten Context und injizierte Provider vom tatsächlich besetzten
Campaign-Hostanschluss. Der bestehende FileView bleibt derselbe Canvas; keine
separate Campaign-/City-/Dungeon-Bearbeitungsview wird angelegt.

Die Native-ID-Auflösung nutzt den bestätigten Bestand einschließlich umbenannter
Ortsdateien. Vaultweite Suche darf alle Kandidaten zur Duplikatprüfung liefern,
entscheidet aber nie die Campaignzugehörigkeit. Context-/Mountguards decken
Terrain/Ort/City/Dungeon/Keys, Execute/Undo/Redo, Hydration, Save/Copy/Discard/Draft
und ausstehende Ladeoperationen ab. Neue, noch nicht autoritativ registrierte
Records bleiben nachvollziehbare lokale Entwürfe und behaupten keine bestätigte
Campaign-Revision. Ihre spätere gemeinsame Veröffentlichung ist ein separater
Publishanschluss; dieser Slice erzeugt keine künstlichen Receipts.

Früher sichtbarer Test mit **realem Context-/Bestandsprovider**, nicht allein
Testports: Kampagne öffnen → Ort auswählen → Key ändern → Hex bearbeiten → zum
Haus/Dungeon zoomen → Raum-Key ändern → herauszoomen → gemeinsames Undo/Redo →
lokales Save → echter frischer Prozess. Anschließend A→B→A und absichtlich
fehlender/doppelter/staler Zielbestand. Vor jeder GUI-Probe den einzigen lokalen
Slot neu koordinieren. Native Bedienung und physische Eingabe bleiben getrennt.

Fehlen reale Provider, sind I01a/I01b weiterhin eigene lieferbare Schritte. I01c
meldet dann genau die fehlenden konkreten Objekte/Revisionen an die zuständigen
Implementierer in #12/#11; kein allgemeiner neuer Ownership-/Ratifikationsumlauf.
Keine GUI mit einer als produktiv dargestellten Testregistry und keine Änderung
am Nutzervault. Full E2E-01 bleibt bis P02/P04/Complete-Import/Mehrbesitzer-Publish
und unabhängiger Gate-/Hostprüfung offen.

## Kleine Regressionen und gemeinsame Orakel

| Fall | Erwartetes Ergebnis / Zeitpunkt |
| --- | --- |
| Capture des bestehenden Spatial-V2 und unsichtbaren Chunks | I01a: tatsächliche IDs/Before-/Afterbytes/Digests, kein Schreiben oder Phantomhex. |
| Nur geladene Closure, unreferenzierter bestätigter Ort oder unbekannter Owner | I01a: kein Complete-/Empty-Claim; bestätigter Bestand vollständig oder sichtbar unavailable. |
| Key/Placement/Chunk ändert sich während Erfassung; Source A→B→A | I01a: captured Basis rejected, keine gemischte Projektion. |
| Externe Bytes ändern sich bei gleichem Pfad/ID | I01a/I01c: Konflikt, keine still übernommene Baseline. |
| Positivroute Ort→Haus→Dungeon→Raum/Abschnitt | I01b/I01c: IDgenaues Ziel, derselbe Canvas/History/Kamerabesitzer; Kamerawerte ändern sich über korrekte physische Transforms. |
| missing, duplicate, foreign, unknown schema, retired, stale Registry-/Owner-/Contextstand | I01b: vor Wirkung ablehnen; aktueller Key/Camera/History unverändert. |
| Offener gültiger Key / ungültiger Key beim Navigieren | I01b/I01c: einmal übernehmen / Zielwechsel stoppen, Text erhalten. |
| Aktive Stadt-/Terrain-/Ortsgeste und Dungeonvorschau beim Wechsel | I01b/I01c: bestehende gültige Abschlüsse einmal, Dungeonvorschau abbrechen; ungültiger Abschluss stoppt. |
| Draftsave scheitert vor angefordertem Switch | I01b/I01c: Lifecycle nicht aktivieren; alter Entwurf/Context erhalten. |
| Alte Lade-/Key-/Save-/Copy-/Undoantwort nach externem Switch | I01b/I01c: keine Wirkung im neuen Mount; alte Arbeit unter alter Identität erhalten. |
| Switch nach gewonnenem alten Journalpublish / Antwortverlust | I01b/I01c: alter Ausgang bleibt vorwärts auflösbar, kein Rollback/Ersetzung und keine Wirkung in B. |
| `activate` applied=false, target trashed oder Mountfehler nach B | I01b: kein A-Rückfall und kein B-Ersatz; sichtbarer neutraler Fehler. |
| A→B→A mit gleicher persistierter Revision | I01b/I01c: neue Aktivierung, keine A1-/B-Selection/Camera/History/Writes. |
| Umbenannter Ort/Detaildatei, frischer Prozess | I01c: nach bestätigtem IDbestand auflösen; IDs/Markdown bytegleich, kein Remap. |
| Abwesende Registry/P02/P04/Medien | I01b/I01c: Consumerfehler und offene Gates; keine Complete-/Publishbehauptung. |
| Session-/Party-/Travel-/Clock-/Scene-Spy | I01b/I01c: null Aufrufe; rein editorische Route. |

Neue Tests benutzen tatsächliche native Fixtures/Sources und asynchron kontrollierte
Portgrenzen; keine zweite räumliche Toy-Welt. Keine neuen Großkarten-, Original-
paritäts- oder Installationsclaims aus einem kleinen Navigationstest.

## Getrennte Lieferfolge und kurze Gates

1. **Dieser P01 → unabhängiger R01** durch bestehenden Stadtchat auf exaktem
   PR-13-SHA. Nur konkrete neue Pflichtbefunde führen zu N01. Bereits geprüfte
   Campaign- und Raumpläne werden nicht erneut generell aufgerollt.
2. **I01a Capture** → eigene Codechecks → unabhängig R01a/N01a → eigenes separates
   Aufräumen. Ergebnis direkt nutzbare Sourceprojektion, ohne auf fremde Publisher zu warten.
3. **I01b Context/Navigation** → eigene Codechecks → unabhängig R01b/N01b → eigenes
   Aufräumen. Positive Route und Wechselguards vor größerer Import-/Medienarbeit prüfen.
4. **I01c Host** erst mit tatsächlich verfügbaren Providerinstanzen → früh native
   Probe und frischer Prozess → unabhängiger Host-/Integrationsreview → Aufräumen.
   Kein Vorziehen von E2E-02–04. P02/P04/atomarer Publisher bleiben benannte fremde Eingänge.

Vor jedem Paket und vor Veröffentlichung aktuellen Shared/Ownremote prüfen und
freigegebenen Fortschritt normal integrieren; fremde lokale Änderungen erhalten.
Jeder Abschluss bleibt im einzigen PR-13-Kandidaten mit Source-/Fixture-/SHA-Liste
und einem kurzen Gateprotokoll zu Zeile13. Tests, Build, native Probe, unabhängiger
Review, physische Eingabe, Originalparität, Großwelt und Installation werden jeweils
als eigener Nachweis geführt. Eine Planprüfung ist kein Produkt-PASS.

## Einmalige Consumer-Matrix für den restlichen RUNTIME-MANIFEST-I02-Pfad

Die konkrete [Prozessentscheidung in #12/6097273698](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6097273698)
setzt für diesen Pfad die bisherigen einzelnen Producer-/Consumer-Runden außer
Kraft. Hex besitzt vorübergehend die Integration; Campaign/Data liefert genau
einen Patch innerhalb seiner Fachgrenze. Die bereits geschlossenen I02-01/-02-
Belege und ihre Exact-SHAs bleiben gültig. Es beginnt keine weitere allgemeine
Plan- oder Reviewrunde.

**Eingefrorener ausführbarer Vertrag:**
`RUNTIME-MANIFEST-I02-CONSUMER-MATRIX-V1` in
[tests/campaign-manifest-consumer-matrix.contract.json](tests/campaign-manifest-consumer-matrix.contract.json),
mit dem [Consumer](tests/campaign-manifest-consumer-matrix.entry.ts) und dem
[Runner](tools/verify-campaign-manifest-consumer-matrix.mjs). Der Vertrag pinnt
Test, Runner und alle vorhandenen Spatial-V2-Dateien mit SHA256. Der nächste
Producerpatch verändert diese Bytes nicht. Alle Fälle müssen in einem vollständigen
Lauf auf derselben sauberen Candidate-SHA bestehen; kein `--test-name-pattern`,
kein Skip, keine private Flagänderung oder Ersatzimplementierung.

| Fall | Tatsächlich geprüfte Wirkung |
| --- | --- |
| M01-first / M01-manifest | Echtes Repository-Save und gewonnenes Prepared-Journal; erster nativer CAS bzw. Manifest-CAS scheitert; alle Beforebytes und Draft bleiben; geprüfte Rückgabe, danach Retry in derselben Lebensdauer. |
| M02 | Gewonnenes Prepared-Journal mit verlorener Antwort; tatsächliches Rollback, Rückgabe und Retry. |
| M03 | Tatsächlicher Commit, genaues Receipt-Replay, neue bestätigte Registry/Inventory bei gleichem Context. |
| M04 | Antwortverlust nach gewonnenem Committed-CAS; Roll-forward, keine Rollback-Rückgabe eines gewonnenen Saves. |
| M05 | Eigenes synchrones Pending-Vaultevent, gewonnenes Journal, verzögert aufgelöste Bytes; vorher kein bestätigtes Receipt. |
| M06 | Fremdes unbekanntes Modify widerruft alte Mount-/Historywirkung synchron vor dem Lesen seiner Bytes. |
| M07 | Fremde/widersprüchliche Eventauflösung während Vorbereitung; keine Commit-/Release-Autorität oder automatische Neuaktivierung. |
| M08 | Alte verspätete Auflösung nach neuer Aktivierung: neuer Context und tatsächlicher neuer Save bleiben gültig; alte History bleibt widerrufen. |
| M09 | Unversiegelte, fremde, doppelte oder bytefalsche Rückgabe; noch vorhandenes Journal; legitime ursprüngliche Rückgabe und Retry bleiben möglich. |
| M10 | Source schließt nach gewonnenem Prepared; Journal/Draft bleiben, alte Rückgabe und Retry abgelehnt. |
| M11 | Provider schließt nach tatsächlichem Rollback; alte Rückgabe/History abgelehnt. |
| M12 | Closure während Commit-Acknowledgment auf Bytes wartet; Antwort abgelehnt, gewonnene Afterbytes erhalten. |
| M13 | Manifestevent bereits beobachtet, Committed-CAS scheitert, echtes Rollback; alte Source wird nicht durch Release reaktiviert. |
| M14 | Rückgabe aus A1 nach neuer Aktivierung A2 abgelehnt, ohne A2 zu widerrufen. |
| M15 | Prepared-CAS scheitert vor Mutation; keine erfundene Vorbereitung, derselbe Mount kann erneut speichern. |
| M16 | Cleanup-CAS nach gewonnenem Commit scheitert; tatsächliche Recovery rollt vorwärts, Receipt genau einmal. |
| M17 | Rückgabe beendet wartende Bestätigung; verspäteter Commit und wiederverwendete Transaktion abgelehnt, erhaltene History bleibt gültig. |

Die bestehende native Fixture bleibt maßgeblich: sieben Dateien,
City-IDs **100–106**, Haus105 mit seinem vorhandenen Vorher-/Nachher-Poseorakel,
native `CitySource`-/`DungeonAtlasSource`-Snapshots und vorhandener
`AtlasRoomKeyDraft`/Abschnitt34 samt exaktem Markdown. Rollback und Retry behalten
die tatsächliche `AtlasHistory`, Repository-, Mount- und Rendereridentität.
Der Renderer-/Kamerabesitz wird an einem ausdrücklich kontrollierten Port geprüft;
dies ist keine grafische oder physische Eingabeabnahme. Keine neue City-Fixture,
History oder City-Persistenz wird angelegt. Die Speicherfehler passieren über den
tatsächlichen `AtlasRepository.save` → `FileTransaction`; der Runner ersetzt den
Produktjournalcode nicht.

**Öffentlicher Producervertrag der tatsächlichen Lieferung:** Der während dieses
Matrixlaufs direkt gelesene PR35-Kandidat
`8a25c92c89962a4b1fbf4b15a209205e5704bbc3` liefert diese API bereits. Seine
bisherigen Ownerchecks/-reviews bleiben Vorbelege; er ist vor dem vollständigen
Matrixlauf und dem hier vereinbarten Chronikreview nicht in PR13 integriert.

- Der Participant konsumiert als optionalen vierten Constructorparameter
  `CampaignRuntimeSaveRollbackAuthority.validateRollbackReceipt(receipt)`.
  Hex stellt ein versiegeltes Receipt erst nach tatsächlichem validiertem
  Rollback aus: `transactionId`, `outcome: "rolled_back"`,
  `journalState: "absent"`, exakt geordnete
  `writes: [{ path, before, after, current }]`, jedes `current === before`.
- `CampaignRuntimeManifestSaveParticipant.createRollbackAcknowledgment({ prepared, receipt })`
  validiert dieses Receipt und den ursprünglich ausgestellten Prepared-Proof
  und versiegelt einen eigenen Rollback-Proof.
- `CampaignRuntimeNavigationProvider.cancelSaveAcknowledgment(proof)`
  konsumiert nur die identische aktuelle, noch nicht eventbeobachtete Vorbereitung.
  Gleicher Context/Sourceepoch bleiben erhalten; foreign, stale, committed,
  closed, bytefalsche und doppelte Rückgaben werden abgelehnt. Klone/fremde
  Rückgaben dürfen eine legitime Vorbereitung oder neue Aktivierung nicht
  zerstören; authentische eventbeobachtete Rückgabe darf nicht reaktivieren.
  Abgebrochene Transaktionen/Leases werden konsumiert; späte Callbacks verlieren
  ohne die erhaltene History zu widerrufen; Retry hat eine neue Transaktions-ID.

Die Testautorität prüft die tatsächlich zurückgelesenen gewonnenen Journalbytes,
Journalabsenz, ganze geordnete Writeclosure und aktuelle wiederhergestellte Bytes,
bevor sie ein Receipt in ihrem privaten WeakSet versiegelt. Sie liefert keinen
Produkt-Recoveryadapter und keinen erfundenen Commit. Die laufenden produktiven
Campaignquellen bleiben in diesem Freeze-Schritt unverändert. Keine neue
Lifecycle-Aktivierung oder private Source-Flagänderung als Ersatz.

Reproduzierbarer Lauf aus der Candidate-Wurzel:

```sh
node tools/verify-campaign-manifest-consumer-matrix.mjs \
  --output /home/aaron/.cache/dungeon-native-qa/campaign-consumer-matrix-report.json
```

Der Runner prüft vorab die eingefrorenen Datei-/Fixturebytes und protokolliert
Candidate-SHA, Quellhashes, alle 18 Fälle, Exitcode, unveränderte Checkoutbindung
und `reviewReady`. Ein schmutziger Diagnoselauf mit `--allow-dirty` wird niemals
`REVIEW_READY`. Ein fehlender Release-Vertrag ist ROT, auch in Negativfällen;
Methodenabwesenheit zählt nicht als korrekter fachlicher Reject. Diese offene
Consumer-Matrix ist bis zur Lieferung ausdrücklich ein separater Vertragslauf,
kein Include in der grünen Basissuite.

Campaign/Data übergibt **einmal**: Exact-SHA, unveränderte Matrix-/Fixturehashes,
vollständiges grünes Report und seine passende Basisprüfung. Erst dann
`REVIEW_READY` und **ein** unabhängiger Chronikreview auf derselben SHA. Keine
Einzelhandoffs pro Fall und keine Vollreviews geschlossener Belege. Danach bindet
Hex die beobachteten Prepared-/Committed-/Released-Grenzen im Produkt an und
aktualisiert Registry/Inventory in demselben Navigator/Mount/History. Dieser
Testlauf aktiviert den noch fehlenden `AtlasView`-Savehook nicht. Der echte
Host-Save/Fresh/Recovery-Lauf mit neu koordiniertem GUI-Slot sowie Stadt- und
Gesamtintegrationsreview bleiben separate offene Nachweise. Diese konkrete
Prozessänderung ersetzt keine vollständige Produktparität oder E2E-01-Freigabe.

**Gemeinsame Reviewbasis und eingegangener unabhängiger Review:** Campaign/Data
hat PR13/`9e6651350eb2d33dc4f5e950486c5e8aa693cda6` regulär mit seinem
unveränderten PR35-Input/`8a25c92c89962a4b1fbf4b15a209205e5704bbc3`
komponiert und in
[#12/6097463689](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6097463689)
auf **`ce2f9032dc9f72f994a307b5aac26e1ad8910065`** einen sauberen
18/18-Lauf (`reviewReady:true`) sowie check/629-Tests/Build gemeldet.
Hex hat dessen Herkunft, die unveränderten 19 Freeze-Dateien und den exakten
Vier-Dateien-Delta der Campaign-Fachgrenze direkt geprüft. Der externe Report
`c9c5b34eee733e9807259cbed30e5e67b293ec8cb47ae9fe76cecc999a00b8dc`
ist ein Owner-Lauf, kein lokal wiederholter Hex-Test.

**Dieser komponierte integrierte SHA war die einzige Chronik-Reviewbasis.**
Der tatsächliche unabhängige Review in
[#12/6097491451](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6097491451)
und [#35/6097491452](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/35#issuecomment-6097491452)
ist **PASS**, ohne Pflichtbefunde: unveränderter Freeze, unabhängiger 18/18-Lauf
mit demselben Reporthash, check/629-Tests/Build und saubere exakte Reviewbasis.
Diese direkte Review-Lektüre ersetzt keinen lokal ausgeführten Hex-Test.
Chroniks zuvor genannter integrierter Eingang ist damit tatsächlich erfüllt;
die widersprüchliche Wartefolge ist erledigt. Kein zusätzlicher Standalone-Review
von `8a25c92`, zweiter Producer-Matrixlauf oder weiterer Producer-Handoff.

Als nächster begrenzter Schritt konsumiert Hex den qualifizierten Exact-SHA
regulär im einzigen PR13-Kandidaten und prüft die Zusammensetzung samt Gates
des neuen Integrationsstands. Anschließend folgt der getrennte produktive
Anschluss echter FileTransaction-/Host-Receipts und des Registry-/Inventory-
Refreshs im selben Navigator/Mount/History. Keine Shared-/Installations- oder
Gesamtpromotion aus dem Komponentenreview; der tatsächliche
Host-Save/Fresh/Recovery/A-B-A-Nachweis bleibt offen.

**Qualifizierte Übernahme im einzigen PR13-Kandidaten:** Der unabhängig geprüfte
Campaign-Stand `ce2f9032dc9f72f994a307b5aac26e1ad8910065` ist regulär als
Merge `8f0d39a9ada55e351e306317736892c6b89a68ab` übernommen. Produktquellen
und Tests stimmen vollständig mit der geprüften Reviewbasis überein; gegenüber
dieser Basis unterscheiden sich nur die vorhandenen Hex-Metadaten. Alle 19
Freeze-Dateien und bestehende Übergaben bleiben unverändert. Der saubere lokale
Integrationslauf besteht die unveränderte Matrix mit **18/18**, Typprüfung,
**629/629 Basistests** und Build mit exakter Quellkennung und `dirty:false`.
Der neue Report bindet ausdrücklich den Integrations-SHA; er benennt keine
neue Producerübergabe oder Komponentenreviewrunde.

**Aktueller Produktstand: `HEX-E2E01-HOST-SAVE-I02`.** Der tatsächliche Save-Button
ist auf Quellstand `86bbbbfac44233509f084ac836e6dafa07b11a16` mit den
zurückgelesenen FileTransaction-Journalen, dem zuständigen Participant und
Provider verbunden. Registry und Inventory werden in derselben Navigatorqueue
erneuert; Mount, Sources, Repository, History, Renderer und Kamera bleiben.
Die DOM-Probe belegt außerdem die Wiederholung nach einem vollständig
zurückgenommenen ersten nativen Schreibfehler und eine frische View-/Service-
Lebensdauer mit gespeicherten Orts-/Raumnamen. Sie ist kein neuer Obsidianprozess.
Nach regulärer Übernahme von Shared `a6b132d` bestehen Typprüfung, **637/637 Tests**,
sauberer Build und die unveränderte **18/18**-Matrix. Direkter vollständiger Beleg:
[implementation.json](/home/aaron/.cache/dungeon-native-qa/hex-03/runtime-manifest-host-save-i02-20261010/implementation.json).

PR13 bleibt ACTIVE; die qualifizierten Komponenten sind INPUT-Vorbelege. Der
nächste begrenzte Hex-Lauf koordiniert den einzigen GUI-Slot neu und prüft den
tatsächlichen Obsidian Save/Fresh/Recovery/A-B-A-Ablauf. Danach folgen bestehender
integrierter Hostreview und getrenntes Aufräumen. Chronik besitzt BASE-CI-01;
kein zusätzlicher Workflow oder Komponentenreview wird hier gestartet. Keine
Shared-/Installations-/Native-/Gesamtfreigabe aus den automatisierten Prüfungen.

**#40 / SHARED-LOCATION-KEY-R01 (10.10.2026):** Nach dem erhaltenen H01-FAIL und
D01-Reparatureingang ist der enge Save-Fix im bestehenden PR62 umgesetzt.
Der unabhängig qualifizierte Campaign/Data-Producer PR65 (`32dc3e8f`) und Shared
`113e37f` wurden regulär konsumiert. Hex autorisiert die tatsächliche neue
Location-/Section-/Worldmarker-Closure im nativen Adapter samt Prepare/Recovery;
Navigation akzeptiert den geschlossenen lokalen Entwurf und hydriert seinen
Source vor der Keynavigation. Save/Ack/Rollback bleiben beim bestehenden Journal.
551 automatische Kern-/DOM-/Copy-/Vault-Tests, Typprüfung und Build PASS;
[konkreter R01-Beleg und Grenzen](docs/reference/atlas-shared-location-r01/README.md).
Nächster Eingang ist der unabhängige Review des veröffentlichten Reparaturheads,
danach die gesondert neu koordinierte Obsidian-Save-/frischer-Prozess-Probe.
H01 wird nicht umgeschrieben; #40 und das gemeinsame E2E-01-Gate bleiben offen.

**#40 / SHARED-LOCATION-SAVE-N02 (10.10.2026):** Der unabhängige
[R02-Befund auf PR62/3c6b87c](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/62#pullrequestreview-5480579984)
ist im bestehenden Paket gezielt nachgebessert. Vollständig zurückgenommene,
nie gespeicherte Locations behalten ihren Source für Redo, erscheinen aber nicht
als Null/Null-Datei im Capture oder Null/Null-Guard im Save. Der tatsächliche
Navigation-Save ist ohne Writes und erhält Mount/History/Renderer/Context;
anschließendes Redo und Save funktionieren. Gespeicherte Ortslöschungen bleiben
erfasst und ohne zusätzliche Campaign-Freigabe abgelehnt. Produktcommit
`bc98b720d742693025563df7f93282be9936eb62`, konsumierter Shared `11b4020`;
560 Atlas-Kern-/DOM-/Copy-/Vault-Tests, Typ/Build und 27 Repositorytests PASS.
[Quellgebundener N02-Beleg](docs/reference/atlas-shared-location-r01/noop-repair.json).
Jetzt setzt der bestehende unabhängige Reviewer R02 auf dem veröffentlichten
Reparaturhead fort; die separat neu koordinierte echte Save-/frischer-Prozess-
Probe folgt erst auf qualifiziertem Stand. H01/D01/R01 bleiben bytegleich und
#40 sowie E2E-01 offen; kein GUI-Lauf oder Selbstmerge in dieser Nachbesserung.

**R02 und Stewardintegration konsumiert (10.10.2026):** Der tatsächliche
[Chronik-R02](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/62#pullrequestreview-5480666699)
besteht auf Exact-Head `92ad4a06883fc48349598bb79d98e4e38035dbe2` ohne weiteren
Befund. Seine Ausführung (8 fokussierte Fälle, 818/817 PASS mit einem vorhandenen
PDF-Skip) bleibt ein unabhängiger Reviewerbeleg. Exact-Head-CI38082382444 SUCCESS.
Der [separate Steward](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/62#issuecomment-6101774442)
hat diesen Kandidaten unverändert als zweiten Elterncommit in Shared
`4515088772b759cda2e19d249367699c9868c72c` integriert; Treevergleich ist bytegleich,
Shared-Struktur-CI38083220356 SUCCESS. Hex konsumiert diese tatsächlichen Eingänge
schreibfrei am Produkt und führt als nächsten getrennten Lauf H02 auf genau
diesem qualifizierten Shared-Source: GUI-Slot neu ausdrücklich koordinieren,
danach echter Orts-/Key-/Move-/UndoRedo-/Save-/frischer-Obsidian-Prozess-Nachweis.
Kein GUI-Slot oder Hostlauf in der Reviewübernahme; #40 und E2E-01 bleiben offen,
H01/D01/R01/N02 und der historische currentRun bleiben unverändert.

**H02 echter Ort-Save/Frischstart (10.10.2026):** Auf qualifiziertem Shared
`4515088772b759cda2e19d249367699c9868c72c` bestehen der tatsächliche POI-/Key-/Move-/gemeinsame
UndoRedo-/Save-Weg und ein sequenzieller frischer Obsidianprozess. Auch
create→Undo→No-op-Save→Redo erhält aktive Mount/History/Renderer und alle acht
gespeicherten Eingangsdateien. Neun gespeicherte Dateien sowie Orts-/Marker-/
Abschnittskennungen, Texte und Position sind im frischen Prozess bytegleich.
Build `76bb453acca65f260e2276a385da66c5039a643fa10681b9b7a20fc5209c1322`; zwei normale Prozessenden, alle eigenen PIDs
weg, Slot6101912782 ausdrücklich zurückgegeben. Synthetische native Eingabe;
H01/D01/R01/N02/R02, H01-Draft und historischer currentRun unverändert.
[Quellgebundene H02-Rohbelege](docs/reference/atlas-shared-location-h02/README.md)
gehen an das bestehende #40-/E2E01-Gate. Host-/Gesamtqualifikation und eigene
Bereinigung bleiben getrennt; keine neue allgemeine Reviewrunde, weitere GUI,
Details/CITY/P02/P04/Großkarten-/Installations-/physische oder Gesamtfreigabe.
