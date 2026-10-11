# Gemeinsamer Atlas: Laufzeit, Speicherung und räumliche Verträge

Abschnitte: [Arbeitsstand #80](#arbeitsstand-80) · [Nutzerziel, Basis und unveränderte Abnahmelinie](#nutzerziel-basis-und-unveränderte-abnahmelinie) · [Einmalige Consumer-Matrix für den restlichen RUNTIME-MANIFEST-I02-Pfad](#einmalige-consumer-matrix-für-den-restlichen-runtime-manifest-i02-pfad) · [Gemeinsame räumliche Darstellung](#gemeinsame-räumliche-darstellung) · [Dungeon-Geometrie und Vorschau](#dungeon-geometrie-und-vorschau)

## Arbeitsstand #80

**Zielpräzisierung vom 11.10.2026:** Die [konkreten Nutzerabläufe](ROADMAP-HEX-ATLAS.md#konkrete-nutzerabläufe) und das [gemeinsam bearbeitete Gebäudeobjekt](ROADMAP-CITIES.md#gebäude-und-innenräume-als-ein-objekt) ergänzen das Ziel. Die hier beschriebenen getrennten City-/Dungeonquellen, starren Hausbindungen und festen Fixtures belegen den bisherigen Anschluss. Sie belegen noch keine gemeinsame Wandänderung im gewählten Umfang oder horizontale Gesamtskalierung aller Gebäudegrundrisse samt Innenräumen bei unveränderten Höhen. Der [Werkzeugentwurf](ROADMAP-HEX-ATLAS.md#werkzeuge-und-bediengefühl) konkretisiert diese Zielbedienung. Das konkrete Gebäudeformat und die Übernahme vorhandener Daten bleiben vor Umsetzung zu entscheiden; bestehende Orakel und Nachweisgrenzen werden dadurch nicht umgedeutet.

Campaign→Atlas, native Orts-/Stadt-/Dungeonquellen, gemeinsame History, Raum-Key-Editor, Platzierung und Save/Copy/Discard sind im gemeinsamen Branch integriert. Diese technischen Anschlüsse ersetzen keine vollständige E2E-01-, Original-, physische oder Großweltabnahme.

Der letzte integrierte Save-Stand ist [PR167](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/167) auf Shared `6a90f3ee2f50f0be45f0e256784576f13722c319`. [J02](docs/reference/atlas-detail-binding-d01/room-save-retained-status-j02/README.md) belegt erhaltenen Save-Status nach Veröffentlichung; [J03](docs/reference/atlas-detail-binding-d01/room-save-prepared-journal-j03/README.md) den wirklichen Prepared-Journal-/Fresh-Recoveryfall. [Copy C03](docs/reference/atlas-detail-binding-d01/room-draft-copy-c03/README.md), [Prepared Copy](docs/reference/atlas-detail-binding-d01/room-copy-journal-p01/README.md), [Committed Copy](docs/reference/atlas-detail-binding-d01/room-copy-committed-journal-c01/README.md) und [Committed Save](docs/reference/atlas-detail-binding-d01/room-save-committed-journal-j01/README.md) behalten ihre jeweilige SHA, Fixtures und Grenzen.

Weitere offene Fähigkeiten und Kandidaten stehen in der [Atlasübersicht](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick). [Ergebnisgleichwertigkeit und Lieferprioritäten](ROADMAP-HEX-ATLAS.md#wie-kommen-wir-zum-ziel) steuern neue Lieferungen. Bestehende Quellen-, Speicher- und Identitätsverträge bleiben technische Voraussetzungen; E2E-01-Teilbelege ersetzen keinen vollständigen Endablauf. Vollständiger Complete-Import, breite Recovery/OS-Abnahme und durchgehende Originalparität bleiben offen. Die folgenden Fachverträge und Gegenfälle bestimmen den Anschluss; historische Prozessentscheidungen vergeben keine Arbeit.

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
[räumliche Integrationsplan](ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md#gemeinsame-räumliche-darstellung), die
[Campaign-Kontextgrenze](ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md#campaign-kontext) und der
[Ownership-Vertrag](ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md#ownership-und-gemeinsame-commands) bleiben maßgeblich.
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
Schnittstellen für Publish, Registry und Medien müssen tatsächlich verfügbar sein.
Keine GUI mit einer als produktiv dargestellten Testregistry und keine Änderung
am Nutzervault. Full E2E-01 bleibt bis P02/P04/Complete-Import/Mehrbesitzer-Publish
und unabhängiger Gate-/Hostprüfung offen.

## Kleine Regressionen und gemeinsame Orakel

| Fall | Erwartetes Ergebnis / Zeitpunkt |
| --- | --- |
| Capture des bestehenden Spatial-V2 und unsichtbaren Chunks | I01a: tatsächliche IDs/Before-/Afterbytes/Digests, kein Schreiben oder Phantomhex. |
| Nur geladene Closure, unreferenzierter bestätigter Ort oder unbekannter Owner | I01a: kein vollständiger oder leerer Bestand behauptet; bestätigter Bestand vollständig oder sichtbar unavailable. |
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

## Einmalige Consumer-Matrix für den restlichen RUNTIME-MANIFEST-I02-Pfad

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
damaligen Ownerchecks/-reviews waren Vorbelege vor vollständigem Matrixlauf und unabhängigem Review. Der aktuelle Anschluss und seine begrenzten Belege stehen in [Arbeitsstand #80](#arbeitsstand-80).

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

## Gemeinsame räumliche Darstellung

## Gemeinsame räumliche Darstellung — Nutzerablauf und historische Ausgangsbasis

Der gemeinsame sichtbare Nutzerablauf ist: Vorhandenen nativen Stadtplan am Ort und
Dungeon am Haus verankern → allein hineinzoomen → Straße/Haus verschieben und
Raum-Key bearbeiten → herauszoomen → gemeinsame Undo/Redo-Folge → Save → neuer
Obsidianprozess. Ein Editor, eine Kamera, ein Werkzeugzug und eine History.
Bestehende Karten werden dafür nicht neu erzeugt. Der erste Durchlauf benutzt
den gelieferten Stadtplan, nicht einen vorgezogenen Stadtgenerator.

Der damalige Quellenanschluss prüfte AtlasRepository, CitySource und DungeonAtlasSource in derselben History und sieben bytegenau wiederhergestellte native Snapshots. Stadt war in diesem Ausgangslauf ein ausdrücklicher No-op. Die folgenden Anschlussanforderungen und Schnittkennungen dokumentieren diese historische Basis; der aktuelle Integrationsstand und verbleibende Host-/Recovery-/Importlücken stehen in [Arbeitsstand #80](#arbeitsstand-80).

## Gemeinsame räumliche Darstellung — Gepinnte Eingänge und Anschlussgrenzen

| Vorhanden                                        | Folgerung für den Anschluss                                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TerrainSource`, LocationSource, AtlasHistory    | Worldowner bleibt derselbe; Welt-/Orts-/Geländeänderung nutzt dieselbe atomare Before/After-Grenze.                                                                                               |
| `CitySource`, `cityDocumentChange`, CityGesture  | City-v1-Metergeometrie und fachliche Kennungen bleiben erhalten. Apply führt bereits genau einen Historycommit aus.                                                                               |
| `cityScene`, `hitCity`, CityRenderer             | Der Atlas liefert präzise Projektions-/Inversefunktionen und Bildschirmtoleranz, montiert einmal und zeichnet vor seinem Render.                                                                  |
| DungeonAtlasSource, `dungeonDocumentChange`      | Native V4-Bytes sind die Dungeon-/Key-Wahrheit. Keine Session-History und keine dauerhafte `Session.revision` daneben.                                                                            |
| AtlasRepository, Draft v1/v2, FileTransaction v1 | Die Ausgangsbasis führte nur World/Terrain/Locations in Snapshot und Datei-/Entwurfsstrecke. Der Anschluss verlangt ebenso echte City-/Dungeonbytes.                                                                |
| `MapRenderer` und DungeonEditor                  | Besitzen im Ausgangsstand Application/Kamera beziehungsweise schreibende Session. Sie sind nicht als zweite Editorinstanz einhängbar; reine Zeichnung und Fachbefehle müssen ausdrücklich abgetrennt werden. |
| CampaignLifecyclePort                            | Unterstützt im Ausgangsstand `create`/`rename`, nicht einen bestätigten Mehrowner-Atlas-Publish. Der angenommene Kern liefert noch keinen Vault-/Campaign- oder Complete-Importbeleg.                        |

Die neue vorgeschlagene Format-, Transform- und Speichergrenze steht ausschließlich
in [ARCHITECTURE.md](ARCHITECTURE.md#räumliche-atlasverträge).
Die damaligen Schnittstellenvorschläge sind vom heutigen Quellstand zu unterscheiden; vorhandene APIs und Quellenanschlüsse werden weiterverwendet.

## Gemeinsame räumliche Darstellung — Technische Anschlussanforderungen

| Schnitt                                     | Konkretes Ergebnis                                                                                                                                                                                                         | Direkt erforderlicher Nachweis                                                                                                                                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I01a – räumliche Speicherbasis**          | V2-Worldbindings, relative Transformkette, prospektive Graphprüfung und wirkliche City-/Dungeon-Owneraufnahme in Snapshot/Draft/Save/Copy/Discard/Recovery. Ein unveränderter Altatlas bleibt unverändert.                 | Native codecs und echte Repositorydateien: Ankoppeln, Ort/Haus bewegen, Undo/Redo, unterbrochenes Save, externer Konflikt, Copy-Closure und frisches Repository; Präzisionsgegenprobe unten. Noch kein sichtbarer Atlas-PASS.           |
| **I01b – unmittelbar sichtbarer Anschluss** | Citycontainer und erste native Dungeon-Raumzeichnung im vorhandenen Frame, Zoomdarstellung, Hitrouter, bestehende Stadtgesten und Source-basierter Raum-Key. Verankern nutzt denselben Atlas; keine Betreten-/Modusaktion. | Vor der nächsten Fachgruppe echte isolierte Obsidianprobe: vollständige sichtbare Folge aus dem ersten Absatz einschließlich Hausbewegung, Escape, gemeinsamen Undo/Redo, Save und einem neuen Prozess. Aktive Hosts schützen. |
| **I01c – verbleibende Pflichtintegration**  | Dungeon-Geometrieaktionen über reine fachliche Changes, bestätigter Campaign/Vault-Context, persistierte Command-/Receiptgrenze und echte P02/P04-Importvariante; Katalogreferenzen aus tatsächlichen Ownerlieferungen.    | Exakte Reviewinputs und festes erweitertes Fixture; erst danach unabhängiger integrierter Code- und Hostreview anhand der [E2E-Kriterien](ROADMAP-E2E-GATES-CANDIDATE.md). Fehlende Ownerlieferung bleibt offen, nicht durch Platzhalter verdeckt.                                        |

Die historischen Kennungen I01a/I01b/I01c ordnen Speicherbasis, sichtbaren Anschluss und vollständige E2E-Eingänge zu. Sie erzeugen keine erneuten Phasenläufe. Ein vorhandener räumlicher Anschluss ersetzt keinen vollständigen E2E-01- oder E2E-02–04-Nachweis.

## Gemeinsame räumliche Darstellung — Sichtbarer Frame und Eingabe

- Source einmal je Dokument und History-Lebensdauer registrieren. Grafikcontainer
  dürfen unsichtbar werden oder freigegeben werden; Dirtyowner und Historywerte
  dürfen durch Zoom/Entladen nicht verschwinden. Geladene Childsources nach
  Discard gemeinsam an die neue History binden, alte Responses per Generation
  zurückweisen. Frühere Kamera/gewähltes Werkzeug bleiben erhalten.
- City- und Dungeonzeichnung erfolgen im `detailLayer` vor `Application.render()`.
  Ein nachgeschalteter `changed()`-Callback ist kein Zeichenhook. Eine
  Application, ein Resizepfad und ein Frame-Scheduler reichen aus.
- Gemeinsame sichtbare Reihenfolge: Landschaft → Stadtaussenflächen/Häuser →
  eingeblendete Dungeonräume → Auswahl/Griffe/Ortsmarkierung. Der tatsächliche
  Trefferrouter geht dieselbe Folge rückwärts. Innenhöfe bleiben transparent.
  Nur gezeichnete Griffe treffen; tolerierte Kanten werden in Bildschirmnähe
  geprüft. Der erste äußere Citytransform ist starr, sodass Citys Kreis-Toleranz
  exakt in Meter umgerechnet werden kann. Kein nicht gleichförmiger
  Elterntransform, der diese Annahme still verletzt.
- Zoom blendet Dächer aus und Räume ein, mit Hysterese nach projizierter Größe.
  Es wechselt weder Dokumentwahrheit, Werkzeug noch Kamera und verschiebt keine
  Geometrie. Zeichnung und Hit verwenden dieselbe Darstellung/Transformkette.
  Ein begonnener Zug behält Ziel und Beforewerte über einen Detailwechsel.
- Pointerup übernimmt eine gültige Vorschau einmal; Escape/pointercancel/blur
  verwerfen den laufenden unbestätigten Zug bei allen neuen räumlichen Gesten.
  Die Terrain-Abschlussregel muss dieselbe Cancel-/Apply-Grenze einhalten; entsprechende Regressionen bleiben erforderlich. Save/Flush beenden einen gültigen Zug einmal
  und sichern ihn; invalide oder stale Vorschau bzw. Keytexte bleiben sichtbar
  erhalten und blockieren Wechsel/Discard. Nach gewonnenem Publish ist ein
  Interrupt kein rückwirkendes Cancel.
- Ein Key-Adapter liest/schreibt den tatsächlichen DungeonAtlasSource-Stand und
  verwendet `dungeonDocumentChange`. Zuerst Raumname/Nummer und Markdown mit
  bestehenden Abschnitts-IDs; Passageabschnitte bleiben erhalten. Die spätere
  vollständige Dungeon-Werkzeugprojektion darf keine schreibende Session als
  Zwischenstufe benutzen. Nicht angebundene Gesten werden nicht als funktional
  ausgewiesen.

## Gemeinsame räumliche Darstellung — Festes räumliches Orakel statt passend skalierter Bilder

**Konkreter neuer Fixturebefund:** Haus A im gelieferten Cityseed ist 4 × 6 Meter.
Der Dungeon-Torraum liegt von `(4,4)` bis `(14,12)` in Fünf-Fuß-Feldern, also
**15,24 × 12,192 Meter**. Ein stilles Anpassen des Dungeonmaßstabs an das kleine
Haus wäre falsch. Die bisherigen v1-Dateien und Hashes bleiben eingefroren.

Für das nächste explizite integrierte Fixture-v2 wird vorgeschlagen, Haus A mit
denselben IDs über die vorhandenen CityEdit-Aktionen auf 15,24 × 12,192 Meter
zu setzen und auf `(-18,8)` zu verschieben. Haus B und sein Hof bleiben erhalten;
damit überlappen die beiden Häuser nicht. Dungeonbytes, Raum/Key/Floor/Route-IDs
bleiben erhalten. Hauslokaler Ursprung `(0,0)` und Dungeonpunkt `(4,4)` werden
explizit ausgerichtet, ohne aus der Entrance-Route eine physische Tür zu erfinden.
Die [konkrete City-Fachantwort #7/6091472576](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/7#issuecomment-6091472576)
bestätigt diese Hausgeometrie/Pose und ihre Materialisierung durch Hex mit nativen
CityEdit-Aktionen. Die [Dungeon-Fachantwort #12/6091516581](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6091516581)
bestätigt den Dock-/Floor-/Route-/Keyteil und dasselbe v2-Orakel. Damit sind diese
engen fachlichen Eingänge bestätigt; der vollständige neue Oraclebestand ist noch
nicht materialisiert. Die eingefrorene Bereichsfixture wird dadurch nicht geändert.

Bei der späteren Materialisierung werden Grundriss und Pose über zwei aufeinander
folgende reine `editCity`-Aufrufe berechnet: Das bestehende API verbietet zwei
Schreibaktionen auf dieselbe Haus-ID in einem Aktionspaket. Erst der vollständige
Endstand wird mit dem ursprünglichen Before über einen `cityDocumentChange`
übernommen; kein Zwischenstand wird veröffentlicht und kein zweiter Historycommit
benötigt. Das ist eine aus dem tatsächlichen API gelesene Anschlussvorgabe, noch
keine ausgeführte v2-Materialisierung.

Die aktive Version wird erst nach konkreter Ownerbestätigung und Materialisierung
der vollständigen v2-Input-/Expectedbytes und SHA-Liste atomar umgestellt.
`e2e01-component-closure-v1` bleibt bis dahin die eine aktive eingefrorene
Zwischenbelegversion. Kein zweiter live geladener Satz derselben Dokument-IDs.
Dungeonfläche muss im Allgemeinen nicht im Haus liegen: Keller/Höhlen dürfen
ausgreifen. Die Deckungsgleichheit ist ein gezieltes Orakel dieser Testkarte,
keine universelle Größenbeschränkung.

## Gemeinsame räumliche Darstellung — Passende Prüfungen, früh und getrennt

1. **Relative Präzision:** Weltanker und Kameraanker `1e16`, `0,01 m/px`,
   Stadtpunkt `(0,01,0,01)` → genau `(1,1)` Pixel relativ zur Mitte und korrekt
   zurück. Danach ein Pixel Pan und Zoom am Pointer. Auch negative Anker,
   Rotation, Hauspose und native 1,524 Meter pro Dungeonfeld prüfen. Nicht erst
   absolute Weltposition bilden und dann den Kameraanker abziehen.
2. **Echte Prospektivprüfung:** Cityhaus entfernen, während ein Dungeon daran
   gebunden ist; Child unbekannt/mehrdeutig/fremd; Route/Floor/Room falsch;
   gleiche Schreibziele und stale Before. Jede Ablehnung erhält alle Owner,
   Redo und Datei-/Keybytes. Preview benutzt dieselbe Prüfung wie Apply.
3. **Speicherclosure:** World, Terrain, Locations, City und Dungeon in einem
   Repositorysave; Copy remappt die tatsächliche gesamte lokale ID-/Referenz-
   Closure. Ungeladene Karten bleiben erhalten. Unbekannte Fremdkeys erhalten
   ihre sichtbare Fehlergrenze statt kopierter Ersatzpayloads.
4. **Fehler/Neustart:** Save während weiterer Keybearbeitung, Dirtyowner beim
   Entkoppeln, externer City-/Dungeonkonflikt, unterbrochenes Journal, Copy ohne
   Zielroot, Discard/Contextwechsel während Load. Quelle, fremde Texte und
   resumable Evidenz bleiben erhalten; committed wird nur vorwärts abgeschlossen.
5. **Gemeinsame Darstellung:** Empty/City-only/ferne City/mischtes Fit, Höfe,
   konstante Griffe, Resize und große negative Position. Dach und Raum bleiben
   vor/nach Zoom deckungsgleich, Pan/Zoom allokieren keine Native-Dateien.
6. **Erster nativer Ablauf:** Haus bewegen → verorteten Raum hineinzoomen →
   Keytext mit CRLF/Unicode verändern → herauszoomen → Hex verändern → Undo/Redo
   → Save → normal beenden → frischer Prozess, dieselben IDs/Bytes/Posen prüfen.
   Sichtbare Originalbilder prüfen; keine GUI-Freigabe aus einem Coretest.

Plan-/JSON-/Verweis-/Diffprüfung in diesem Lauf. Schlanke check/test/build und
die gezielten Fehlerfälle bei tatsächlichen Produktänderungen. Physische
Eingabe, große Welt, Originalparität, Zielhost und Installation bleiben eigene
Nachweise. Vollständiges E2E-01 erhält weiterhin die unveränderten harten
Campaign-/Katalog-/P02/P04-Eingänge, keine positive LiveSession-Abhängigkeit.

## Dungeon-Geometrie und Vorschau

## Dungeon-Geometrie und Vorschau — Aktueller Anschluss statt erneutem Phasenlauf

Der Dungeonbeitrag ist geliefert: [unabhängiger enger Produktreview](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/26#issuecomment-6093376162)
auf `c8bd27d6d223403b46748d3051409c3e1c498224`, [Ownerübergabe](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/26#issuecomment-6093407357)
auf `d02a546df50e891dcb65ec2be548c06b66090bbe`. Beide sowie Produktcommit
`5675cbd13be6f0fa096c3651743f1eb40d93f845` sind Vorfahren des promoteten
Sharedstands `6a41f1640de3e4a4311d905d95f66cd79d91b698` aus PR13
([begrenzte Integrationsentscheidung](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/39#issuecomment-6100834444)).
Der verbleibende Dungeon-am-Ort-/Recovery-Ablauf steht in [#80](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80). Vorhandene Geometrie gehört zum selben Atlas-/Saveablauf; die folgenden Verträge beschreiben dessen technische Grenzen.

Die folgenden Vertragsgrenzen bleiben maßgeblich. Datierte Phasen- und
Reviewangaben bewahren deren Entstehung, keine offenen Folgeaufträge. Der
damalige Planbefund `DUN-GEO-P01-R01-01` und seine Reparatur bleiben nachvollziehbar
im [Vertrags-Cleanup (historisch)](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/6a90f3ee2f50f0be45f0e256784576f13722c319/ROADMAP-E2E01-DUNGEON-GEOMETRY-CLEANUP-PLAN.md).
Quellenintegration und lokaler Review ersetzen keine fehlende Host-, physische
Bedien-, Originalparitäts- oder vollständige E2E-Abnahme.

## Dungeon-Geometrie und Vorschau — Vertragsbegriffe

Diese Begriffe bezeichnen jeweils genau eine Ebene:

| Begriff | Bedeutung | Keine Bedeutung |
| --- | --- | --- |
| `snapshot` | Ein kanonischer immutable Read aus `DungeonAtlasSource` mit nativen Dungeonbytes, Dokument und abgeleiteter Keyclosure. | Keine Revision, kein Preview und kein schreibender Sessionzustand. |
| `gesture state` | Flüchtiger Editorzustand zwischen Begin und Cancel/Handoff. Er gehört genau einer tatsächlichen Source-/History-/Graph-Lebensdauer und einer bei Begin eingefrorenen räumlichen Parentbasis. | Kein Sourcewert, kein Historieneintrag und keine persistente Sessionrevision. |
| `preview` | Ein aus dem Gesturezustand abgeleitetes immutable Dokument, das nur die bestehende räumliche Lesesicht überlagert. | Kein Draft, kein Save und keine Mutation eines Owners. |
| `proposal` | Das schreibfrei validierte Paar aus Previewdokument und möglichem ownergebundenem `AtlasChange`. | Kein Commit und keine Erlaubnis zum Execute. |
| `AtlasChange` | Kanonischer Before→After-Beitrag genau des Dungeonowners. | Kein vollständiger Mehrownerbefehl und kein eigener Undo-Schritt. |
| `composed command` | Vollständiger, vom `AtlasEditor` zusammengestellter Befehl aller beteiligten tatsächlichen Owner. | Keine Dungeon-eigene Parallelhistory. |
| `handoff` | Übergabe eines noch nicht ausgeführten Dungeonbeitrags an den Orchestrator. | Weder `check()` noch `execute()` und keine Speicherwirkung. |

Die normativen Aussagen dieses Plans sind Scope, Eingaben, Ausgaben,
Wirkungsverbote, Erhaltungsgrenzen und Gates. Bezeichner, TypeScript-Form,
Dateizuschnitt und Sichtbarkeit richten sich nach dem tatsächlichen Source-/Framevertrag.

## Dungeon-Geometrie und Vorschau — Enger Auftrag und Nichtziele

Der erste Port bearbeitet ausschließlich einen Punkt der **äußeren Kontur**
von Room31 auf Floor32. Er verwendet den vorhandenen nativen Dungeon-Snapshot,
die bestehenden reinen Building-Punkt- und Konturplaner und erzeugt bei
Finalisierung genau einen kanonischen ownergebundenen Before→After-
`AtlasChange`. Vorschau und Abbruch sind vollständig transient.

Nicht Teil dieses Laufs und des ersten I01 sind Punkt einfügen/entfernen,
Innenlöcher, ganze Räume verschieben, neue Räume oder Geschosse, freie Wände,
neue Detailkarten, Raum-Key-Bearbeitung, Campaign-/Worldautorität,
CompleteImport, Save-/Draft-/Journalumbau und eine zweite Kamera, Geometrie,
Session, History oder Persistenzstrecke. Route33 bleibt ein semantischer
Eingang und wird nicht als physische Tür umgedeutet. OBS-04/PR #21 bleibt
unverändert.

## Dungeon-Geometrie und Vorschau — Wiederverwendete Wahrheit

- `DungeonAtlasSource.read()` liefert aus der gemeinsamen `AtlasHistory` den
  kanonischen `.dungeon`-Bytewert, ein immutable `MapDocument` und die daraus
  abgeleitete Keyclosure. `dungeonDocumentChange(before, after)` erzeugt den
  ownergebundenen kanonischen Dokumentbeitrag. Es gibt keine persistente
  Sessionrevision und keine zweite Keyautorität.
- `SpatialGraph.frame(documentId, view)` prüft die tatsächliche Owner-, Floor-,
  Room- und Entrance-Route-Closure. Der Dungeonmaßstab bleibt ausschließlich
  dort `1.524` Meter pro Feld.
- `SpatialCanvas` verwendet dieselbe relative Kamera zum Zeichnen, Treffen und
  Zurückprojizieren. Die geplante Vorschau erweitert diese Lesesicht; sie
  besitzt keine Kamera und keinen Renderer.
- `buildingVertexGrip`, `buildingPointDragDestination`,
  `proposeBuildingPointDrag` und `planBuildingContourMutation` bleiben die
  einzige Punkt-/Topologiesemantik. Der letzte Planer validiert Metadaten,
  Konturadresse, Polygongeometrie und abhängige Portalanker.
- `AtlasHistory.check()` prüft einen vollständigen prospektiven
  Mehrownerzustand schreibfrei. Erst der bestehende `AtlasEditor` darf
  danach genau einmal `AtlasHistory.execute()` für denselben vollständigen
  Befehl aufrufen.

## Dungeon-Geometrie und Vorschau — Source- und Gesturevertrag

`src/features/dungeon/geometry-change.ts` liefert die integrierten Source-/Gestureverträge. Der Port exportiert keinen Executor und keine Speicherfunktion; alle Vorschauinformationen bleiben bis zum Handoff schreibfrei. Die Typen verwenden die tatsächlich gebundene `DungeonSpatialBasis`:

```ts
interface DungeonGeometryAddress {
  ownerId: string;
  floorId: string;
  roomId: string;
  contour: number;
  point: number;
}

interface DungeonGeometryProposal {
  before: DungeonAtlasSnapshot;
  address: DungeonGeometryAddress;
  basis: DungeonSpatialBasis;
  preview: MapDocument;
  change: AtlasChange;
}
```

Die konkreten Funktionen beginnen eine Geste aus genau einem eingefrorenen
`DungeonAtlasSnapshot`, ermitteln einen äußeren Vertexgrip und aktualisieren
ihn in nativen Dungeonfeldern. Der 16-Pixel-Grip wird mit der vorhandenen
Kamera und dem `RigidFrame` in Felder umgerechnet; `1.524` wird weder im
Dokument noch im Proposal gespeichert. Snap benutzt unverändert
`buildingPointDragDestination`.

`proposeBuildingPointDrag` liefert die Geometrie, anschließend erzeugt
`planBuildingContourMutation` das validierte bestehende `Command` samt
abhängigen Portaländerungen. Für dessen schreibfreie Materialisierung wird
die bereits von `Session` verwendete Record-Change-Validierung als **eine
gemeinsame pure Dokumentprojektion** freigelegt oder eng extrahiert. Die
Umsetzung darf weder `Session.execute()` auf einer temporären Session aufrufen
noch Entity-/Portal-/Reihenfolgelogik nachbauen. Die Projektion nimmt das
eingefrorene Dokument und das validierte Command, prüft Beforewerte, Kennungen,
Indizes und das resultierende Gesamtdokument und gibt ein neues immutable
`MapDocument` zurück. `dungeonDocumentChange(snapshot.document, after)` ist
danach die einzige Atlas-Change-Erzeugung.

Ein Nullzug liefert kein Proposal. Ein erfolgreiches Proposal enthält genau
den Byte-Snapshot, aus dem auch die Vorschau stammt. Es hat keine
`execute`-, `undo`, `save`, `flush`-, Repository-, Vault- oder Dateimethode.

## Dungeon-Geometrie und Vorschau — Rollen- und Wirkungsgrenzen

| Rolle | Eingabe und Lebensdauer | Erlaubte Ausgabe | Verbotene Wirkung |
| --- | --- | --- | --- |
| `DungeonAtlasSource` | Tatsächliche registrierte Ownerwerte derselben `AtlasHistory`; liefert einen Zeitpunktssnapshot. | Kanonische Dungeonbytes, immutable Dokument und abgeleitete Keyclosure. | Keine Gesture, kein Preview, keine Session-/Dateioperation. |
| Pure Command→Document-Projektion | Eingefrorenes Dokument plus ein vom vorhandenen Konturplaner validiertes `Command`; nur für eine Proposalberechnung. | Neues vollständig validiertes immutable `MapDocument`. | Kein `Session.execute`, kein eigener Historystack und keine duplizierte Portal-/Reihenfolgesemantik. |
| Dungeon-Gesturezustand | Begin bis Cancel oder Handoff; hält Adresse, Pointer, tatsächliche Source-/History-/Graph-Identitäten und die eingefrorene Parentbasis. Ein History-Abonnement macht jede zwischenzeitliche Änderung terminal stale. | Nur bei unveränderter Basis aktuelles Preview oder noch nicht ausgeführter Dungeonbeitrag. | Keine Source-, History-, Draft-, Repository-, Vault- oder Dateimutation; kein Auto-Rebase. |
| `SpatialCanvas` | Liest tatsächliche räumliche Sources und optional genau einen ownergebundenen Previewoverride für einen Draw/Hit-Zyklus. | Darstellung, Grip und Treffer in derselben relativen Kamera. | Keine zweite Kamera, kein Sourcewrite und keine Finalisierung. |
| Atlas-Editor | Besitzt Begin/Update/Cancel und gibt bei erfolgreichem Abschluss höchstens einen Beitrag weiter. | UI-Zustand und Handoff an den bestehenden Orchestrator. | Kein eigener Dungeon-Execute, Save oder Sessioncommit. |
| `AtlasEditor` | Empfängt noch nicht ausgeführte Beiträge tatsächlicher Owner für genau einen vollständigen Befehl. | Erst `check()` auf dem vollständigen Befehl, danach genau ein `execute()` auf demselben Befehl. | Kein Teilcommit, keine zweite History und keine stellvertretende Domainautorität. |

Diese Tabelle ordnet vorhandene Verantwortlichkeiten; sie führt keine zweite
Source-, Transform-, History- oder Persistenzarchitektur ein.

## Dungeon-Geometrie und Vorschau — Tatsächliche Gesturebasis und ChangedBasis

Der rein flüchtige `DungeonSpatialBasis`-Guard bindet jede Geste an ihre tatsächliche Basis. Der Guard wird bei Begin aus den **heute
existierenden tatsächlichen Objekten und Records** gebildet und weder
persistiert noch als Campaign-/Worldrevision ausgegeben:

- Objektidentität von `TerrainSource`, `SpatialGraph`,
  `DungeonAtlasSource`, dem tatsächlichen `LocationSource`, gegebenenfalls
  `CitySource` und ihrer einen gemeinsamen `AtlasHistory`; der Resolver nutzt
  dafür die vorhandene Ownerregistry des Graphen, keine zweite Registry;
- Dungeonowner-ID und die kanonischen `documentBytes` des Begin-Snapshots;
- der vollständige `DungeonPlacement`-Record für dieses Dokument aus dem
  bestehenden `spatial`-Target, einschließlich Placement-ID, Parent,
  Anchor, Rotation, Surface-Floor und Entrances;
- der vollständige zugehörige `LocationPlacement`-Record aus dem bestehenden
  `placements`-Target;
- bei `city-building` zusätzlich der vollständige `CityPlacement`-Record und
  der exakte adressierte `CityBuilding`-Record mit ID, Footprint, Position,
  Rotation und Scale;
- der aus genau dieser Kette berechnete `RigidFrame` einschließlich
  `metersPerUnit` und `originUnits`.

Ein einziger reiner Resolver liest dieselbe Kette bei Begin, vor jedem neuen
Preview und unmittelbar vor Handoff erneut. Er verlangt dieselben Source-,
Graph- und Historyobjekte sowie strukturelle Gleichheit jedes genannten
Records, der Dungeonbytes und des Frames. Er leitet keine Revision aus
Payloads ab und akzeptiert keinen gleich aussehenden Ersatzadapter.

Zusätzlich abonniert der Gesturezustand beim Begin genau diese
`AtlasHistory`. Jede Benachrichtigung durch Execute, Undo oder Redo setzt ihn
terminal auf `changed-basis`, entfernt das Preview und löst das Abonnement.
Damit bleibt auch A→B→A stale: spätere Rückkehr zu strukturell gleichen
Records reaktiviert eine alte Geste nicht. Eine direkte Source-/Graph-/
History-Auswechslung mit bytegleichen Dungeondaten wird durch die
Objektidentitäten und den erneuten Resolververgleich erkannt.

`changed-basis` ist ein Abbruchzustand, kein Rebase. Update erzeugt danach
kein Preview; Handoff gibt keinen `AtlasChange` zurück; ein verspätetes
Pointer-up bleibt wirkungslos. Ein neuer Zug darf erst mit einem neuen Begin
auf der dann aktuellen Basis starten. Der Guard besitzt keine Execute-,
Save-, Draft-, Repository-, Vault- oder Dateioperation.

Der erfolgreiche Handoff prüft die Basis ein letztes Mal und läuft ohne
asynchronen Yield im selben Aufruf weiter zur bestehenden Komposition. Er
übergibt weiterhin **genau einen** Dungeon-`AtlasChange`; der Orchestrator
führt weiterhin den vollständigen Befehl durch ein `check()` und genau ein
`execute()`. Vor Handoff wird das History-Abonnement gelöst, sodass das
anschließende beabsichtigte gemeinsame Execute keinen bereits übergebenen
UI-Zustand reaktiviert. Es entsteht weder eine zweite Autorität noch ein
zweiter Commit.

## Dungeon-Geometrie und Vorschau — Gesture- und Vorschaulebensdauer

1. Pointer-down im Select-Werkzeug trifft Room31 und zusätzlich einen
   expliziten äußeren Vertexgrip. Der Editor friert Owner/Floor/Room,
   Kontur-/Punktadresse, Gripkoordinate, Sourcebytes, Pointerstart und die
   vollständige oben definierte Gesturebasis ein und aktiviert ihr
   History-Abonnement. Ein normaler Raumtreffer ohne Grip behält sein heutiges
   Verhalten.
2. Pointer-move prüft zuerst Source-/History-/Parentbasis. Nur bei Gleichheit
   wird mit dem eingefrorenen Frame und derselben relativen Kamera in
   Dungeonfelder zurückprojiziert und rein ein neues Proposal berechnet.
   `SpatialCanvas` liest dessen `preview` als ownergebundenen
   Dokumentoverride; Source und `AtlasHistory` bleiben unangetastet.
3. Ein Historyereignis oder ungleiche aktuelle Basis wechselt terminal auf
   `changed-basis` und entfernt Preview/Abonnement. Escape, `pointercancel`,
   Fenster-`blur`, Tool-/Source-/Dokumentwechsel und ein explizites Cancel
   tun dasselbe ohne Historywirkung. Nach jedem dieser Endzustände darf ein
   verspätetes Pointer-up nichts finalisieren.
4. Die Undo-/Redo-Aktion des Atlas-Editors bricht einen aktiven Dungeonzug vor
   dem Historyaufruf ab. Die angeforderte Historyaktion läuft danach normal;
   der Abbruch selbst erzeugt keinen Eintrag und leert insbesondere keinen
   vorhandenen Redostand.
5. Pointer-up finalisiert nicht selbst. Nach letzter Basisprüfung löst der
   Editor das Abonnement und übergibt höchstens den eingefrorenen einzelnen
   `AtlasChange` synchron an den bestehenden `AtlasEditor`. Dieser setzt
   ihn mit tatsächlichen anderen Ownerbeiträgen zu einem Befehl zusammen,
   ruft `check()` auf diesem Gesamtbefehl und anschließend genau einmal
   `execute()` auf demselben Gesamtbefehl auf.
6. Save, Draft, Journal, Copy/Discard und frischer Prozess konsumieren danach
   unverändert die bereits registrierten tatsächlichen Sources und den
   vorhandenen Repository-/FileTransaction-Weg.

## Dungeon-Geometrie und Vorschau — Verbindliche Validierungsorakel

Die aktive Fixture `e2e01-spatial-v2` adressiert exakt:

- Dokument `00000000-0000-4000-8000-000000000030`;
- Room `00000000-0000-4000-8000-000000000031`;
- Floor `00000000-0000-4000-8000-000000000032`;
- semantische Entrance-Route
  `00000000-0000-4000-8000-000000000033`;
- Keysection `00000000-0000-4000-8000-000000000034`.

Für I01 gelten alle folgenden Orakel:

1. **Adress- und Sperrprüfung:** falscher oder inzwischen anderer Owner,
   Floor, Room, Kontur, Punkt, Gripkoordinate, nicht äußerer Ring, gelöschter
   Datensatz, locked Room sowie nicht endliche Koordinaten werden vor einem
   sichtbaren Proposal abgewiesen.
2. **Source-/Basis-Stale-Prüfung:** Die `before`-Bytes des finalen Change sind
   exakt die beim Begin eingefrorenen Sourcebytes. Source-, Graph- und
   Historyobjekte sowie DungeonPlacement/Binding, LocationPlacement,
   gegebenenfalls CityPlacement/House und berechneter Frame müssen bis zum
   Handoff dieselben bleiben. Historyereignis oder Vergleichsabweichung führt
   terminal zu `changed-basis`; kein Auto-Rebase und kein stilles Übernehmen
   eines bytegleichen Ersatzowners.
3. **Topologie und Closure:** ungültige Polygone sowie nicht auflösbare oder
   inkonsistente abhängige Portalanker scheitern über denselben
   `planBuildingContourMutation`-/Dokumentvalidator wie der native Editor.
   `SpatialGraph.frame(..., prospectiveView)` prüft vor dem Gesamt-Execute die
   Owner-/Floor-/Room-/Route-Closure.
4. **Erhaltungsgrenze:** Dokument-, Floor-, Room-, Route- und Section-ID,
   Entity-/Floor-/Section-Reihenfolgen, Dokumentoptionen, nicht betroffene
   Entities und sämtliche unabhängigen Markdownbytes bleiben exakt. Erlaubt
   sind nur die eine Room-Außenkontur und die vom bestehenden Konturplaner
   tatsächlich abhängigen Portalanker.
5. **Preview/Cancel:** während Begin/Update/Cancel bleiben Sourcebytes,
   Keyclosure, `undoDepth`, `canRedo`, Repositorydirty, Draft, Dateien und jede
   Session unverändert. Escape, `pointercancel`, `blur` und Kontextwechsel
   entfernen die Vorschau; keine dieser Folgen erzeugt einen Change.
6. **Preview/Final-Kohärenz:** Das final serialisierte After-Dokument entspricht
   bytegenau dem zuletzt sichtbaren gültigen Preview. Ein Nullzug erzeugt
   weder Change noch Historieneintrag.
7. **Einmaligkeit:** Der vollständige Mehrownerbefehl wird zuerst als Ganzes
   geprüft und danach einmal ausgeführt. Der Dungeonbeitrag erzeugt keinen
   vorgelagerten Session- oder Atlas-Commit. Undo/Redo ist genau ein Schritt
   gemeinsam mit den im selben Befehl enthaltenen Ownerbeiträgen.
8. **Maßstab:** Der native Lauf rechnet ausschließlich über denselben
   `RigidFrame` mit `1.524 m/Feld`. Verschieben des gebundenen Hauses ändert
   die starre Projektion, nicht die gespeicherte Dungeonkontur.

### Dungeon-Geometrie und Vorschau — N01-Pflichtrepros für I01

Jede Folge beginnt mit gültigem Room31/Floor32-Preview und endet mit exakten
Zähler-, Byte- und Dateivergleichen:

1. Haus105 verschieben, Geste beginnen, gemeinsames Undo der Hausbewegung,
   Update und verspätetes Pointer-up: Preview weg, kein Dungeonchange, Undo
   erzeugt den normalen Redostand und der Abbruch leert ihn nicht.
2. Dasselbe mit Redo sowie mit einer Locationbewegung. Ein Historyereignis
   invalidiert auch dann terminal, wenn A→B→A am Ende wieder dieselben Records
   und denselben Frame ergibt.
3. DungeonBinding/Anchor oder zugehöriges CityPlacement ändern, ohne die
   Dungeonbytes zu ändern: Update/Handoff blockiert; nach Rückkehr kein
   Wiederaufleben der alten Geste.
4. `DungeonAtlasSource`, `LocationSource`, gegebenenfalls `CitySource`,
   `TerrainSource`/`SpatialGraph` oder die gemeinsame `AtlasHistory` durch
   einen neuen Adapter mit identischen Dungeonbytes und strukturell gleichen
   Records ersetzen: alte Geste blockiert.
5. Nach jedem `changed-basis`, Escape, `pointercancel`, `blur` und
   Sourcewechsel ein late pointer-up senden: null AtlasChanges, gegenüber dem
   unmittelbar nach einer erlaubten Historyaktion gemessenen Stand keine
   zusätzliche Undo-/Redo-Änderung, kein Repositorydirty, kein Draft-/Datei-
   oder Journalwrite.
6. Anschließend auf der aktuellen Basis neu beginnen: Preview und finaler
   einzelner Dungeonchange verwenden denselben aktuellen Frame; gemeinsame
   `check`/einmalige-`execute`-Komposition und ein Undo/Redo-Schritt bleiben
   unverändert.

## Dungeon-Geometrie und Vorschau — I01-Dateigrenze und Prüfplan

Technische Modulgrenzen:

- `src/features/dungeon/geometry-change.ts`;
- eine eng extrahierte pure Command→Document-Projektion im vorhandenen
  Dungeon-/Session-Pfad statt einer zweiten Applikationslogik;
- `src/features/atlas/spatial-canvas.ts` nur für einen ownergebundenen
  Dungeon-Previewoverride und Vertexgripdarstellung;
- `src/features/atlas/atlas-editor.ts` nur für Begin/Update/Cancel/Handoff;
- fokussierte Core- und DOM-Regressionen in den vorhandenen Testsammlungen.

Coretests frieren Sourcebytes, Closure, Historytiefen und Dateidoubles vor
jeder Folge ein. Positive Fälle prüfen Grip, Update, bytegleichen
Preview/Final-Stand, abhängigen Portal-Follow und genau einen komponierten
Undo/Redo-Schritt. Negative Tabellen decken jede Adress-/Stale-/Locked-/
Topologie-/Closure-Grenze sowie sämtliche sechs N01-Pflichtrepros ab. Ein
Instrumentierungsfall verbietet
`Session.execute`, `AtlasHistory.execute`, Repository- und Dateiaufrufe während
Begin/Update/Cancel. Die aktive v2-Fixture und ihre nicht betroffenen SHA-/
Markdownwerte werden vor und nach dem komponierten Corefall verglichen.

I01 erhält `npm run check`, fokussierte Regressionen, vollständiges `npm test`
und `npm run build`. Produktwirkung benötigt zusätzlich unabhängige
Codeprüfung und direkte Belege auf dem vereinbarten isolierten Host. Die reine
Vertragsprüfung führt mangels
Produktänderung keine Produktbasisprüfung als Funktionsbeleg an.

## Integrierte Gesture-Gegenfälle

`DungeonGeometryGesture.sample(resolvePointer, snap)` widerruft das bisherige Proposal bereits vor der Pointerumrechnung. Wirft `unprojectLocal()` oder scheitert Topologie/Endlichkeit, müssen Vorschau und späterer Handoff leer bleiben; Pointer-up darf keinen älteren unsichtbaren Stand übernehmen. Ein später gültiges Sample liefert ausschließlich seinen neuen sichtbaren Stand. Der immutable Beginpointer bleibt Delta-Ursprung für off-center-Zug, Rückkehr und Snap.

`projectRecordChanges()` ist dieselbe reine Prüfungs-/Anwendungsgrenze für `projectDocumentCommand()` und `Session.apply()`; Indexergänzung, Reihenfolge, IDs, Markdownclosure, Portal-Follow und stale-/invalid-Ablehnung bleiben gleich. Gegenproben verwenden echte `AtlasEditor.bind()`-Callbacks: gültige Vorschau → Fehler vor der Geometrieberechnung → Pointer-up mit unveränderten Dungeonbytes, Undo-Tiefe, Redo und Draftsignal; ein frischer Begin funktioniert weiter.

Für den bisherigen Anschluss separat gebundener Dungeonkarten gilt: Starre Cityplatzierung und skalierter Hausdockpunkt dürfen Dungeonräume nicht verformen. Entfernen eines gebundenen Hauses erfordert prospektive Ablehnung oder atomare Entkopplung. Das feste Dungeonorakel bleibt Dock `(4,4)`, 1,524 m/Feld, Floor32/Room31/Entrance-Route33/Key34; Route33 bleibt eine semantische Adresse. Dieser Teilbeleg umfasst nicht die künftig ausdrücklich ausgelöste [Gesamtskalierung eines gemeinsamen Gebäudes](ROADMAP-CITIES.md#gebäude-und-innenräume-als-ein-objekt). Vollständiger Campaign-/Import-/P02-/P04-Nachweis ist zusätzlich erforderlich, ohne positive LiveSession-Abhängigkeit.
