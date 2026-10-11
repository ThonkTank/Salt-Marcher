# SMR-03-I01 – Hostneutraler Party-/Scene-/Live-Session-Kern

Status: **I01-A, I01-B und I01-C01 sind in Shared integriert; I01-C02 bis C05
werden in Issue #147 als ein zusammenhängendes Lifecycle-Paket umgesetzt. Kein
Persistenz-, Host- oder Gesamtprodukt-Go.**

## Gebundener Stand

- Fachvertrag:
  [`smr03-live-scene-contract.md`](smr03-live-scene-contract.md) auf dem semantischen
  Exact-SHA `0254d575e61df130b3f85dbcef810faef54ce0d5`.
- Exact-SHA-Architekturreview: Issue #6, Kommentar `6088985728`, `PASS`.
- Source-Owner-Ratifikation: Issue #6, Kommentar `6088996383`.
- Music/Weather/Shops-Consumer-Ratifikation: direkt erzeugter und unverändert
  integrierter Commit `ed755aedd1dd3d2a85556ce51ed576b25527595d`.
- Aktueller integrierter Shared-Ausgangspunkt für I01-C02 bis C05:
  `9527c2da76b674934827bb3bf3773eebc453b45f` (C01 über PR #146).
- I01-Planreview: Issue #6, Kommentar `6089122945`,
  `CHANGES_REQUIRED` für gemeinsame Rejoin-/Clock-Publikation,
  Prepared-Runtime-Kopie und vollständige Acceptance-/Slice-Zuordnung.
- I01-Planrepair `c03217a4c755844b921b963c42b4da9e5ae32477`:
  Exact-SHA-Re-review in Issue #6, Kommentar `6089170030`, `PASS`; ARCH-01 bis
  ARCH-03 sind im Plan-Scope geschlossen. Dies ist kein Produktcode- oder
  Realnachweis.
- Fachliche Product-Truth: SaltMarcher
  `9de85c1a26f526acbc1af332ac5962e185c0aab2`, insbesondere die im Fachvertrag
  benannten Party-, Scene-, Live-Session- und Program-Technical-Needs-Quellen.

Java-, JavaFX-, Electron-, JDBC- und historische Obsidian-Implementierungen
sind weiterhin nur Verhaltensreferenzen. Dieser Plan übernimmt weder deren
Klassenmodell noch Prozess-, Datei- oder Datenbankgrenzen.

## Ziel des ersten Implementierungsstrangs

Der erste Strang baut einen reinen, deterministischen TypeScript-Kern für
Party, LiveScene und LiveSession. Der Kern besitzt keine Hostimporte, keine
Datei-, Datenbank-, Fenster-, Audio- oder Prozessrechte und keine direkte
Obsidian-/Electron-Kopplung. Er verarbeitet validierte immutable Eingaben,
liefert immutable Ergebnisse und erzeugt explizite, noch nicht persistierte
Command-/Reconciliation-Entscheidungen.

Der Strang beweist zunächst die Fachinvarianten. Er behauptet noch keine
durable Mehrbesitzertransaktion, keinen Campaign-Write, keine Migration, keine
Hostoberfläche und keine Passive-Display-Ausgabe. Diese Grenzen werden erst in
späteren, separat freigegebenen Paketen angeschlossen.

## Abhängigkeiten und harte Gates

| Gate                                 | Aktueller Zustand                                        | Wirkung auf SMR-03                                                                                                         |
| ------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| SMR-03-Semantik und aktuelle Owner   | für den gebundenen SHA reviewt/ratifiziert               | I01 darf geplant und nach Plan-PASS als reiner Kern umgesetzt werden                                                       |
| SMR-01 Campaign-/Transaktionsvertrag | Kandidat, nicht als Produktadapter freigegeben           | keine persistente Mutation, kein Import/Export und kein Recovery-Adapter in I01                                            |
| SMR-07 Clock-/Travel-Vertrag         | reviewte Semantik, getrennt ratifikationspflichtig       | I01 speichert nur opaque `SceneClockRef` und erwartet revisionierte Entscheidungen; keine eigene Uhr                       |
| SMR-00-ADR-01                        | vorgeschlagen, P01–P04/C01 nicht vollständig entschieden | keine neue Obsidian- oder Desktopkopplung und keine IPC-/SQLite-/Fensterwahl                                               |
| Encounter/Chase-Fachowner            | Runtime-Mask-Lifecycle nur eng ratifiziert               | nur Maskenidentität, Teilnehmer-Reconciliation und Lifecycle-Status; keine Regeln, HP, Initiative, Completion oder Effects |
| Passive Display                      | Consumer-Owner offen                                     | kein Export, Kanal, DTO, Subscription oder Rendering aus der internen Source                                               |

Fehlt ein erforderlicher Owner oder liefert ein Port `unavailable`, bleibt der
reine Kern lesbar und erzeugt ausschließlich den normierten Pending-/Fail-
Closed-Ausgang. Ein fehlender Adapter wird nicht durch einen Dummy ersetzt.

## Geplante Modulgrenzen

I01 ergänzt ausschließlich `src/features/live-session/` und gezielte Tests.
Der bestehende Dungeon-Typ `src/session.ts::Session`, Atlas-/City-Scenes,
MapRepository und aktuelle Obsidian-Views werden weder umbenannt noch als
Fachzustand wiederverwendet.

| Datei                     | Verantwortung                                                                                        | Darf nicht enthalten                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `ids.ts`                  | gebrandete Campaign-, Character-, Party-, LiveScene-, Mask-, Command- und Owner-IDs; zentrale Parser | Pfade, Hosthandles oder generierte Zufallswerte                       |
| `contracts.ts`            | readonly DTOs, Revisionen, Lifecycle-Enums und parse-/assert-Funktionen                              | Repository-, UI- oder Fachowner-Implementierung                       |
| `state.ts`                | immutable `PartyState`, `SceneState`, `LiveSessionState`, Tombstone-/Pending-Referenzen              | Consumerzustände fremder Fachbereiche                                 |
| `commands.ts`             | diskriminierte, revisionierte Command-Requests und fachliche Ergebnis-/Konflikttypen                 | direkte Writes, globale Singletons oder UI-Callbacks                  |
| `evidence.ts`             | einziger schmaler Bridge-Parser für kanonische Campaign-IDs und SHA-256-Belege                       | Aggregate-, Owner-, Persistenz- oder Hostlogik                        |
| `party-aggregate.ts`      | Roster, Membership, Profile, XP/Rest, PartyRevision und History-Entscheidungen                       | SceneClock, Encounter-, Shop-, Weather- oder Music-Wahrheit           |
| `scene-aggregate.ts`      | Primary, Focus, Scene-Zuordnung, Split/Rejoin, Empty-Scene-Cleanup und SceneRevision                 | Partyprofil, Karteninhalt, Clockwert oder Maskenpayload               |
| `mask-reconciliation.ts`  | owner-neutrale Teilnehmer-/Retirement-Pflichten mit erwarteten Revisionen                            | Encounter-/Chase-Regeln, Completion oder Effects                      |
| `projections.ts`          | tief eingefrorene Party-, Focus-, LiveScene- und LiveSession-Projektionen                            | Playerprojektion oder private Daten fremder Owner                     |
| `multi-owner-model.ts`    | Stage/Validate/Publish/Verify/Finalize-, Cancel-, Receipt- und Pending-Modell                         | konkrete Transaktion, Dateisystem, SQL oder IPC                       |
| `reference-owners.ts`     | Registry-/Manifest-/Erasure-Slot-, Tombstone- und Closure-Verträge                                   | frei interpretierbare Pfade, SQL-Schlüssel oder fremde Payloads       |
| `portability.ts`          | Complete-/Salvage-/Evidentiary-Entscheidungen sowie gebundene RetainedQuarantine-Rebinds             | reale Bytes, Providersemantik oder stiller Downgrade                  |
| `history.ts`              | bounded 100-step PartyCommandHistory, kausale Undo-/Redo-Pläne und irreversible Tombstonegrenzen     | SMR-07-Campaign-History oder rekonstruierbare gelöschte Personendaten |
| `deletion.ts`             | permanente Character-Löschung, Aggregate-Cleanup und Closure-/Purge-Entscheidung                     | physische Erasure, durable Receipts oder Hostzugriff                  |
| `index.ts`                | ausdrücklich freigegebene öffentliche Kernoberfläche                                                 | Hostadapter oder Convenience-Reexport fremder Interna                 |

Die Dateiteilung ist eine Implementierungsgrenze, keine Aufforderung, alles in
einem Commit zu bauen. Jeder unten benannte Slice bleibt getrennt reviewbar.

## Öffentliche Kernverträge

### Identität und Revision

- Jede ID ist nach Parsing eine nichtleere opaque Zeichenfolge und wird nie aus
  Namen, Arraypositionen oder Pfaden abgeleitet.
- Jede Revision ist eine nichtnegative sichere Ganzzahl. Der Kern vergleicht
  Gleichheit und Monotonie, erzeugt aber keine fremde OwnerRevision selbst.
- Jeder schreibende Request trägt `commandId`, `campaignId`, erwartete eigene
  Revisionen und die explizit beteiligten Owner-/Zielidentitäten.
- Parser kopieren und frieren den vollständigen akzeptierten Objektgraphen tief
  ein. Unbekannte Kernfelder, doppelte IDs, fremde Campaign-IDs, unsichere
  Zahlen, unvollständige discriminated unions und mutable Aliasstrukturen
  scheitern vor jeder Aggregateausführung.

### Party

`PartyState` enthält mindestens CampaignId, PartyRevision, geordnetes Roster,
aktive Membership, Profile/Quick-Fields, XP-/Rest-/Adventuring-Day-Fakten,
Tombstones und den aktuellen History-Cursor. Name-only-Erstellung und
Duplikatnamen bleiben erlaubt; Identität stammt ausschließlich aus CharacterId.

Party kennt Scene-Zuordnung nur als revisionierte Projektion beziehungsweise
als auszugebende Reconciliation-Pflicht. Party schreibt keine Scene direkt.
Planning-only Expected Party gehört nicht in dieses Aggregate.

### Scene

`SceneState` enthält CampaignId, SceneRevision, mindestens eine Primary Scene
nach Initialisierung, den getrennten Focus sowie je LiveScene stabile ID,
Primary-Rolle, geordnete CharacterIds, opaque SceneClockRef, LocationRef,
ContentPins, MaskRefs und Lifecycle-/Pending-Status.

Der Scene-Kern liest Party-/Clock-/Maskenprojektionen ausschließlich über
revisionierte Eingaben. Er übernimmt weder Party-Mitgliedschaft noch Clockwert
oder Maskenpayload als eigene Wahrheit.

Eine Prepared Runtime Scene entsteht ausschließlich aus einem validierten,
immutable `PreparationSnapshot`. Dieser bindet CampaignId, PreparationId,
PreparationRevision, Quellenprovenienz, Titel, Notes, LocationRef, ContentPins
und höchstens eine opaque verlinkte EncounterPlanRef. Der Request liefert
explizit eine frische Runtime-LiveSceneId und alle weiteren neuen Runtime-IDs;
der Kern erzeugt keine Identität und öffnet oder kopiert keinen Encounter-
Payload. `leer` bedeutet ausschließlich: null Runtime-Teilnehmer und keine
laufende Maske. Wiederholter Import desselben Snapshots erzeugt mit neuen IDs
unabhängige Runtime-Kopien. Spätere Planneränderungen wirken nicht auf bereits
erzeugte Kopien zurück. Teilnehmer wechseln erst durch einen getrennten,
revisionierten Move; dessen Konflikt oder Cancel lässt die Prepared Runtime
Scene weiterhin leer.

### Projektionen

- `PartyProjection` liefert nur aktuelle Party-/Rosterfakten und Revision.
- `FocusProjection` ist exakt `active | none | pending | unavailable`.
- `LiveSceneProjection` enthält nur die im Fachvertrag erlaubten Identitäten,
  Revisionen, CharacterIds und opaque Referenzen.
- `LiveSessionProjection` komponiert die fokussierte Scene lesend und besitzt
  keine zweite Fachwahrheit.
- Jeder Projektionsbuilder erzeugt einen neuen tief gefrorenen Wert; keine
  Map-/Set-/Array-/Objektreferenz des internen Aggregats entweicht.
- `none`, `pending`, `unavailable`, stale, fremd, retired oder beschädigt
  liefern keine zuletzt bekannte Scene als aktuell.
- Es gibt in I01 keinen Typ und keinen Export namens `PlayerProjection`,
  `PassiveDisplay`, `SecondWindow` oder sinngleiche Bridge.

## Command- und Zustandsmodell

Die erste vollständige Command-Menge des Kerns umfasst:

1. `InitializeLiveSession`;
2. Rosterfigur anlegen/ändern, aktivieren/deaktivieren;
3. XP-Korrektur und Short-/Long-Rest;
4. Focus wechseln oder explizit `none` setzen;
5. Scene splitten beziehungsweise aus einem validierten
   `PreparationSnapshot` eine unabhängige teilnehmerleere Runtime-Kopie mit
   frischen explizit gelieferten IDs und Source-Provenienz erzeugen;
6. Teilmenge von Characters revisioniert bewegen;
7. Scenes mit ausdrücklicher Clockentscheidung rejoinen;
8. Character logisch und permanent löschen;
9. Undo/Redo als neue Commands;
10. imported retained Tombstone-Envelope ausdrücklich opaque verwerfen.

Jeder Handler ist rein: `state + validated request + validated owner inputs`
ergibt entweder einen unveränderten Konflikt/Unavailable-Ausgang oder
`nextState + decision + reconciliationPlan`. Kein Handler ruft Ports, erzeugt
Zeit, IDs oder Zufall und kein Fehler hinterlässt einen Teilzustand.

### Deterministischer Cleanup

Move, Rejoin, Deactivate und Delete berechnen vor einer Veröffentlichung einen
vollständigen `SceneCleanupPlan`. Er bindet Source-/Target-/Primary-/Focus-ID,
erwartete Revisionen, Successor, Clockentscheidung, Retirement und alle
Masken-/Consumer-Reconciliation-Pflichten. Eine nichtleere Source wird nie
retired. Eine leere letzte Primary bleibt bestehen. Prepared Runtime Scenes
sind bis zum ersten bestätigten Move kein Primary-/Focus-Kandidat.

### Rejoin und Zeit

I01 interpretiert keinen Kalender und wendet keine WorldEffects an. Rejoin
akzeptiert ausschließlich einen validierten, **noch nicht veröffentlichten**
`ClockMergeParticipantContribution`. Er bindet CampaignId, dieselbe CommandId
und denselben kanonischen CommandDigest wie der Rejoin, Source-/Target-Scene und
ClockRef, erwartete Scene-/ClockRevisionen, die ausdrückliche GM-Wahl, den
gewählten—auch rückwärts erlaubten—Zeitwert, Clock-OwnerIdentity und dessen
owner-lokales PrepareReceipt. Das Receipt bestätigt nur Validierung/Prepare;
es ist weder separater Clock-Commit noch Durabilitybeweis und ersetzt keine
Ratifikation des späteren SMR-07-Ports.

Scene- und Clock-Beitrag werden ausschließlich durch denselben gemeinsamen
Publish-Entscheid sichtbar. Rejoin-Konflikt, stale Revision oder vor Publish
gewonnener Cancel lassen Scene, Clock-Beitrag und alte bestätigte Wahrheit
unveröffentlicht. Nach gewonnenem Publish ist nur Roll-forward über dieselbe
CommandId zulässig: genau der gewählte Zeitwert wird gebunden und ausschließlich
der Clock-Owner erhöht die Target-ClockRevision. I01 modelliert diese gemeinsame
Grenze rein; reale Atomarität, Crash-/Restart- und Durabilitybelege bleiben I02.

### Masken

`MaskParticipationProjection` enthält nur CampaignId, LiveSceneId, MaskId,
MaskKind, OwnerIdentity, OwnerRevision, Teilnehmer-IDs und Lifecycle-Status.
Der Kern berechnet remove/retain/suspend/retire-Pflichten. Er kann niemals eine
Maske starten, abschließen, übertragen oder ihre Fachwirkung ableiten.

## Mehrbesitzer- und Persistenzgrenze

I01 liefert ausschließlich die Portverträge und pure Participants. Die erste
produktive Transaktionsimplementierung gehört in ein späteres Paket und muss
SMR-01 sowie die Plattformentscheidung binden.

Der öffentliche Coordinator-Vertrag kennt:

- genau eine stabile CommandId und einen kanonischen CommandDigest;
- `Stage → Validate → Publish → Verify → Finalize` mit owner-lokalem Prepare;
- gepinnte erwartete OwnerRevisionen und vollständige Participantliste;
- je Participant einen unveröffentlichten, an CampaignId, CommandId,
  CommandDigest, Zielidentitäten und erwartete Revisionen gebundenen Beitrag;
  kein PrepareReceipt darf allein Fachwahrheit publizieren;
- einen einzigen durablen Cancel-vs-Publish-Entscheid;
- `cancelled-before-publish`, `published-pending-finalize`, `finalized`,
  `conflict`, `unavailable` und `unknown-outcome` als unterscheidbare Ausgänge;
- idempotente Reconciliation ausschließlich über ursprüngliche CommandId und
  Receipt;
- keine konkrete API, SQL-Tabelle, Datei, Queue, IPC-Nachricht oder
  Prozesswahl.

Vor einem produktiven Adapter müssen Faulttests die im Fachvertrag geforderte
Matrix, TN-22-Cleanup, späte Worker-/Participant-Antworten, Crash/Restart und
Ressourcenorakel ausführen. Ein In-Memory-Testcoordinator darf diese Semantik
modellieren, ist aber kein Durability- oder Hostnachweis.

## Reference-Owner- und Löschgrenze

I01 modelliert RegistryProjection, Manifest, capability-gebundene
ErasureSlotDefinition, opaque ErasureToken, Tombstone, ClosureReceipt und
RetainedQuarantineSlot nur als validierte Verträge. Der Scene-/Party-Kern darf
keinen fremden Payload öffnen und keinen ErasureToken ausführen.

Permanente Löschung kann im reinen Kern ausschließlich einen gebundenen
Manifest-/Tombstone-Entscheid und owner-lokale Pflichten erzeugen. Byteweise
Erasure, Quarantänespeicher, Import-Rebind und vollständige Audit-/Purgebeweise
bleiben bei SMR-01 beziehungsweise den jeweiligen Capability-Ownern. Ein
unknown Owner oder eine unvollständige Registry scheitert fail-closed.

## Migration und Bestandsschutz

Im Zielrepository existiert noch kein kanonischer Campaign-/Party-/LiveScene-
Produktstore. Deshalb enthält I01 keine automatische Migration und liest weder
Obsidian-Vaults noch SaltMarcher-Datenbanken.

Die spätere Migration muss als getrenntes Paket mindestens beweisen:

1. eine Campaign ohne LiveSession bleibt gültig und erzeugt nichts beim Start;
2. erst ausdrückliches `InitializeLiveSession` erzeugt Primary, ClockRef und
   Focus atomar;
3. Current-Format-Import remappt jede campaignlokale ID und opaque Referenz;
4. Restore bewahrt Identitäten, Copy folgt dem SMR-01-Closure-Vertrag;
5. vorhandene Dungeon-/Atlas-/Stadtdateien und `src/session.ts::Session`
   bleiben unverändert;
6. unbekannte oder beschädigte Daten führen zu atomarer Ablehnung oder
   ausdrücklich bezeichnetem Salvage, nie zu stiller Initialisierung;
7. ein importierter Source-ErasureToken bleibt nicht ausführbar und wird nur
   nach validiertem lokalem Rebind ersetzt.

Fixtures dürfen aus SaltMarcher nur nach gepinnter Revision, Quellenangabe,
Lizenz-/Datenschutzprüfung und explizitem Mapping übernommen werden. Kein
Whole-Branch-Merge und kein Legacy-Parser nur wegen historischer Existenz.

## Acceptance-Harness

I01 legt noch keine Hostabnahme ab. Es schafft den reproduzierbaren Kern für
die 22 Fach-Acceptance-Fälle:

| Suite                              | Verbindlicher Nachweis                                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `live-session-contract.test.ts`    | Parser, deep freeze, IDs/Revisionen, fremde Campaign, unbekannte Felder, keine mutable Aliase                                                      |
| `party-aggregate.test.ts`          | Name-only, Duplikatnamen, Membership, Profile leeren, XP/Rest, keine Scene-Nebenwirkung                                                            |
| `scene-lifecycle.test.ts`          | Initialize, Primary/Focus, A/B/A, Split, Teil-Move, Rejoin, prepared Runtime Scene und deterministic Cleanup                                       |
| `scene-clock-boundary.test.ts`     | frühere/spätere/manuelle Clockentscheidung, stale Revision, keine eigene Zeit-/WorldEffect-Wirkung                                                 |
| `mask-reconciliation.test.ts`      | mehrere Masken, geteilte Teilnehmer, remove/retain/retire, unavailable/stale, keine Completion/Effects                                             |
| `live-session-projection.test.ts`  | active/none/pending/unavailable, stale/fremd/beschädigt fail-closed, immutable Consumergrenze                                                      |
| `party-history.test.ts`            | 100 Schritte, neuer Command für Undo/Redo, Redozweig, Konflikte, irreversible/anonymisierte Löschung                                               |
| `reference-owner-contract.test.ts` | Registryvollständigkeit, Slot-/Target-/Survivor-Bindung, opaque Token, Tombstone und unknown Owner fail-closed                                     |
| `multi-owner-model.test.ts`        | reine Stage-/Validate-/Publish-/Verify-/Finalize-Modellmatrix, Retry, unknown outcome und Cancel-Race                                              |
| `live-session-scale.test.ts`       | 20 Rosterfiguren, vier Scenes, acht ownerqualifizierte Masken, 50 Teilnahmeinzidenzen ohne Truncation/Vermischung; Zeit/DTO-Größe nur diagnostisch |
| `live-session-boundary.test.mjs`   | kein Import von Obsidian, Electron, Node, `fs`, Vault, MapRepository oder Host-UI; kein Passive-Display-Export                                     |

### Vollständige Zuordnung der 22 Fach-Acceptance-Fälle

Die folgende Matrix trennt das in I01 zulässige Modelloracle vom späteren
Realnachweis. Ein I01-PASS schließt niemals eine Spalte rechts davon.

| Acceptance | I01-Modelloracle und zuständiger Slice                                                                                                                                        | Verbleibender Realnachweis                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1          | I01-B: Campaign ohne Session, ausdrückliches Init, Partyreihenfolge, stale/unavailable und idempotentes Receiptmodell                                                         | I02: gemeinsamer durable Publish von Scene/Focus/Clock, Continue/Import/Restart                                    |
| 2          | I01-B: Empty-Scene-Cleanup, genau eine Primary, Prepared getrennt, direkte Primary-Löschung unmöglich                                                                         | I02: persistierter/recoverter Cleanup-Ausgang                                                                      |
| 3          | I01-B: Aktivierung an erwarteten Focus gebunden, Focus-Race stale, kein reguläres `unassigned`                                                                                | I02/I03: durable Pending und sichtbare GM-Rückmeldung                                                              |
| 4          | I01-B: A/B/A-, Campaign- und Membership-Invarianten im Modell/Fuzzer                                                                                                          | I02: gespeicherter Campaignwechsel/Restart                                                                         |
| 5          | I01-B: Split/Teil-Move/Rejoin, Source-Erhalt, Cleanupplan und ortsgebundene opaque Referenzen                                                                                 | I02 plus spätere Karten-/Consumeradapter: durable gemeinsame Wirkung                                               |
| 6          | I01-B: unveröffentlichter Clock-Participant-Beitrag am selben Rejoin, alle Focus-/Primary-/Maskenausgänge                                                                     | I02 + ratifizierter SMR-07-Port: atomarer Publish, Crash/Restart, tatsächliche ClockRevision/WorldEffect-Isolation |
| 7          | I01-B: Deactivate, unavailable Consumer, Pending, Retry und Cleanup im reinen Modell                                                                                          | I02: exactly-once Publish/Reconciliation/Restart                                                                   |
| 8          | I01-C: Tombstone, Registry/Manifest, Slot-/Target-/Before-/After-/Survivor-Verträge, unknown Owner fail-closed                                                                | I02 + echte Capability-Owner: byteweise Erasure, Quarantäne, Audit, Reconnect, Purge und Restart                   |
| 9          | I01-B: mehrere Masken, geteilte Teilnehmer und begrenzte remove/retain-Pflichten                                                                                              | spätere Maskenprovider: reale Teilnehmerreconciliation ohne Fachnebenwirkung                                       |
| 10         | I01-A/B: Focus-only-Diff und frische Consumerprojektion                                                                                                                       | I03: echte Music/Weather/Shops/Karten-Consumerreaktion                                                             |
| 11         | I01-A: none/stale/damaged/foreign fail-closed und nachweislich kein Passive-Display-Export                                                                                    | I03: reale interne Consumer; SMR-10: Player-Null-Leak/Focus-/Displayqualifikation                                  |
| 12         | I01-A/B: serialisierbares Modelloracle für Focus/Scenes/MaskRefs/Pending ohne Auto-Resume                                                                                     | I02/I03: Continue, Restart und unbestätigte Drafts im echten Store/Host                                            |
| 13         | I01-C: ID-/Referenz-Remap-Verträge und Konfliktoracle                                                                                                                         | I02: vollständiger Current-Format Restore/Import mit unabhängiger Campaign                                         |
| 14         | I01-C: Complete/Salvage-/RetainedQuarantine-/Rebind-/OpaqueDiscard-Vertragsfälle                                                                                              | I02: reale Bytes, Medien, Export/Import, beschädigte Daten, Providerwechsel und exactly-once Receipt               |
| 15         | I01-B: Name-only, Duplikatnamen, optionale Profilabwesenheit, stabile ID, inaktiv ohne Scene-Wirkung                                                                          | I02/I03: gespeicherte Formulare und Reopen                                                                         |
| 16         | I01-B: XP/Rest/Adventuring-Day ohne Scene-Diff; Expected Party bleibt fremder Input                                                                                           | I02/I03: persistierte Aktion und sichtbarer Planning-Adapter                                                       |
| 17         | I01-A/B: immutable PreparationSnapshot, neue Runtime-IDs, unabhängige Kopien, Provenienz und getrennter Move                                                                  | I02 + SMR-06-Adapter: gespeicherter Import, Planneränderung, Reopen und Movefehler                                 |
| 18         | I01-B: Completion/Transfer fehlen bewusst; Maskenpflicht kann keine Scene/Folge beenden                                                                                       | spätere Encounter-/Chase-Owner: echte bestätigte Completion-/Transfer-Receipts                                     |
| 19         | I01-C: Modellmatrix für **alle** genannten Commands und Phasen, ursprüngliche CommandId/Receipt, Cancel-vs-Publish, stale Participant/Worker/Callback und Survivor-Invariante | I02/Host: harte Crashs, echte späte Tasks, TN-22 ≤1 s/10 s, Handle-/Queue-/Temp-/Byte-/Prozessmessung              |
| 20         | I01-C: 100 History-Schritte, neue Undo-/Redo-Commands, Redozweig, Konflikte, irreversible/anonymisierte Löschung                                                              | I02: Prozessneustart und durable History/Receipts                                                                  |
| 21         | I01-B/C: 20/4/8/50 ohne Truncation/Vermischung; lokale Zeit nur diagnostisch                                                                                                  | I02/I03/Host: normative TN-21-Livebudgets auf Zielplattformen                                                      |
| 22         | I01-A/B/C: vollständige Namen/Zustände in DTOs ohne farbabhängige Semantik                                                                                                    | I03/SMR-11: echte Tastatur-, 200-%-, Lokalisierungs-, Screenreader-/axe- und Kontrastabläufe                       |

Für Acceptance 19 parametrisiert `multi-owner-model.test.ts` mindestens
Initialize, Split/Rejoin, Teil-Move, Deactivate/Cleanup, permanente Löschung,
QuarantineDiscard, Undo und Redo über Stage, Validate, owner-lokales Prepare,
Publish, Verify und Finalize. Jeder Fall injiziert pre-/post-Publish-Fault,
unknown outcome, frühes/mittleres Cancel, Cancel-vs-Publish-Race sowie verspätete
Participant-, Worker- und Callback-Generationen. Retry nutzt ausschließlich
ursprüngliche CommandId und Receipt. Gewinnt Cancel, bleiben Source, bestehende
Campaigns, shared Definitions und Survivor-Set byte- und semantisch identisch;
gewinnt Publish, erscheint nur der ursprüngliche Roll-forward-Ausgang.
In-Memory-Laufzeit, fehlende DTO-Felder oder ein leerer Importscan zählen weder
als TN-22-/Durability-/Prozessmessung noch als UI-, A11y- oder Null-Leak-
Endabnahme.

Zusätzlich erzeugt ein deterministischer Invariant-Fuzzer mit explizitem Seed
gültige Commandfolgen und prüft nach jedem Schritt:

- nach `InitializeLiveSession` liegt jede aktive CharacterId genau in einer
  scenegebundenen Zuordnung (`assigned XOR pending`); vor der ersten Live
  Session liegt sie in keiner;
- keine inaktive/gelöschte CharacterId liegt in einer aktiven Scene/Mask-
  Projektion;
- genau eine Primary Scene nach Initialisierung;
- Focus ist `none` oder referenziert genau eine aktive Scene derselben Campaign;
- keine retired Scene ist Focus-/Primary-/LiveSession-Quelle;
- Revisionen sinken nie und stale Requests ändern nichts;
- Retry desselben Commands dupliziert weder State noch Reconciliation;
- ein fehlgeschlagener Command lässt den gesamten Eingabegraphen semantisch
  identisch.

Der Seed und die minimale reproduzierende Folge werden bei einem Fehler
ausgegeben. Zufällige Testzahlen ersetzen keinen der benannten Golden-/Fault-
Fälle.

## Geordnete Implementierungsslices

### I01-A – Verträge und Projektionen

- IDs, Revisionen, Parser und immutable DTOs;
- Party-/Focus-/LiveScene-/LiveSession-Projektionsbuilder;
- negative Boundary-Tests einschließlich fehlender Passive-Display-Oberfläche;
- keine Zustandsmutation und keine Ports.

Abschluss: eigener Implementation-Commit, `npm run check`, gezielte Tests,
vollständiges `npm test`, unabhängiger Review. Ein PASS öffnet nur I01-B.

### I01-B – Pure Party-/Scene-Aggregate

- Initialize, Roster/Membership, Focus, Split, Move, Rejoin und Cleanup;
- Clock-/Masken-/Consumerentscheidungen ausschließlich als opaque Inputs und
  Reconciliation-Ausgaben;
- immutable Prepared-Runtime-Kopie samt Provenienz und getrenntem Move;
- Invariant-Fuzzer und reine Modellorakel für Acceptance 1–7, 9–12, 15–18
  sowie die nichtnormative Scale-/DTO-Seite von 21–22. History aus Acceptance
  20 bleibt vollständig I01-C; echte Persistenz-, Performance- und UI-Gates
  bleiben I02/I03/SMR-11.

Abschluss: getrennte Implementation, Review, Repair und Re-review.

### I01-C – History, Lösch- und Coordinator-Verträge

- C01: providerneutrale Registry-, Manifest-, Slot-, Token-, Tombstone- und
  Receipt-Kernverträge samt Parsern;
- C02: Portability-/RetainedQuarantine-Verträge;
- C03: bounded PartyHistory und kausale Undo-/Redo-Pläne;
- C04: reines Delete-/Closure-Entscheidungsmodell;
- C05: In-Memory-Modell für fünf Phasen, Cancel-vs-Publish und Faultmatrix;
- Modellorakel für Acceptance 8, 13, 14, 19 und 20 einschließlich vollständiger
  Command-/Phase-/Survivor-Zuordnung;
- keine echte Erasure, Persistenz oder Prozessarbeit.

Abschluss: getrennte Implementation, Review, Repair und Re-review. Die
Faultmodelltests sind kein SMR-01-/Host-PASS.

### I02 – Persistenter Campaign-/Recovery-Adapter

Erst nach ratifiziertem SMR-01-Port und passender Plattformentscheidung:
durable Transaction, Receipts, Restart/Reconciliation, Backup, Import/Export,
Quarantäne und Migration. Eigene Host-/Crash-/Denied-write-/Low-space-
Abnahmen; nicht Teil von I01.

### I03 – GM-Anwendung und Consumeradapter

Erst nach ADR-/UI-Gate: Roster-, Party-, Scene-, Focus- und Pending-UX,
Tastatur/200 Prozent/Lokalisierung sowie Music/Weather/Shops/Karten-
Consumeradapter. Kein Passive Display; dessen sichere Projektion bleibt SMR-10.

## Review- und Übergaberegel

- Chronik besitzt den I01-Domänen-/Source-Scope.
- Campaign/Data prüft nur Campaign-, Transaktions-, Import-/Recovery- und
  Reference-Owner-Grenzen, sobald ein konkretes Paket diese berührt.
- Music/Weather/Shops prüft nur die immutable Consumerprojektionen.
- Encounter-/Chase-Owner prüfen erst konkrete Maskenproviderverträge; der
  generische Lifecycle verleiht keine Encounter-Fachautorität.
- Cloud-Architektur/Technik prüft Contract-, Capability-, Prozess-,
  Cancellation- und Recovery-Realisierbarkeit, nicht Fachbesitz.
- Gleichrangige Kollegen erzeugen ihre eigenen Reviewartefakte. Ein lokaler
  Zugangsblocker darf durch einen von ihnen selbst erzeugten Commit belegt
  werden; niemand formuliert ihre Fachantwort stellvertretend.

Vor I01-A sind für diesen Plan erforderlich:

1. unabhängiger Exact-SHA-Architektur-/Technikreview;
2. konkrete `PASS`- oder `CHANGES_REQUIRED`-Befunde in Issue #6;
3. Repair und Re-review bis keine Pflichtlücke im Plan-Scope verbleibt;
4. ausdrücklicher Start eines getrennten Implementation-Commits auf aktueller
   Shared-Basis.

Ein Plan-PASS ist keine Produkt-, Host-, Persistenz-, Acceptance- oder
Gesamtfreigabe.

#### Arbeitsstand #90 / #143 / #147

I01-A ist über PR #88 als Shared-SHA
`d9eda92f8270b364322e3c9a4cb2af5c2c69c8f7` integriert. I01-B ist über seine
getrennten Kandidaten vollständig in Shared integriert und in Issue #90 im
reinen Modellscope abgeschlossen. I01-C01 ist über PR #146 als Shared-SHA
`9527c2da76b674934827bb3bf3773eebc453b45f` integriert. C02 bis C05 sind in
Issue #147 als ein Lifecycle-Paket auf `codex/smr-03-i01c-lifecycle`
beansprucht; die Teilschritte sind interne Reviewgrenzen, keine getrennten
Kleinstpakete.

Bereits unabhängig bestätigt sind strikte immutable Aggregatezustände,
Initialize, Prepared Runtime, Focus und Move samt Cleanup sowie ownergebundene
Pending-Reconciliations. Die Zwischenreparaturen `fdf6271` und `a83a74f`
schließen die damaligen Prepared-, Pending-, OwnerRevision- und
Zuordnungsbefunde; ihre engen Re-reviews sind `PASS`.

Party-Checkpoint `2d563fc` ergänzt explizite CharacterId-/Name-only-Erstellung,
Duplikatnamen, vollständige Profilersetzung mit echter optionaler Abwesenheit,
validierte XP-/Fortschrittskorrektur und ausgewählte Short-/Long-Rests; seine
Campaign/Data- und Architektur-/Technikreviews sind `PASS`.

Membership-Repair `490ed3277c94b166a97acca8ec796f1cd4ee7544`
implementiert Aktivierung und Deaktivierung samt gebundenem Primary-/Focus-
Cleanup. Architektur/Technik, Campaign/Data und Music/Weather/Shops bestätigen
den Exact-SHA in ihren getrennten Grenzen mit `PASS`.

Split/Rejoin folgt den Entscheidungen `6104445781`, `6104600781`, `6104762364`
und der Clock-Owner-Ratifikation `6104896713`. Der Slice enthält strikt
geparste `prepared-unpublished` Clock-Fork-/Merge-Beiträge, diskriminierte
created-/existing-Endpunkte, Partyreihenfolge, gebundene Primary-/Focus-
Ausgänge sowie source-only Consumerpflichten ohne Location-, Content-,
Preparation- oder Consumertransfer.

Der reparierte Split/Rejoin-Source-/Test-SHA
`f9f07f90ac558ead4b7f4ba130fea3e37241ebba` ist durch Architektur/Technik/Clock
`6105053957`, Campaign/Data/Party `6105042948` plus `6105186943` und
Music/Weather/Shops `6105196543` jeweils `PASS`. Der vollständige Lauf steht
bei 1035 PASS, null FAIL und einem beabsichtigten Skip; Typecheck, Build, Repo-
und Diff-Check sind grün. Der reine Dokumentationsstand danach ist
`af842015822cdc4a3c6bb0b39a26058181c0fb88`.

Der providerneutrale Masken-Slice ist über PR #123 als Shared-Merge
`dbcecc79870252a9b6dae4b9a7959bb47bf5fc96` integriert. Der Exact-SHA
`cfa86479cbc2307d547694b90c56a0425d2e413b` bestand Candidate-CI sowie die
getrennten Architektur/Technik-, Campaign/Data- und Music/Weather/Shops-
Reviews; auch der Shared-Integrationslauf ist grün.

Der deterministische Invariant-Fuzzer und das nichtnormative Scale-/DTO-Orakel
sind über PR #134 als Shared-Merge
`7953019cd2121c3d56bc7350ed6256d54c2f5029` integriert. Der Exact-SHA
`12ecb93c13ca025f58c4aa287e48b6130787648e` bestand Candidate-CI sowie die
getrennten Architektur/Technik-, Campaign/Data/Party- und
Music/Weather/Shops/Consumer-Reviews; auch der Shared-Integrationslauf ist
grün. Das Orakel bindet 20 Rosterfiguren, vier aktive Scenes, acht
ownerqualifizierte Masken und exakt 50 Masken-Teilnahmeinzidenzen. Die 50 sind
ausdrücklich keine 50 eindeutigen CharacterIds. Laufzeit und serialisierte
DTO-Größe werden nur diagnostisch ausgegeben und bilden keine Host-,
Plattform- oder Produktgrenze.

Damit sind alle für I01-B geplanten reinen Aggregate-, Masken-, Fuzzer- und
Scale-Pakete sowie I01-C01 in Shared integriert. Das laufende Paket #147
ergänzt bounded PartyHistory mit kausalem Undo/Redo, importgebundene
RetainedQuarantine-/Portability-Entscheidungen, irreversible
Delete-/Closure-Entscheidungen und das vollständige In-Memory-Fünfphasenmodell.
Ein integrierter Golden-Master verbindet Preparation, Move, Rejoin, History
und permanente Closure. Dieser Arbeitsstand ist kein Host-, Persistenz-,
Durable-, UI-, Acceptance- oder Gesamtprodukt-PASS.

Der Masken-Slice bewahrt vollständige owner-/scenegebundene Prepared-Beiträge
als modelllokale Append-/Replay-Evidenz und validiert Projektionen direkt gegen
MaskRef, Ownerstatus und ownerlokale Reihenfolge. Diese Evidenz ist ausdrücklich
kein selbstauthentifizierender Persistenzanker: Ein frei ersetzbares
`LiveSceneSource` kann keine koordinierte Umschreibung seiner eigenen
Historien-, Basis- und Head-Felder beweisen. Die Architekturentscheidung
`6106174355` hält deshalb die I01-B-Grenze aufrecht; ein späterer
manipulationssicherer Verlauf benötigt zuerst eine separat bezogene
Owner-/Generations-Authority samt verifizierbarem Receipt-Head in I02.

Konkrete Encounter-/Chase-Fachlogik bleibt außerhalb des generischen
Masken-Lifecycles. Permanente Löschung, History, Portability-Verträge und
Coordinator gehören vollständig zu I01-C; Host, Persistenz, Durability und UI
bleiben I02/I03. Kein bisheriger Checkpoint behauptet einen
Produkt-Gesamtpass.
