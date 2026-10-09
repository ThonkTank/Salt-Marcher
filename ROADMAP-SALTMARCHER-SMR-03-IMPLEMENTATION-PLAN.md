# SMR-03-I01 – Hostneutraler Party-/Scene-/Live-Session-Kern

Status: **Plan-Kandidat vor unabhängigem Architektur-/Technikreview; kein
Produktcode-, Persistenz-, Host- oder Implementierungs-Go.**

## Gebundener Stand

- Fachvertrag:
  `ROADMAP-SALTMARCHER-SMR-03-LIVE-SCENE-CONTRACT.md` auf dem semantischen
  Exact-SHA `0254d575e61df130b3f85dbcef810faef54ce0d5`.
- Exact-SHA-Architekturreview: Issue #6, Kommentar `6088985728`, `PASS`.
- Source-Owner-Ratifikation: Issue #6, Kommentar `6088996383`.
- Music/Weather/Shops-Consumer-Ratifikation: direkt erzeugter und unverändert
  integrierter Commit `ed755aedd1dd3d2a85556ce51ed576b25527595d`.
- Aktueller integrierter Shared-Ausgangspunkt:
  `bf98471bca2264732a363bd81e5a6325da6ddbd8`.
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

| Gate | Aktueller Zustand | Wirkung auf SMR-03 |
| --- | --- | --- |
| SMR-03-Semantik und aktuelle Owner | für den gebundenen SHA reviewt/ratifiziert | I01 darf geplant und nach Plan-PASS als reiner Kern umgesetzt werden |
| SMR-01 Campaign-/Transaktionsvertrag | Kandidat, nicht als Produktadapter freigegeben | keine persistente Mutation, kein Import/Export und kein Recovery-Adapter in I01 |
| SMR-07 Clock-/Travel-Vertrag | reviewte Semantik, getrennt ratifikationspflichtig | I01 speichert nur opaque `SceneClockRef` und erwartet revisionierte Entscheidungen; keine eigene Uhr |
| SMR-00-ADR-01 | vorgeschlagen, P01–P04/C01 nicht vollständig entschieden | keine neue Obsidian- oder Desktopkopplung und keine IPC-/SQLite-/Fensterwahl |
| Encounter/Chase-Fachowner | Runtime-Mask-Lifecycle nur eng ratifiziert | nur Maskenidentität, Teilnehmer-Reconciliation und Lifecycle-Status; keine Regeln, HP, Initiative, Completion oder Effects |
| Passive Display | Consumer-Owner offen | kein Export, Kanal, DTO, Subscription oder Rendering aus der internen Source |

Fehlt ein erforderlicher Owner oder liefert ein Port `unavailable`, bleibt der
reine Kern lesbar und erzeugt ausschließlich den normierten Pending-/Fail-
Closed-Ausgang. Ein fehlender Adapter wird nicht durch einen Dummy ersetzt.

## Geplante Modulgrenzen

I01 ergänzt ausschließlich `src/features/live-session/` und gezielte Tests.
Der bestehende Dungeon-Typ `src/session.ts::Session`, Atlas-/City-Scenes,
MapRepository und aktuelle Obsidian-Views werden weder umbenannt noch als
Fachzustand wiederverwendet.

| Datei | Verantwortung | Darf nicht enthalten |
| --- | --- | --- |
| `ids.ts` | gebrandete Campaign-, Character-, Party-, LiveScene-, Mask-, Command- und Owner-IDs; zentrale Parser | Pfade, Hosthandles oder generierte Zufallswerte |
| `contracts.ts` | readonly DTOs, Revisionen, Lifecycle-Enums und parse-/assert-Funktionen | Repository-, UI- oder Fachowner-Implementierung |
| `state.ts` | immutable `PartyState`, `SceneState`, `LiveSessionState`, Tombstone-/Pending-Referenzen | Consumerzustände fremder Fachbereiche |
| `commands.ts` | diskriminierte, revisionierte Command-Requests und fachliche Ergebnis-/Konflikttypen | direkte Writes, globale Singletons oder UI-Callbacks |
| `party-aggregate.ts` | Roster, Membership, Profile, XP/Rest, PartyRevision und History-Entscheidungen | SceneClock, Encounter-, Shop-, Weather- oder Music-Wahrheit |
| `scene-aggregate.ts` | Primary, Focus, Scene-Zuordnung, Split/Rejoin, Empty-Scene-Cleanup und SceneRevision | Partyprofil, Karteninhalt, Clockwert oder Maskenpayload |
| `mask-reconciliation.ts` | owner-neutrale Teilnehmer-/Retirement-Pflichten mit erwarteten Revisionen | Encounter-/Chase-Regeln, Completion oder Effects |
| `projections.ts` | tief eingefrorene Party-, Focus-, LiveScene- und LiveSession-Projektionen | Playerprojektion oder private Daten fremder Owner |
| `coordinator-contract.ts` | Stage/Validate/Publish/Verify/Finalize-, Cancel-, Receipt- und Pending-Verträge | konkrete Transaktion, Dateisystem, SQL oder IPC |
| `reference-owners.ts` | Registry-/Manifest-/Erasure-Slot- und Quarantäne-Vertragstypen | frei interpretierbare Pfade, SQL-Schlüssel oder fremde Payloads |
| `history.ts` | bounded 100-step PartyCommandHistory, kausale Undo-/Redo-Pläne und irreversible Tombstonegrenzen | SMR-07-Campaign-History oder rekonstruierbare gelöschte Personendaten |
| `index.ts` | ausdrücklich freigegebene öffentliche Kernoberfläche | Hostadapter oder Convenience-Reexport fremder Interna |

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
5. Scene splitten beziehungsweise eine leere Prepared Runtime Scene erzeugen;
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
akzeptiert ausschließlich eine bereits durch SMR-07 bestätigte
`ClockMergeDecision` mit Source-/Target-ClockRef, erwarteten ClockRevisionen,
gewähltem resultierendem Wert und DecisionReceipt. Der Scene-Kern bindet die
Referenz an den Moveplan; nur der Clock-Owner darf die Target-ClockRevision
erhöhen.

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

| Suite | Verbindlicher Nachweis |
| --- | --- |
| `live-session-contract.test.ts` | Parser, deep freeze, IDs/Revisionen, fremde Campaign, unbekannte Felder, keine mutable Aliase |
| `party-aggregate.test.ts` | Name-only, Duplikatnamen, Membership, Profile leeren, XP/Rest, keine Scene-Nebenwirkung |
| `scene-lifecycle.test.ts` | Initialize, Primary/Focus, A/B/A, Split, Teil-Move, Rejoin, prepared Runtime Scene und deterministic Cleanup |
| `scene-clock-boundary.test.ts` | frühere/spätere/manuelle Clockentscheidung, stale Revision, keine eigene Zeit-/WorldEffect-Wirkung |
| `mask-reconciliation.test.ts` | mehrere Masken, geteilte Teilnehmer, remove/retain/retire, unavailable/stale, keine Completion/Effects |
| `live-session-projection.test.ts` | active/none/pending/unavailable, stale/fremd/beschädigt fail-closed, immutable Consumergrenze |
| `party-history.test.ts` | 100 Schritte, neuer Command für Undo/Redo, Redozweig, Konflikte, irreversible/anonymisierte Löschung |
| `reference-owner-contract.test.ts` | Registryvollständigkeit, Slot-/Target-/Survivor-Bindung, opaque Token, Tombstone und unknown Owner fail-closed |
| `multi-owner-model.test.ts` | reine Stage-/Validate-/Publish-/Verify-/Finalize-Modellmatrix, Retry, unknown outcome und Cancel-Race |
| `live-session-scale.test.ts` | 20 Rosterfiguren, vier Scenes, acht Masken, 50 Teilnehmer ohne Truncation/Vermischung; Zeitmessung nur als lokaler Vorbeleg |
| `live-session-boundary.test.mjs` | kein Import von Obsidian, Electron, Node, `fs`, Vault, MapRepository oder Host-UI; kein Passive-Display-Export |

Zusätzlich erzeugt ein deterministischer Invariant-Fuzzer mit explizitem Seed
gültige Commandfolgen und prüft nach jedem Schritt:

- nach `InitializeLiveSession` liegt jede aktive CharacterId genau in einer
  Scene; vor der ersten Live Session liegt sie in keiner;
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
- Invariant-Fuzzer und semantische Acceptance 1–7, 9–12, 15–18, 20–22.

Abschluss: getrennte Implementation, Review, Repair und Re-review.

### I01-C – History, Lösch- und Coordinator-Verträge

- bounded PartyHistory und kausale Undo-/Redo-Pläne;
- Tombstone-/Registry-/Manifest-/RetainedQuarantine-Verträge;
- In-Memory-Modell für fünf Phasen, Cancel-vs-Publish und Faultmatrix;
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
