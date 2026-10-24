# SMR-03-P01: Party-, LiveScene- und Live-Session-Vertrag

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Aktueller Verfolgungsanschluss und konkrete Restlieferung: [Chase als Scenemaske](chase.md).

Aktuelle Datenanschlüsse und Folgelieferungen: [Kampfentwürfe und Nachbereitung](combat-recovery.md), [Quest-/Gerüchtabschluss](narrative-recovery.md).

Abschnitte: [Normativer Lebenszyklus](smr03-live-scene-contract.md#normativer-lebenszyklus) · [Mehrbesitzer-Commit und Recovery](smr03-live-scene-contract-2.md#mehrbesitzer-commit-und-recovery) · [Party-Command-History und kausales Undo/Redo](smr03-live-scene-contract-2.md#party-command-history-und-kausales-undoredo) · [Offene Produktanschlüsse](smr03-live-scene-contract-3.md#offene-produktanschlüsse) · [Kernverträge und Umsetzung](smr03-live-scene-contract-4.md#kernverträge-und-umsetzung)

Historische Modell- und Hostnachweise stehen in `acceptance.json`. Sie belegen ihren damaligen Umfang, keine aktuelle vollständige Produktabnahme.

## Technische Anschlussentscheidung vom 11.10.2026

Fachliche Party-/Scene-/Masken-/Zeit-/Erasurewirkungen bleiben verbindlich.
[ARCHITECTURE](../../project/architecture/overview.md) ersetzt die früher vorgeschlagene
interne Mehrbesitzercommitmechanik: ein lokaler Writer, eine SQLite-Transaktion
für Records/Folgen/Receipt, geprüfte Revision/Context/Rechte an dieser Grenze.
Fachlicher Owner bedeutet Invariantenverantwortung, keinen separaten Writer.
Vorhandene Kern-APIs sind Istbefund ohne Bestandsschutz; Nutzerinhalte und
extern gebundene Formate bleiben geschützt.

## Fachliche Quellen

Maßgeblich ist SaltMarcher-Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, insbesondere:

- `docs/project/vision.md`;
- `docs/project/requirements/requirements-program-capabilities.md`, vor allem
  `Roster, Current Party, And Planning Party`, `Continuous Scene State And
  Party Splits`, `Masks And Prepared Monster Groups`, `Live Search, Creation,
  Notes, And Music`, `Independent Time And Weather`, `Continuous Preservation
  And Resume` und die Cross-Workflow-Verträge;
- `docs/party/requirements/`, `docs/party/domain/domain-party.md` und
  `docs/party/contract/contract-party-persistence.md`;
- `docs/scene/requirements/requirements-scene.md`,
  `docs/scene/domain/domain-scene.md` und
  `docs/scene/contract/contract-scene-persistence.md`;
- `docs/session/requirements/requirements-live-session.md`,
  `docs/session/domain/domain-live-session.md` und
  `docs/session/contract/contract-live-session-persistence.md`;
- `docs/project/architecture/program-technical-needs.md`, insbesondere
  TN-01 bis TN-03, TN-05, TN-07, TN-11, TN-15 bis TN-19, TN-21, TN-22, TN-24,
  TN-27, TN-28, TN-31, TN-34 und TN-36.

Im Zielrepository bindet dieser Kandidat die reviewte SMR-07-Vertragssemantik
`94b1a15990b11a0cc00f3091ef24130a19a263a2` sowie den reviewten
SMR-01-Kandidaten `11e256309d43bcd1c14db66ffc41945c9360aec8` ein.
Beide benötigen eigene Fachverträge und Nachweise. Java-, JavaFX-, Electron-,
JDBC- und historische Obsidian-Implementierungen sind ausschließlich
Verhaltensreferenzen, keine Zielarchitektur.

## Umfang und Nichtziele

Der hostneutrale Fachvertrag umfasst Campaign-Roster,
aktuelle Party, LiveScene-Identität und -Zuordnung, Primary Scene, Fokus,
Split/Rejoin, generische Runtime-Masken sowie die Live-Session-Projektion. Er
definiert noch keine TypeScript-API, SQL-Tabelle, Datei, IPC-Nachricht, UI,
konkrete Maskenimplementierung oder Plattform.

Ausdrücklich außerhalb dieses Besitzes bleiben:

- Campaign-Lifecycle, Import/Export und physische Recovery (SMR-01);
- SceneClock, Kalender, Travel-Checkpoints, Campaign History und WorldEffects
  (SMR-07);
- Encounter-, Chase-, Loot-, Music-, Weather-, Shop-, Karten- und
  Passive-Display-Fachwahrheit;
- bestehende `src/session.ts::Session` als Dungeon-Editiersession,
  `src/features/city/scene.ts` als Render-/Hit-Test-Projektion und
  `AtlasHistory` als Kartenhistory;
- Host-, Prozess-, Capability-, Datenbank- und Dateisystementscheidungen.

## Begriffe und Eigentümer

| Wahrheit | Autoritativer Eigentümer | Grenze |
| --- | --- | --- |
| Campaign-Identität und Nutzbarkeitsrevision | SMR-01 | kann ohne initialisierte Live Session gültig existieren |
| Roster, CharacterId, aktuelle Party-Mitgliedschaft und Charakterprofil | Party | eine Campaign hat höchstens eine aktuelle Party; Profile bleiben Party-Wahrheit |
| PartyCommandHistory | Party-History | letzte 100 bestätigte Party-/Rosteraktionen mit owner-lokalen Vorher-/Nachher-Fakten und unveränderlichen Receipts; nicht SMR-07 Campaign History |
| ReferenceOwnerRegistryProjection | Campaign-Capability-Registry | revisionierte vollständige fachliche Deklaration aller Owner und Payloadklassen, die Character-Referenzen halten können; Host transportiert, entscheidet aber keine Fachzugehörigkeit |
| LiveSceneId, Primary-Rolle, Scene-Zuordnung, Focus und SceneRevision | SMR-03 Scene | besitzt keine Party-Mitgliedschaft, Uhr, Karte oder Maskenfachlogik |
| SceneClock und Zeitrevision | SMR-07 | genau eine unabhängige Uhr je existierender LiveScene |
| Encounter, Chase oder weitere Runtime-Maske | jeweiliger Maskenbesitzer | Scene hält nur ratifizierte Identität, Teilnahmeprojektion und Reconciliation-Status |
| LiveSession | lesende Komposition | projiziert die fokussierte Scene und besitzt keine zweite Party-, Gruppen- oder Maskenwahrheit |
| Shell-/Fensterzustand | Präsentationsbesitzer | niemals Campaign-, Party-, Scene- oder Maskenfachwahrheit |

`LiveScene`, `DungeonEditSession` und `CitySceneProjection` bleiben in allen
späteren Typen, Dateinamen und UI-Texten eindeutig unterscheidbar.

## Normativer Lebenszyklus

### Campaign vor der ersten Live Session

Eine neu erzeugte, kopierte oder importierte Campaign darf gültig keine
LiveScene, Primary Scene, Focus-Referenz oder SceneClock besitzen. Eine reine
Campaign-Lifecycle-Operation darf keine Scene als Nebenwirkung erzeugen.

`InitializeLiveSession` ist eine ausdrückliche, idempotente GM-/Continue-Aktion.
Sie erzeugt genau eine Primary LiveScene, deren SceneClock und den ersten
gültigen Focus. Der Befehl liest eine revisionierte Party-Projektion und ordnet
alle dort aktiven CharacterIds in ihrer bestehenden Partyreihenfolge atomar der
neuen Primary Scene zu; bei leerer Party ist die Primary Scene leer. Ist Party
nicht verfügbar oder ihre Revision bei Validate stale, scheitert die gesamte
Initialisierung sichtbar und veröffentlicht weder Scene noch Focus oder Clock.
Eine aktive, unzugeordnete Party neben einer veröffentlichten leeren Primary
Scene ist kein zulässiger Zwischen- oder Recoveryzustand. Eine Wiederholung mit
derselben CommandId liefert dasselbe Receipt; ein bereits initialisierter
Zustand wird nicht dupliziert. Der Anwendungsstart bleibt auf der
Campaign-Auswahl. Erst ausdrückliches Continue lädt die gespeicherte
Live-Session-Projektion; es gibt kein verborgenes automatisches Session-Resume.

Ein vollständiger Import mit bereits vorhandenem Live-Session-Zustand remappt
dessen Scenes und Zuordnungen nach SMR-01 und ruft keine Initialisierung auf.
Nur eine gültige Campaign ohne LiveScene benutzt den obigen Initialisierungsweg.
Beschädigte oder mehrdeutige importierte/gesicherte Scene-Zustände werden durch
Recovery beziehungsweise disclosed Salvage behandelt und niemals durch eine
synthetische leere Scene verdeckt.

Nach erfolgreicher Initialisierung existiert immer genau eine Primary Scene.
Wenn keine Partyfigur aktiv ist, bleibt eine leere Primary Scene verwendbar.
Die Primary Scene kann nicht direkt gelöscht werden. Wird sie durch eine
bestätigte Deaktivierung, permanente Löschung, einen Move oder Rejoin leer,
entscheidet der unten festgelegte Empty-Scene-Cleanup in derselben
Party-/Scene-Veröffentlichungsgrenze über Primary, Focus, Clock und Retirement.
Eine leere letzte Primary Scene wird nie entfernt.

### Party und Scene-Zuordnung

- Roster und aktuelle Party-Mitgliedschaft bleiben Party-Wahrheit. Scene
  speichert nur stabile CharacterId-Referenzen und deren Reihenfolge.
- Im stabil synchronisierten Zustand gehört jede aktive Partyfigur genau einer
  LiveScene derselben Campaign an; inaktive Figuren gehören keiner Scene an.
- Aktivierung nennt eine konkrete Ziel-LiveSceneId, die aus einer validierten
  Focus-Projektion gewonnen wurde, sowie erwartete Campaign-, Party-, Scene-
  und Focus-Revisionen. Ein späterer Focuswechsel lenkt den Befehl niemals auf
  eine andere Scene um. Die bestätigte programmweite Regel und TN-07, nach der
  Aktivierung unmittelbar der fokussierten Scene zuordnet, ersetzt hier die
  ältere phasenlokale `unassigned`-Aktivierung aus `requirements-scene.md` und
  `requirements-party-window.md`. `pending` bezeichnet ausschließlich eine
  gespeicherte abhängige Reconciliation und ist kein regulärer unassigned-
  Partyzustand.
- Deaktivierung ist im Party-Besitzer autoritativ. Die Figur wird aus jeder
  Scene und allen Masken entfernt. Fehler in nichtdestruktiven abhängigen
  Projektionen rollen die Party-Entscheidung nicht zurück, sondern erzeugen
  ausschließlich betroffene, sichtbare Reconciliation-Pflichten.
- Permanente Charakterlöschung veröffentlicht genau einmal eine autoritative
  Party-Löschung samt nichtrekonstruktivem Tombstone und geschlossenem
  `ReferenceOwnerManifest`. Verfügbare Besitzer entfernen ihre Live-Referenz im
  selben Publish; registrierte unavailable Besitzer werden darin quarantined
  und sichtbar pending. Ein unbekannter oder nicht registrierter möglicher
  Referenzbesitzer ist vor Publish fail-closed. Die beim Stage gepinnte
  RegistryRevision wird unmittelbar vor Publish erneut validiert; Install-,
  Enable-, Disable- oder Reconnect-Races brechen stale ab. Tombstone-Guards an jeder
  Projektion verhindern trotz alter quarantined Bytes Live-Mitgliedschaft,
  Teilnahme, Undo-Ergebnis oder Resurrection. Erst vollständige Closure aller
  Manifesteinträge erlaubt den getrennten irreversiblen physischen Purge.
- Eine Scene-Bewegung erhält Party-Mitgliedschaft und verschiebt eine Figur
  atomar zwischen genau zwei Scene-Zuordnungen. Ein Split kann eine neue Scene
  anlegen; der gemeinsame Befehl lässt den Location-Eigentümer dieselbe
  bestätigte Location referenzieren und den Time-Eigentümer eine neue,
  unabhängig revisionierte SceneClock am bestätigten Quellzeitpunkt anlegen,
  ohne fremde Interna zu kopieren.
- Ein Rejoin löscht weder ortsgebundene Inhalte noch bestätigte Geschichte.
  Gepinnte oder ausdrücklich mitreisende Referenzen folgen nur nach ihrer
  eigenen bestätigten Regel.
- Batch-Auswahl, Aktivierung, Deaktivierung und Move validieren die vollständige
  Auswahl vor Veröffentlichung, führen erwartete Party- und Scene-Revisionen
  mit und wiederholen einen unbekannten Ausgang nicht blind.

#### Deterministischer Empty-Scene-Cleanup

Nach jeder autoritativen Membership-Mutation, die eine Source Scene leeren
kann—Deaktivierung, permanente Löschung, Move oder Rejoin—enthält derselbe
Command ein revisioniertes `SceneCleanupPlan`; der veröffentlichte Receipt
bindet den vollständigen Membership-, Primary-, Focus-, Clock- und
Retirement-Ausgang. Prepared-Import-Drafts sind bis zum ersten bestätigten
Teilnehmer-Move eine getrennte, nicht aktive Lifecycle-Klasse: Sie sind weder
Primary-/Focus-Kandidat noch ein Grund, eine aktive leere Scene zu behalten.

- Enthält die Source nach der Mutation noch mindestens eine aktive Figur,
  bleibt sie dieselbe aktive LiveScene. Primary und Focus bleiben erhalten,
  ihre SourceClock wird weder archiviert noch finalisiert und Scene-weite
  Masken-/Ambience-/Weather-/Shop-Zustände werden nicht suspendiert. Ein
  Teil-Move reconciled nur die tatsächlich bewegten Teilnehmer.
- Wird die Source leer und bleibt mindestens eine andere bevölkerte Scene,
  wird die leere Source im selben fachlichen Entscheid retired. War sie
  Primary, wird `PrimarySuccessorSceneId` deterministisch gebunden: zuerst die
  ausdrücklich benannte bevölkerte Move-/Rejoin-Target-Scene, sonst eine andere
  aktuell fokussierte bevölkerte Scene, sonst die Scene der ersten verbleibenden
  aktiven CharacterId in autoritativer Partyreihenfolge. Eine nicht-Primary
  Source ändert die bestehende Primary nicht.
- Zeigt Focus auf eine retired Source, bindet der Cleanupplan den Focus-
  Nachfolger: bei Move/Rejoin die ausdrücklich benannte bevölkerte Target-
  Scene, sonst die daraus resultierende Primary. Der Wechsel erhöht die
  FocusRevision monoton. Focus auf einer anderen gültigen Scene sowie `none`
  bleiben unverändert. Erst das Retirement archiviert/finalisiert die
  SourceClock; weder ihr letzter Zeitwert noch eine Scene-weite
  Consumerprojektion wird als aktueller Target-Zustand übertragen.
- Ist nach der Mutation keine Partyfigur aktiv, bleibt die bisherige Primary als
  genau eine leere aktive Primary erhalten. Alle übrigen durch denselben
  Entscheid leer gewordenen aktiven Scenes werden retired; Prepared-Import-
  Drafts bleiben davon getrennt. Ein Focus auf die erhaltene Primary bleibt
  gültig, ein Focus auf eine retired Scene wechselt auf diese Primary.
- Retirement entfernt keine persistenten Location-Inhalte und inferiert weder
  Masken-/Encounter-Completion noch Transfer oder Folgen. Verfügbare Consumer
  archivieren beziehungsweise suspendieren ausschließlich Source-gebundene
  Masken und Overrides; unavailable Consumer werden sichtbar pending und dürfen
  weder alte Membership noch die retired Source als live projizieren.

Ein unavailable abhängiger Scene-, Masken- oder Consumer-Owner rollt die
autoritative Party-Mutation nicht zurück. Der gebundene `SceneCleanupPlan` und
sein Receipt werden genau einmal veröffentlicht; betroffene Owner reconciliieren
idempotent nach Restart oder Retry. Bis dahin unterdrücken Tombstone-,
Membership- und Retirement-Guards jede stale aktive Source-/Teilnehmerprojektion,
während unbetroffene Scenes nutzbar bleiben.

Während einer nichtdestruktiven abhängigen Reconciliation wird eine betroffene
Figur nicht aus einer veralteten Scene- oder Maskenprojektion als aktuell
angezeigt. Stattdessen zeigt die Live Session ihre stabile CharacterId, die
beabsichtigte Zielgrenze und einen strukturierten Pending-/Retry-Zustand.
Nach permanenter Löschung zeigt sie nur Tombstone-/Closure-Status ohne
rekonstruktiven Character-Payload oder live auflösbare CharacterId. Unbetroffene
Scenes und Masken bleiben verwendbar.

### Party-, Roster- und Adventuring-Day-Projektion

Eine immutable `PartyProjection` enthält mindestens CampaignId, PartyRevision,
die geordneten Rostereinträge mit stabiler CharacterId, explizite
active/inactive-Mitgliedschaft, optionale Profilwerte mit echter Abwesenheit,
XP-/Level-/Rest-Fakten sowie pro aktiver Figur die bestätigte LiveSceneId oder
einen strukturierten Pending-Zustand. Namen sind nicht identitätsstiftend.

- Name-only-Erstellung erzeugt immer eine inaktive Rosterfigur ohne Scene- oder
  Travel-Zuordnung. Optionale Spieler-, Spezies-, Klassen-, Sprach-, Level-,
  Passive-, RK- und Bewegungswerte bleiben abwesend und werden nicht durch
  Sentinel- oder Defaultwerte ersetzt.
- Profiländerung, XP-Zuteilung/Korrektur, Rest und Party-Mitgliedschaft sind
  getrennte Party-Befehle. XP und Rest verändern keine Scene-Zuordnung; nur
  Aktivierung, Deaktivierung, Löschung oder ein ausdrücklicher Scene-Move tun
  dies über die gemeinsame Grenze.
- Charakterlöschung entfernt verfügbare Live-Referenzen und die lebende Party-
  Projektion in derselben bestätigten Grenze. Unavailable Ownerdaten bleiben
  ausschließlich quarantined und werden durch Tombstone/Manifest nie als live
  auflösbar. Abgeschlossene historische Fakten zeigen die permanent entfernte
  Identität als `[UNKNOWN]`; nur ein noch tatsächlich recoverable Trash-Objekt
  darf verlinkt bleiben. Undo darf die CharacterId weder wiederherstellen noch
  erneut referenzierbar machen; erneute Anlage erzeugt eine neue CharacterId.
  Exportfähigkeit richtet sich ausdrücklich nach dem unten definierten
  Delete-Closure-Status: `closure-pending` darf ausschließlich opaque offline
  Quarantäne geschlossen mitführen; erst `permanent-purge-finalized` verbietet
  jeden rekonstruierbaren app-kontrollierten Payload. Ein älterer, vor der
  Löschung ausdrücklich vom GM erzeugter Export bleibt extern und nicht
  widerrufbar; sein Import erzeugt eine neue unabhängige Campaign mit neuen
  remappten Identitäten und ist keine Resurrection in der gelöschten Campaign.
- Adventuring-Day-Budget und -Fortschritt sind reine, revisionierte Party-
  Berechnungen. Eigene Eingabezeilen bleiben transient und verändern weder
  Roster noch aktuelle Party oder Scene-Zuordnung.
- Die planning-only expected Party eines Session-Plans gehört SMR-06 und ist
  weder die aktuelle Party noch eine LiveScene-Zuordnung.

### Primary Scene und Focus

Primary Scene und aktueller Focus sind getrennte, revisionierte Zustände. Ein
Focuswechsel ändert weder Primary-Rolle noch Partyzuordnung, SceneClock,
Location, Masken, Travel, Music-Entscheidung oder WorldEffect-Autorität.

Eine immutable `FocusProjection` enthält mindestens:

- CampaignId;
- LiveSceneId oder ausdrücklich `none`;
- SceneRevision, falls eine Scene projiziert wird;
- monotone FocusRevision;
- Zustand `active`, `none`, `pending` oder `unavailable`.

Nur `active` darf Scene-Fachdaten liefern. `none`, beschädigte, archivierte,
fremde oder stale Scene-Referenzen liefern niemals zuletzt bekannte Daten als
aktuelle Wahrheit. Music, Weather, Shops und Karten konsumieren nur ratifizierte
immutable Projektionen und erhalten keine Scene-Interna.

`FocusProjection` und `LiveSceneProjection` sind interne Source-Verträge und
keine player-sichere Passive-Display-Projektion. Solange SMR-10 keinen echten
Consumer-Owner, keinen ratifizierten Knowledge-/Perception-/Fog-/Camera-Vertrag
und keine vollständige Null-Leak-Abnahme besitzt, bleibt Passive Display
`absent/disabled`: Es existieren keine Consumer-Bridge, Subscription,
Serialisierung oder Ausgabe aus diesen Source-Projektionen. Dieser Default-Deny-
Zustand blockiert keine Scene-/Party-/Preservation-Arbeit und erzeugt keinen
Dummy-Owner.

Campaignwechsel invalidiert den aktiven Focus für Consumer, überträgt keine
Scene-, Queue-, Override-, Shop- oder Weather-Verfügbarkeit und stoppt/mutet
alte Ausgabe nach dem jeweiligen Besitzervertrag. A→B→A bewahrt den dauerhaften
A-Zustand; seine erneute Ausgabe erfordert ausdrückliches Continue und frische
Revisionen.


Weitere Fachabschnitte: [Teil 2](smr03-live-scene-contract-2.md) · [Teil 3](smr03-live-scene-contract-3.md) · [Teil 4](smr03-live-scene-contract-4.md)
