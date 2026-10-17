# SMR-03-P01: Party-, LiveScene- und Live-Session-Vertrag

Aktueller Verfolgungsanschluss und konkrete Restlieferung: [Chase als Scenemaske](chase.md).

Aktueller Datenanschluss und konkrete Folgelieferung: [Kampfentwürfe und narrative Belohnungen](combat-and-narrative-recovery.md).

Abschnitte: [Normativer Lebenszyklus](#normativer-lebenszyklus) · [Mehrbesitzer-Commit und Recovery](#mehrbesitzer-commit-und-recovery) · [Party-Command-History und kausales Undo/Redo](#party-command-history-und-kausales-undoredo) · [Offene Produktanschlüsse](#offene-produktanschlüsse) · [Kernverträge und Umsetzung](#kernverträge-und-umsetzung)

Historische Modell- und Hostnachweise stehen in `acceptance.json`. Sie belegen ihren damaligen Umfang, keine aktuelle vollständige Produktabnahme.

## Technische Anschlussentscheidung vom 11.10.2026

Fachliche Party-/Scene-/Masken-/Zeit-/Erasurewirkungen bleiben verbindlich.
[ARCHITECTURE](../../../ARCHITECTURE.md) ersetzt die früher vorgeschlagene
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

## LiveScene-Projektion

Eine immutable, tief eingefrorene `LiveSceneProjection` trägt mindestens:

- CampaignId, LiveSceneId, SceneRevision und Primary-Flag;
- ausdrücklich getrennte FocusRevision beziehungsweise den Hinweis, dass die
  Scene nicht fokussiert ist;
- geordnete aktive CharacterId-Referenzen und sichtbare Pending-Zuordnungen;
- optionale ratifizierte LocationId und ihre Projektionrevision;
- getrennte IDs/Revisionen für SceneClock, aktive beziehungsweise archivierte
  Gruppen sowie Runtime-Masken;
- Reconciliation-Status je abhängigem Besitzer;
- stabile Referenzen auf gepinnte oder Scene-gebundene Inhalte, niemals
  kopierte fremde Payloads.

Fremde Namen, Profile, Statblocks, Karten, Wetter, Shops, Musik, Uhrzeiten oder
Maskenpayloads werden bei einer aktuellen Projektion über ihre Eigentümer
aufgelöst. Fehlende Referenzen bleiben sichtbar und retry-/rebind-fähig; sie
werden nie still entfernt, ersetzt oder einer anderen Scene zugeordnet.

## Split, Rejoin und ortsgebundene Inhalte

- Eine neue Split-Scene erhält eine neue stabile LiveSceneId und optionalen
  Titel; Split-Scenes benötigen keinen Namen. Ihre SceneRevision beginnt
  unabhängig.
- Eine CharacterId kann nie gleichzeitig in zwei Scenes erscheinen. Source und
  Target werden gegen dieselbe veröffentlichte Zuordnungsgrenze geprüft.
- Jeder Move oder Rejoin benutzt den oben definierten Empty-Scene-Cleanup. Eine
  nichtleere Source bleibt aktiv; nur eine tatsächlich leere Source wird
  retired. Primary- und Focus-Ausgänge folgen vollständig dem gebundenen
  `SceneCleanupPlan`.
- Ein Rejoin nennt erwartete Source-/Target-Scene- und SceneClock-Revisionen
  sowie eine ausdrückliche GM-Zeitauflösung: bestätigte Source-Zeit, bestätigte
  Target-Zeit oder ein manuell bestätigter Auflösungswert. Target übernimmt
  exakt diesen bestätigten Zeitwert, auch wenn er vor seinem bisherigen Wert
  liegt; ausschließlich Target-SceneClockRevision steigt monoton. Bestätigte
  WorldEffects, Geschichte und andere Scenes bleiben unverändert. Abhängige
  spätere Widersprüche benutzen den ratifizierten sichtbaren Konfliktmarker-
  und manuellen Auflösungsworkflow. Nur wenn der Cleanup die Source tatsächlich
  retired, wird ihre SourceClock archiviert/finalisiert.
- Derselbe Entscheid beschreibt den alten und neuen Primary- und Focus-Zustand.
  War Source fokussiert, wechselt Focus mit monotoner FocusRevision auf Target;
  war Target fokussiert, bleibt es Target mit neuer Revision; war eine dritte
  Scene fokussiert, bleibt sie unverändert. Diese Target-Regel gilt für den
  vollständigen Rejoin mit Source-Retirement; bei einem Teil-Move bleibt die
  nichtleere Source samt Focus und Clock aktiv. Eine retired Source wird nie
  wieder `active` projiziert.
- Rejoin selbst inferiert weder Masken-/Encounter-Completion noch Transfer und
  löst keine fremden Folgen aus. Bewegte CharacterIds verlassen jede betroffene
  Maske nach der bestätigten Move-Regel. `complete` ist nur als getrennt
  ausgewiesener, vom GM bestätigter Owner-Workflow mit eigenem OwnerReceipt und
  atomar gekoppelten Folgen zulässig. `transfer-to-target` erfordert eine
  ratifizierte Maskenfachregel und eine ausdrückliche GM-Aktion; es überträgt
  keine übrigen Teilnehmer oder Inhalte implizit. Sonst archiviert/suspendiert
  der Owner ohne Folgen oder wird `quarantine-pending`.
- Ein unavailable Maskenowner darf den Character-Move nicht zurückrollen, aber
  seine Daten werden unter CommandId/Receipt quarantined und können keine
  lebende SourceScene- oder Teilnehmerreferenz projizieren. Reconnect
  finalisiert genau einmal und erzeugt weder Completion noch Transfer.
- Bei Source-Retirement werden Source-spezifische AmbienceOverrides sowie
  Weather-/Shop-Verfügbarkeiten archiviert oder suspendiert, niemals auf Target
  übertragen. Bei einem Teil-Move bleiben sie Source-gebunden aktiv. Erst eine
  frische Target-Focus-/Scene-Projektion darf Target-Overrides oder Autonomie
  aktivieren; Campaign-weite ManualDecisions bleiben unverändert.
- Location-Wechsel ersetzt nur abgeleitete Location-Projektionen. Persistente
  Inhalte am alten Ort bleiben beim Orteigentümer; gepinnte oder mit genau
  einer Partyuntergruppe reisende Inhalte folgen nur mit eigener stabiler
  Identität und bestätigtem Befehl.
- Prepared-Scene-Import erzeugt jedes Mal eine neue unabhängige Runtime-Kopie
  von Titel, Notes, Location, verlinkter Encounter-Plan-Referenz und
  Quellenprovenienz. Spätere Planänderungen mutieren die Runtime-Kopie nicht.
  Teilnehmer werden nicht aus einem unmöglichen `unassigned`-Zustand kopiert:
  ausgewählte aktive Characters wechseln erst durch einen getrennt bestätigten,
  revisionierten Move in die neue Runtime-Scene; ein fehlgeschlagener Move
  lässt die unabhängige leere Kopie sichtbar bestehen oder wird ausdrücklich
  verworfen, niemals still befüllt.

### Ortswissen direkt am Szenentisch (0.145)

„Am Ort“ liest NSCs, Aufträge/Gerüchte und verknüpfte Fraktionen aus denselben
bestätigten Ortsbindungen wie die Ortsmappe. Jede Kategorie lädt ihre weiteren
40er-Seiten ausdrücklich nach; ein Fehler erlaubt den erneuten Abruf dieser
Kategorie und blockiert weder andere Kategorien noch den Notizeditor.
Öffnen verwendet den vorhandenen Szenentisch-Editor einschließlich narrativer
Angaben und gesicherter Rohtexte. Anheften ist eine ausdrückliche vorhandene
Sceneaktion. Ein Orts-/Scene-/Campaignwechsel verwirft alte Antworten und
Ergebnisaktionen; angeheftete Inhalte bleiben an ihrer Scene. Aktualisieren
liest inzwischen geänderte Bindungen. Es entsteht weder eine zweite Ortsbindung
noch eine Kopie, kein Encounterstart und keine Belohnung beim Lesen.

NSC-eigene Shops am bestätigten Sceneort werden auch ohne vorbereitete
Figurengruppe eingeblendet. Der bestehende Shopreader und Handelswriter bleiben
zuständig. Ortswechsel entfernen ortsfremde Shops aus dieser Projektion.
Automatische Entfernung bereits übernommener älterer Gruppeninhalte sowie
allgemeine Pin-/Begleitersemantik bleiben eigenständige Runtimearbeit.

## Runtime-Masken

Encounter, Chase und spätere Masken überlagern die kontinuierlich bestehende
LiveScene. Mehrere Masken desselben oder verschiedener Typen dürfen gleichzeitig
existieren; ein Teilnehmer darf in mehreren Masken vorkommen.

Jede Maskenprojektion nennt mindestens CampaignId, LiveSceneId, stabile MaskId,
MaskKind, OwnerIdentity, OwnerRevision, Teilnehmerreferenzen und Lifecycle-
Status. Der Maskenbesitzer hält fachlichen Ablauf, History und Persistenz. Scene
führt keine kopierten Combat-/Chase-Zustände.

Eine bestätigte Teilnehmerbewegung, Deaktivierung oder logische Löschung
entfernt die CharacterId aus allen verfügbaren betroffenen Masken, blockiert
aber die autoritative Party-/Scene-Entscheidung nicht. Fehlgeschlagene
abhängige Updates werden sichtbar pending; Tombstone-Guards verhindern bei
Löschung zusätzlich jede Live-Projektion aus quarantined Altbytes. Completion
einer Maske beendet niemals die LiveScene und verändert keine andere Maske.
Fehlende oder ausgefallene Maskenprovider lassen Scene, Party, Notizen und
andere Masken weiter nutzbar; bei Löschung müssen sie vor Publish registriert
und quarantined sein und später genau ein ClosureReceipt liefern.

## Mehrbesitzer-Commit und Recovery

Party-, Scene-, Zeit-, Masken- und abhängige Records werden gemeinsam geplant,
validiert und in **einer DBtransaktion** geschrieben. Receipt, Revisionen,
kausale Deltas und Erklärungsfakten gehören zu derselben Grenze. Kein internes
Prepare-/Publish-/Finalizeprotokoll zwischen unabhängigen Stores. Die alten
Stage/Validate/Publish/Verify/Finalizebegriffe beschreiben Planung/Prüfung/Commit/
Status/Projektion; ihre ehemaligen Implementationsdetails sind historisch.

Command-ID/Fingerprint/erwartete Revisionen/Aktivierung binden den Versuch.
Cancel gewinnt vor dem Commit und publiziert nichts; nach Commit bleibt nur
Status/Reconciliation vorwärts. Unknown outcome wird mit derselben ID geprüft,
niemals durch neuen Command oder neue Runtime-ID ersetzt. Fremde Records oder
Registry-/Rechteänderung an der Commitgrenze scheitern ohne Teilwirkung.
Nur tatsächlich betroffene abhängige Masken dürfen pending/unavailable sein;
Party und andere gültige Scenes bleiben benutzbar.

Löschclosure umfasst alle beteiligten Inhalte, References, Runtime, retained
Providerunits und app-managed Recoverydaten. Unavailable Provider wird nicht
ausgeführt; Core nutzt dessen vollständiges versioniertes Besitz-/Remapenvelope.
Nichtrekonstruktive Historie bleibt, rekonstruierbare gelöschte Payloads nicht.
Permanente Löschung meldet erst nach tatsächlich abgeschlossener Bereinigung
Erfolg; Crash setzt die persistierte Closure fort. Restore/Import verwendet
keine importierten Source-Erasure-/Rechtetokens als lokale Autorität.

Die vollständigen Transfer-/Trash-/Erase-/Backupregeln stehen ausschließlich
im [Campaignvertrag](../../../ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md).
TN-22 verlangt Cancel p95 ≤1 s und Cleanup ≤10 s; markierte resumable Artefakte
bleiben außerhalb bestätigter Fachwahrheit. P02/P04 prüfen Faultfälle und
Survivor-/Omissionclosure; ein reines Scene-Modell belegt keinen durablen Commit.

## Party-Command-History und kausales Undo/Redo

`PartyCommandHistory` besitzt pro Campaign und Installation die letzten 100
chronologischen bestätigten Party-/Rosteraktionen: manuelle XP-Änderung, Rest,
Membership, Move einschließlich Scene-Erzeugung, Quick Fields, Profiländerung
und persönliche Loot-Korrektur. Navigation, Filter, Expansion, Focus und
Fenstergeometrie erzeugen keine History-Schritte. SMR-07 Campaign History bleibt
getrennt und wird nicht als rücksetzbare Party-History missbraucht.

Campaign-Mutation, owner-lokale Vorher-/Nachher-Fakten, Pending-Marker und das
unveränderliche CommandReceipt sind atomar. Undo/Redo benutzen eigene stabile
CommandIds und Receipts, erhöhen Revisionen und liefern aktuelle Projektionen;
ein unbekannter Ausgang wird vor einem neuen Versuch mit der ursprünglichen
CommandId aufgelöst. Eine neue Aktion nach Undo verwirft den Redo-Zweig.
Nach permanenter Charakterlöschung werden alle rekonstruierbaren Vorher-/
Nachher-Fakten über das ReferenceOwnerManifest anonymisiert oder entfernt;
Receipt und erklärender History-Eintrag bewahren nur nichtrekonstruktive
Command-/Owner-/Revision-/Outcome-Evidenz und `[UNKNOWN]`.

Undo/Redo kehrt nur kausal betroffene Felder um. Spätere inkompatible Scene-,
Clock-, Journey-, Combat- oder Profiländerung erzeugt einen sichtbaren Konflikt
statt fremde Arbeit zurückzurollen; notwendige Journey-/Combat-Reconciliation
läuft unter demselben Campaign-Receipt. Eine durch den Move neu erzeugte Scene
wird nur entfernt, solange sie unverändert und unbenutzt ist; eine bereits
geöffnete neue Scene verlangt vorher Rückkehr zur Source. Permanente Löschung
ist nie auf dieselbe CharacterId rücksetzbar. Import oder Campaign-Ersatz
invalidiert die vorherige lokale History am staged Ziel.

## Live-Session- und Präsentationsgrenze

LiveSession ist eine lesende, revisionierte Komposition der fokussierten
LiveScene. Sie besitzt keine zweite Party-, Gruppen-, Encounter-, Travel- oder
Music-Wahrheit. Scene-lokale Auswahl, Details-/Suchhistorie und Fensterzustände
sowie app-weite Shellpräferenzen bleiben ausdrücklich von Fachzuständen
getrennt. Fenster öffnen, schließen, fokussieren, minimieren oder neu anordnen
startet, pausiert oder beendet weder Scene noch Masken, Travel oder Audio.

Der Desktopladestand gehört zur aktuellen Aktivierung und Ladeanfrage. Neuere
Eingaben und Speicheraufträge verwerfen ältere Ladeantworten einschließlich
ihren Fehlern. Eine verspätete Antwort darf weder den Gruppenfokus zurücksetzen
noch neue Texte ersetzen oder die inzwischen geladene Arbeitsfläche ausblenden.
Ein Fehler der aktuellen Anfrage bleibt sichtbar und ausdrücklich erneut ladbar.

Erst SMR-10 darf aus der aktuellen Focus-/Scene-Source eine getrennte sichere
Playerprojektion ableiten. Deren Owner muss vor Aktivierung Character-Knowledge,
aktuelle Perception und GM-Truth trennen; Fog/Camera sowie
blank/replace/reveal/hide binden; Schreibfähigkeit, Text-/Mechanik-/Privatdaten
und stale unsafe Frames ausschließen; und TN-21, TN-24, TN-31, AC-L10 sowie
AC-T07 vollständig qualifizieren. Bei Party-Splits umfasst die zulässige
Knowledge-/Perception-Union nur die Characters der fokussierten Scene; eine
ältere Formulierung `complete Party` darf keine Kenntnisse anderer Scenes
offenlegen. Focuswechsel, `none`, stale/unavailable, Displayverlust, A→B→A,
Restart und Import dürfen nie zuletzt bekannte unsafe Ausgabe reaktivieren.

## Fachliche Abnahmekriterien

1. Eine neue, kopierte und importierte Campaign bleibt ohne LiveScene gültig.
   Ausdrückliches Continue mit einer bereits aktiven, geordneten Party erzeugt
   genau eine Primary Scene, ordnet alle aktiven IDs in Partyreihenfolge zu und
   publiziert Scene, Focus und Clock zusammen. Stale/unavailable Party vor
   Validate publiziert nichts; gleiche CommandId liefert dasselbe Receipt.
   Vollständiger LiveSession-Import ruft Init nie auf, beschädigter Import
   erzeugt keine synthetische leere Scene.
2. Nach Deaktivierung, permanenter Löschung, Move oder Rejoin gilt der
   deterministische Empty-Scene-Cleanup. Bei leerer Party bleibt genau die eine
   leere Primary Scene; bei verbleibender Party ist jede aktive Scene bevölkert,
   genau eine davon Primary und keine retired Source live referenzierbar.
   Prepared-Import-Drafts bleiben getrennt und direkte Primary-Löschung ist
   unmöglich.
3. Aktivierung mit validiertem Focus ordnet genau der gebundenen Ziel-Scene zu;
   ein Focus-Race wird stale abgewiesen und lenkt nie auf den neuen Focus um.
   Ein regulärer `unassigned`-Aktivzustand ist unmöglich; `pending` entsteht nur
   nach gespeicherter autoritativer Änderung mit abhängiger Reconciliation.
4. A/B/A: jede aktive Partyfigur erscheint in genau einer Scene, inaktive in
   keiner; Campaignwechsel vermischt keine IDs, Focus- oder Maskenzustände.
5. Split, Teil-Move und Rejoin bewahren Party-Mitgliedschaft und bewegen jede
   CharacterId genau einmal. Ein Teil-Move mit verbleibenden Teilnehmern erhält
   Source, SourceClock, Focus und Source-gebundene Consumerzustände; nur eine
   bestätigte leere Source wird retired. Primary-Successor und Focus-Fallback
   folgen dem gebundenen Cleanupplan und ortsgebundene Inhalte bleiben erhalten.
6. Rejoin mit divergenten Source-/Target-Uhren verlangt eine ausdrückliche
   GM-Zeitentscheidung und erwartete Clock-Revisionen. Source früher und später
   als Target sowie die Wahl von Source, Target und einem manuell bestätigten
   früheren Wert übernehmen exakt den gewählten Zeitwert, während ausschließlich
   die Target-ClockRevision monoton steigt. Retry und Crash/Restart liefern
   dasselbe Receipt; WorldEffects, Geschichte und Dritt-Scenes bleiben
   unverändert und spätere Widersprüche sichtbar markiert. Fälle mit Focus auf
   Source, Target und dritter Scene, Primary auf Source/Target sowie unavailable
   Maskenprovider liefern jeweils genau den festgelegten Focus-/Primary-/Clock-/
   Maskenausgang; keine Live-Projektion referenziert die entfernte Source.
   Source-Ambience/Weather/Shop-Verfügbarkeit wird nie auf Target übertragen und
   Target aktiviert erst aus frischer Projektion. Rejoin allein bewirkt niemals
   Masken-/Encounter-Completion, Transfer oder Folgen; ohne getrennte GM-
   Bestätigung werden übrige Teilnehmer/Inhalte nicht bewegt.
7. Deaktivierung bleibt bei Fehlern nichtdestruktiver abhängiger Projektionen
   genau einmal Party-autoritativ. Im Zwei-Scene-Fall Primary A mit nur PC1 und
   Scene B mit PC2 retired Deaktivierung von PC1 A, macht B gemäß Cleanupplan
   Primary und verschiebt einen Focus auf A nach B. Deaktivierung von PC2 lässt
   genau eine leere Primary. Nur betroffene Contexts werden pending, stale
   Contexts werden nicht als synchron gezeigt und unavailable Owner sowie Retry
   duplizieren weder Membership noch Cleanup.
8. Permanente Löschung mit unavailable Combat vor Publish schreibt Party-
   Löschung, nichtrekonstruktiven Tombstone und Registry-revisioniertes Owner-
   Manifest genau einmal. Registry-Install/Enable/Disable/Reconnect-Races
   brechen stale ab. Restart projiziert keine quarantined Referenz live;
   Reconnect oder capability-gebundene Erasure bei einem nie wiederkehrenden
   Owner schreibt genau ein ClosureReceipt. Mit mindestens zwei Characters und
   mehreren Records derselben Payloadklasse beweisen TargetScope-, Before-,
   After- und Survivor-Hashes byte- und semantisch, dass ausschließlich die
   gebundene Target-Unit verschwindet. Retry löscht Party nicht zweimal, Undo
   scheitert, und nur Audit aller History-, Recovery-, Staging-, Temp-, retained-
   und Exportkopien erlaubt Purge. Ein unbekannter Owner ist fail-closed;
   History zeigt `[UNKNOWN]` oder recoverable Trash ohne rekonstruierbaren Fakt.
   Nach Publish ändern Install/Enable/Disable eines fremden Owners den gepinnten
   Manifest-Snapshot nicht; unveränderter Slot schließt weiter, betroffener
   Reconnect/Update nutzt genau einen Rebind/Closure-Pfad und neuer Owner lehnt
   die Tombstone-ID ab—ohne Rollback oder zweite Party-Löschung.
   Derselbe Zwei-Scene- und letzte-aktive-Figur-Fall wie bei Deaktivierung prüft
   zusätzlich den gebundenen Primary-/Focus-/Clock-/Retirement-Ausgang bei
   Löschung, unavailable Owner, Crash/Restart und Retry; keine stale Source-
   Referenz oder doppelte Membership-/Cleanup-Mutation bleibt sichtbar.
9. Zwei Masken verschiedener Typen und zwei Masken desselben Typs dürfen
   Teilnehmer teilen. Ein Scene-Move entfernt die Figur aus allen betroffenen
   Masken, ohne andere Teilnehmer oder Masken zu ändern.
10. Focuswechsel ändert ausschließlich Focus/Fokusprojektion. Primary Scene,
   Partyzuordnung, Uhren, Travel, WorldEffects und Campaign-weite manuelle
   Music-Entscheidungen bleiben unverändert; ein LiveScene-Override wird nur
   nach frischer Projektion suspendiert/aktiviert.
11. `none`, stale, beschädigte oder fremde Focus-/Scene-Referenzen speisen keine
    Music-, Weather-, Shop-, Karten- oder Passive-Display-Projektion mit alten
    Daten. Ohne ratifizierten SMR-10-Consumer existieren keine Passive-Display-
    Bridge, Subscription, Serialisierung oder Ausgabe. Ein synthetischer
    Consumerzugriff scheitert default-deny und erhält weder private/mechanische
    Felder noch Campaign-Schreibautorität; Scene, Party, Preservation und
    unabhängige manuelle Arbeit bleiben nutzbar.
12. Campaignwechsel und Neustart stellen nach ausdrücklichem Continue Focus,
    Scenes, Masken, SceneClock-Verweise und Pending-Reconciliation vollständig
    wieder her; unbestätigte Drafts werden nicht zu Fachwahrheit.
13. Restore bewahrt alle Identitäten. Import remappt alle campaignlokalen IDs
    und Referenzen in eine unabhängige Campaign, ohne Topologieverlust oder
    Rückreferenz; Konflikte bleiben fail-closed.
14. Ausfall eines Masken-, Music-, Weather-, Shop-, Karten- oder
    Passive-Display-Providers lässt Scene, Party, Notizen, bestätigte Arbeit
    und Preservation nutzbar. Complete Export bleibt nur dann Complete, wenn
    er jedes erforderliche verifizierte Medium und alle retained
    Capability-Daten enthält und nichts still auslässt. Fehlende oder
    unrecoverable Daten erlauben ausschließlich einen getrennt bezeichneten
    Salvage-Export, dessen Manifest jede betroffene stabile Identität,
    erhaltene Metadaten und Auswirkung nennt; kein stilles Downgrade. Import und
    Recovery eines Salvage bleiben als Salvage erkennbar, bewahren zulässige
    Identitäten/Metadaten und initialisieren keine fehlende Session still.
    `closure-pending` erlaubt Campaign Complete nur mit vollständig
    verifizierten opaken quarantined Bytes plus Tombstone/Manifest/Evidenz;
    `permanent-purge-finalized` erlaubt Campaign Complete nur ohne Personen-
    Payload und mit nichtrekonstruktivem `[UNKNOWN]`/Receipt, während ein
    separater Character-/Closure-Export `evidentiary` heißt. Import hält Bytes
    im Core-RetainedQuarantineSlot offline und Source-Tokens nicht ausführbar.
    Mit Target-Provider `present`, `disabled`, `absent` und `replaced` bleiben
    Campaign und unabhängige Workflows nutzbar; erst installierter validierter
    Target-Owner mintet nach Remap den Target-only Token. Alte/fremde Slot- und
    Token-IDs, Source-/sibling Campaigns und fremde Slots bleiben unverändert;
    Providerwechsel aktiviert, löscht oder restored nichts implizit. Ohne
    sichere lokale Bindung scheitert Capability-Aktivierung fail-closed;
    beschädigte Quarantäne führt nur zu atomarer Ablehnung oder Salvage. Ein
    vor der Löschung erzeugter externer GM-Export darf als neue remappte
    Campaign importiert werden und mutiert die Quell-Campaign nicht.
    Bei dauerhaft absentem Provider entfernt nur eine ausdrückliche GM-
    `QuarantineDiscard`-Aktion den exakt gebundenen remappten Core-Envelope;
    falscher oder überlappender Envelope scheitert unverändert. Wiederholter
    Befehl sowie Crash/Restart/unknown outcome liefern genau dasselbe lokale
    Opaque-Discard-Receipt. Verspäteter Owner-Rebind konvergiert ohne zweite
    Closure; Import/Export danach führt weder Envelope noch Character-Payload
    wieder ein und behauptet keine provider-semantische Löschung.
15. Name-only-Erstellung, zwei gleichnamige Rosterfiguren und das Leeren jedes
    optionalen Profilfelds erhalten stabile Identitäten, echte Abwesenheit und
    inaktive Mitgliedschaft ohne Scene-/Travel-Nebenwirkung.
16. XP-Zuteilung/Korrektur, ausgewählte Short-/Long-Rests und
    Adventuring-Day-Berechnung ändern keine Scene-Zuordnung. Eine planning-only
    expected Party verändert weder Roster-Mitgliedschaft noch LiveScene.
17. Wiederholter Prepared-Scene-Import erzeugt unabhängige Runtime-Kopien mit
    Source-Provenienz; spätere Planner-Änderung wirkt nicht zurück. Die Kopie
    beginnt ohne Teilnehmer; ausgewählte aktive Characters wechseln nur über
    einen getrennten revisionierten Move. Dessen Fehlschlag befüllt sie nicht
    still und verändert keine bestehende Zuordnung.
18. Completion einer Maske beendet weder LiveScene noch andere Masken und
    verändert keine fremden Teilnehmer oder Ownerdaten. Rejoin ohne getrennte
    GM-confirmed Completion/OwnerReceipt beziehungsweise ratifizierte explizite
    Transfer-Aktion erzeugt weder Completion, Transfer noch Encounter-Folgen.
19. Eine Faultmatrix für `InitializeLiveSession`, Split/Rejoin, Teil-Move,
    Deaktivierung samt Empty-Scene-Cleanup, permanente Löschung samt Cleanup,
    `QuarantineDiscard` sowie Undo und Redo injiziert
    Fehler vor, während und nach Stage, Validate, owner-lokalem Prepare,
    Publish, Verify und Finalize
    sowie Crash/Restart und unbekannten Ausgang—einschließlich zwischen
    HistoryReceipt und Owner-Reconciliation. Vor Publish ist ausschließlich
    Discard/Rollback, nach Publish ausschließlich Roll-forward sichtbar; nie
    partielle Fachwahrheit. Der ursprüngliche Ausgang wird vor einem neuen
    Versuch geklärt; keine zweite Umkehr oder doppelte Journey-/Combat-
    Reconciliation. Dieselbe Matrix injiziert frühes und mittleres Cancel,
    Cancel-versus-Publish-Race, verspätete Participant-/Workerantwort,
    Crash/Restart/unknown outcome während Cancel sowie wiederholte Cancel-/Retry-
    Zyklen. Gewinnt Cancel, bleiben Source, bestehende Campaigns, shared
    Definitions und alle Survivor-Records byte- und semantisch unverändert;
    stale Antworten publizieren nichts. Gewinnt Publish, bleibt nur der
    ursprüngliche Roll-forward-Ausgang sichtbar. Die Abnahme misst TN-22-
    Acknowledgement und beweist nach zehn Sekunden null lebende Tasks, Handles
    oder Queueeinträge sowie null unmarkierte Temp-Artefakte, ohne Tombstone,
    Manifest, Receipt oder zulässige resumable Evidenz zu verlieren.
20. PartyCommandHistory bewahrt 100 Schritte über Fenster-, Navigations- und
    Prozessneustart, verwirft den Redo-Zweig nach neuer Aktion und nutzt für
    Undo/Redo neue CommandIds/Receipts. Spätere inkompatible Änderungen erzeugen
    Konflikte. Eine durch Move erzeugte Scene verschwindet nur unverändert und
    unbenutzt; Journey-/Combat-Reconciliation dupliziert nichts; permanente
    Löschung bleibt irreversibel.
21. Der repräsentative technische Fall mit 20 Rosterfiguren, vier unabhängig
    getakteten Scenes, acht Masken und 50 Teilnehmern erfüllt die TN-21-
    Livebudgets; die großen Profile truncaten oder vermischen keine Wahrheit.
22. Tastatur, 200-Prozent-Skalierung, lange Namen, `pending`/`unavailable` und
    nicht-farbige Zustände erhalten dieselben Scene-/Party-Aktionen und
    vollständige zugängliche Namen.

## XP-Entwurf und aktualisierte Partybasis

Der historische Party-Dropdown verweist ausdrücklich auf die konsolidierte
[Party-window-Quelle](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/party/requirements/requirements-party-window.md).
Ein offener XP-Entwurf in `party-topbar-ui.ts` hält nur die CharacterId;
`xpBasis` liest Profil und Fortschritt aus dem erfolgreich übernommenen
Party-Snapshot. Aktualisieren behält rohe Betrags-/Modus-/Grundfelder und
berechnet Titel/Vorschau neu. Vorschau und Bestätigung verwenden denselben
`changeCharacterXp`-Stand; der bestehende Writer prüft weiterhin dessen Revision.
Bei laufendem, fehlgeschlagenem oder nicht mehr zur Figur passendem Read gibt
es keine Bestätigungsautorität. Retry liest nur neu und löst keine XP-Buchung aus.

DOM-Gegenfälle prüfen alle drei XP-Modi, Umbenennung, fehlende Figur,
fehlgeschlagenen/pending Read und unvollständige Rohbeträge. Native IPC-/SQLite-
Probe prüft eine zwischenzeitlich bestätigte XP-/Profiländerung, kontrollierten
Lesefehler und Retry, genau eine ausdrückliche Korrektur auf der neuen Revision,
Preview/Readback-Gleichheit sowie unveränderte Rastfakten und Scene-Uhr.
Party-History und Fenstermigration bleiben eigenständige offene Lieferungen;
die gebündelte Roster-/Movebedienung ist unten angeschlossen. Dieser
XP-Korrekturweg benötigt keine neue Tabelle.

## Offene Produktanschlüsse

Die Desktopanwendung verwendet [SQLite-Commands](../../../src/app/storage/live.ts), [Maskenabgleich](../../../src/app/storage/mask-health.ts) und [GM-Oberfläche](../../../src/app/live.ts). Gesamt-E2E-02 und weitere Plattformen bleiben getrennt zu belegen. Die providerunabhängige immutable Sourceprojektion aktiviert keine Playerausgabe: absent/disabled bleibt Default-Deny. Vor einer SMR-10-Bridge sind Knowledge-/Perception-/Fog-/Camera-Filter sowie TN-21/TN-24/TN-31 und AC-L10/AC-T07 zu belegen. Music/Weather/Shops erhalten immutable Focus-/LiveScene-Consumer mit none/stale/Fehlerzuständen; Capability-, Cancellation- und Recoverygrenzen bleiben erforderlich.

Der integrierte SQLite-Adapter entfernt bei bestätigtem Move oder Deactivate verfügbare Character-Teilnahmen aus offenen Combat- und Chase-Masken atomar mit der Partyänderung und speichert je betroffenem Owner einen revisionsgebundenen Reconciliation-Beleg unter derselben CommandId. Retired der bestätigte Scene-Cleanup die Quell-Scene, wechseln ihre offenen Combat-/Chase-Owner ohne Completion, Ergebnis, Belohnung oder Transfer in den terminalen Zustand `retired`; Fachstand und Reconciliation-Beleg bleiben erhalten. Der bestehende GM-Dialog für frühere Gruppen listet die letzten gespeicherten Combat-/Chase-Owner derselben Scene und öffnet deren terminalen Fachstand schreibgeschützt. Provider-Ausfall mit sichtbarem `pending` sowie Character-Tombstone/Closure bleiben offene Produktanschlüsse; dieser Teilstand ist keine vollständige SMR-03- oder E2E-02-Abnahme.

### Konsolidierte Party: ausführbare Anschlussfolge

Die gebundene `requirements-party-window.md` bleibt vollständig maßgeblich.
Der Topbar-Popup ist eine Teilimplementation. Ab0.148 startet er mit360×220px,
lässt sich bis240×160px verkleinern und scrollt intern. Seine Größe und die
ausgewählten zehn Schnellwerte bleiben installationsweit über Neustart erhalten.
Figuren beginnen eingeklappt; Name, XP- und Rastfenster stehen in einer Zeile.
Aufklappen zeigt die ausgewählten Schnellwerte und Aktionen; eine zweite
Schnellwertezeile bei eingeklappter Figur entfällt. Alle zehn optionalen
Schnellwerte bleiben auswählbar. Namen bleiben vollständig lesbar. XP zeigt aktuellen Level und
relativen Fortschritt; Tastaturfokus/Tooltip nennen Gesamtstand und nächste
Schwelle beziehungsweise Maximum oder fehlende XP.

Die Kopfzeile bleibt beim Scrollen sichtbar und mittelt ausschließlich
verlässliche `restFrame`-Füllungen ungewichtet. Fehlende Figurenstände markieren
eine Teilbasis; gemeinsame Marken erscheinen nur bei gleicher Abschnittszahl.
Unbekannte Stände behaupten keine Füllung. Der reine Presenter verwendet die
bestehende Fortschrittsrechnung und schreibt keine zweite Fachwahrheit.

Gezielte Modell-/Store-/DOMfälle prüfen diese Anzeigen und den bestehenden
zweistufigen Rastweg. Ein nativer Linuxlauf prüft360/240px, lange Namen,
Tastaturaufklappen, Schnellwertauswahl ohne Campaignwrite, Rast ohne Zeitänderung,
XP-Schwellenwechsel und Fresh samt Einstellungen und zwei normalen Exits.
Das ist keine vollständige Tastatur-/200%- oder Betriebssystemabnahme.
Die Roster-Suche vergleicht IDs und tatsächliche Profilwerte einschließlich
Klasse, Sprachen und Zahlen. Interne JSON-Feldnamen und Serialisierungszeichen
sind keine Suchinhalte. Filtern und Blättern bleiben lesend; Aufklappzustand und
Rastempfängerauswahl bleiben erhalten. `desktop-party-search.test.mjs` prüft dies
mit45 Figuren, gleichen Namen, Spielersuche, Kennung und Paging.

Persönliche Beute und der identitätsgebundene Roster-Sprung sind unten
angeschlossen. Party-Undo/Redo und die restliche Fenstermigration bleiben offen;
vorhandene XP-/Rast- und Scenecommands qualifizieren diese Punkte nicht.
Die neue [Rastvormerkung und Scene-Bindung](adventuring-day.md#rastentscheidung-vor-dem-schreiben)
schließt einen begrenzten Entscheidungsweg. Die weiteren Anschlüsse folgen aus
der aktuellen Produktstruktur, nicht aus zu kopierenden SaltMarcher-Schemanummern:

| Nutzerwirkung / nächster Schritt | Bereiche und Datenregel | Abnahme und Abhängigkeit |
|---|---|---|
| Party auf kleinem Raum lesen | `party-topbar-ui.ts`, `party-overview.ts`, `index.html`, bestehende Styles: kompakter Teilstand oben. Keine zweite Fortschrittsrechnung. Vorher bestand nur die flüchtige820px-Breite ohne Geometriepräferenz; neue Maße ersetzen keine fremde Shellgeometrie. | Weitere200%-, vollständige Tastatur/Fokus- und Fenstermigrationsabnahme; die lokalen360/240px-Belege ersetzen sie nicht. |
| Mehrere Mitglieder bewusst ändern | Vorhandene `scene-roster`-Übernahme bindet die komplette Auswahl an Roster/Fokus/Scene-Revision und schreibt atomar; stabile CharacterIds, Auswahl außerhalb des Filters erhalten; andere Scenes nur über gemeinsamen Move | Store-/DOMfälle mit45 Figuren, gleichen Namen, Filter-ABA, Stale-Basis und atomarem Rollback sind unten beschrieben. Vollständige200%-/OS-Abnahme bleibt offen; keine Schleife separat bestätigter Einzelbefehle ergänzen. |
| Gruppe gemeinsam bewegen | Bestehender `LiveAction.move` und Scene-/Maskenreconciliation; bestehendes/neues Ziel mit Ort und Mitgliedern, namenlose neue Scene mit geerbtem Ort/Uhr | Split/Rejoin samt divergenten Uhren, letzte Figur, Combat/Journey, Fehler/Replay; keine eigene Movefachlogik im Party-Popup. |
| Bestätigte Partyaktionen zurücknehmen | Bestehende `executeLive`-/`executeProgress`-/Lootreceipts und gezielte Vorher-/Nachherfelder inventarisieren; Schema und atomaren Historyanschluss in deren vorhandenen Transaktionen ergänzen | Erst echte XP-, Rast-, Profil-, Membership-, Move- und Lootfälle samt Konflikt/Replyverlust/Fresh schließen; danach 100 Schritte, Redobranch und Importinvalidierung. Keine Ableitung inverser Aktionen allein aus Text-/Anzeigehistory. Der normative Historyvertrag oben bleibt unverändert. |
| History sicher anbieten | Erst nach belastbaren Historycommands im Party-Popup vier Readzustände, aktuelle Undo-/Redoautorität, isoliertes Retry und Originalcommand-Recovery anbinden | Verspätete Antwort nach Close/Workspace-ABA, beschädigter Read ohne neue Schreibautorität, 240 px Fehler/Retry mit Tastatur. Quickfieldpräferenzen an ihrem tatsächlichen Installationsowner beteiligen; keine zweite DB nur wegen der Quellarchitektur einführen. |

Migrationen ändern keine alten XP-/Rastfakten, Profilinhalte oder historischen
Receipts still. Vor einer Shell-/Historymigration aktuelle lokale Persistenz und
Import-/Restorepfade prüfen; Source-Window- und Schema-42/43-Beispiele begründen
keine neue parallele Desktoparchitektur. Die vollständige Produktabnahme bleibt
offen, bis Nutzerwirkungen einschließlich Recovery und Migration belegt sind.

## Kernverträge und Umsetzung

Das ungenutzte parallele Party-/Scene-Modell samt seinen Modelltests wurde
entfernt. Sein [letzter vollständiger Stand](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/tree/2deb18b3bfff5e66768299a5b2907a080b1144dc/src/features/live-session)
bleibt als historischer Beleg verfügbar. Der Produktanschluss und seine
Store-/UI-Verhaltenstests sind maßgeblich; eine zweite Implementation der alten
Class-, Envelope- oder Mehrbesitzerformen ist nicht erforderlich.

Der aktuelle Pfad führt über `LiveAction`/`LiveScene` in
[`live-contracts.ts`](../../../src/app/live-contracts.ts), `executeLive` und
`readLiveScene` in [`storage/live.ts`](../../../src/app/storage/live.ts) sowie
`captureVisitDetails` in [`storage/session.ts`](../../../src/app/storage/session.ts).
`apply-visit` prüft Plan-, Besuchs- und Zielscenebasis in derselben Transaktion,
speichert `scene_adoption` getrennt vom bearbeitbaren `live_scene` und schreibt
den tokenunabhängigen Commandfingerprint samt Receipt. `scene-content` ändert
Laufwerte ohne Herkunftslöschung. Der gelöschte `state.ts`-Codec ist kein aktueller
Speicherport. Die Szenarien in `desktop-session.test.mjs` und
`desktop-session-retention.test.mjs` prüfen tatsächliche Adoption, Rollback,
Wiederholung, Draftretention und unabhängige Kopie. Sie ersetzen keine native
Continue-/Split-/Zeit-/Masken- oder Erasureabnahme; diese Fachziele bleiben offen.

Die Fachorakel oben bleiben vollständig verbindlich. Readmodels sind
unveränderliche revisionierte Werte; Preparation aliasiert keine Runtime.
Rejoin schreibt ausdrücklich gewählte Zeit und Scenezuordnung atomar.

### Migration und Bestandsschutz

Code hat keinen Bestandsschutz. Migration erhält Originalinhalte/IDs/Links
und zeigt geprüften Importvergleich. Campaign ohne LiveSession bleibt gültig;
Initialize legt Primary/Clock/Focus ausdrücklich gemeinsam an. Copy remappt,
Restore erhält Identitäten; unknown/beschädigte Daten werden nicht still als
leerer Stand initialisiert. Kein Whole-Branch-Merge und keine allgemeine
Legacyarchitektur nur wegen historischer Existenz.

### Modell- und Realnachweis

Vergangene Testdateien und Receipts stehen unverändert in `acceptance.json`
und `116c16af48b6a073216685c8d8e2cc74fada82c3:docs/plans/runtime/smr03-live-scene-contract.md`.
Sie belegen ihren jeweiligen Kern-/Hostumfang. [P02/P03/P04/C01](../../../ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md)
prüfen den neuen gemeinsamen Anschluss; Modell-PASS ist kein Store-/OS-/
Runtime-/Player-PASS. Tatsächliche Tastatur/200 %, physischer Input und
independent review bleiben direkte Produktbelege.

### Szenenroster gemeinsam übernehmen und bewegen

Das kompakte Partyfenster zeigt bei einer laufenden Sitzung ausschließlich
die Figuren der fokussierten Szene und deren Rastmittelwert. Unter Aktionen
öffnet „Aktives Szenenroster bearbeiten“ eine Suchauswahl für aktuelle und
inaktive Figuren. Name, Spieler und Kennung bleiben sichtbar; Filterwechsel
erhalten die gesamte Auswahl. Suche, Anzahl und Übernahme bleiben auch bei
240×160px erreichbar, die Liste scrollt separat. Die Auswahl wird erst mit
„Übernehmen“ gemeinsam bestätigt. Andere Szenen werden über „Figuren gemeinsam
verschieben“ erreicht; der bestehende Move-Dialog erhält „Alle auswählen“ und
Ziele aus Ort und tatsächlichen Mitgliedern. Nur gleiche sichtbare Beschriftungen
erhalten eine kurze Kennung. `partySceneLabels` gruppiert dafür auch kanonisch
äquivalente Unicode-Schreibweisen, ohne die Originaltexte umzuschreiben. Bei
gleichen ersten acht IDzeichen wächst das Präfix bis zur eindeutigen
Unterscheidung in der Gruppe; Szenenreihenfolge und vollständige Ziel-IDs bleiben
unverändert. Historische Szenentitel werden nicht umbenannt. Namenlose
neue Szenen erben weiterhin Ort, Position und Uhr über den vorhandenen Command.
Ein Split wechselt den Fokus nur nach der bestehenden Lifecycle-Regel.

`scene-roster` bindet eine komplette Auswahl an Roster-, Fokus- und
Szenenmitgliedschaftsrevision. Alle ausgewählten IDs werden vor der ersten
Mutation auf Verfügbarkeit und Szenenzugehörigkeit geprüft. Hinzufügen und
Entfernen, Masken-/Chaseabgleich, Scene-Cleanup, Chronikeintrag und Receipt
liegen in derselben bestehenden SQLite-Transaktion. Ein Repeat erhält dasselbe
Receipt; ein Reconciliationfehler rollt auch Party- und Receiptänderungen zurück.
Dies ist eine gemeinsame Membershipänderung, keine Schleife separat bestätigter
Einzelbefehle. Keine neue Tabelle oder Schemaänderung.

Die Probe mit45 Figuren prüft gleiche Namen, Auswahl außerhalb des Filters und
Tastaturfokus. Storefälle prüfen Reopen, Replay, Fremdszenen, Stale-Basis und
atomaren Rollback im Maskenabgleich. Ein nativer Ablauf übernimmt die Auswahl,
teilt eine namenlose Szene ab, führt sie über das bestehende Ziel wieder
zusammen und liest den Zustand nach vollständigem Neustart. Eine weitere native
Probe erzeugt gültige UUIDs mit absichtlich gleichen ersten acht Zeichen und
drei gleich beschriftete Szenen. Die Auswahl über den eindeutigen Zieltext
schreibt genau einen bestehenden Movecommand an die passende vollständige ID;
andere Gruppe, Titel, Uhren, Profile, XP und Rast bleiben erhalten. Ein regulärer
Appneustart liest denselben Zielzustand. Das ist ein begrenzter Zielauswahlbeleg,
keine gesamte Partyabnahme und keine Datenmigration.

Offen bleiben Party-Undo/Redo einschließlich100-Schritt-History, vollständige
Fenstermigration und OS-/200%-Abnahme. Persönliche Loot-/Rosterübergaben sind
im folgenden Abschnitt angeschlossen.
Der strenge aktuelle Livereader akzeptiert weiterhin keine beschädigte aktive
Zuordnung ohne Szene; die historische „Ohne Szene“-Recovery benötigt einen
eigenen, ausdrücklich begrenzten Migrationsanschluss. Die Chronik dieses Commands
ist kein Ersatz für die noch fehlende kausale Party-Undo-History.


### Persönliche Beute direkt im Partyfenster

Die aktuelle [Partyfenster-Anforderung](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/9de85c1a/docs/party/requirements/requirements-party-window.md)
ersetzt ausdrücklich das historische Dropdown. Aufgeklappte Figurendetails
zeigen die ausgewählten Schnellwerte sowie „Beute und Verlauf“ und den Sprung
zum identitätsgebundenen Charakter-Roster. Die kompakte erste Zeile bleibt bei
Name, XP und Rast; eine zweite Schnellwertezeile entfällt.

Die persönliche Beute ist innerhalb desselben Fensters durchsuchbar, nach
Erhalten/Verkauft/Weitergegeben filterbar und paginiert. Herkunft, unbekannte
Werte, gekaufte oder übernommene Einträge und der kumulative erhaltene Wert
bleiben unterscheidbar. Mengenberichtigungen verlangen eine ausdrücklich
eingetragene nichtnegative Gesamtmenge und einen Grund; verkaufte Einträge
behalten ihren tatsächlichen Gesamtpreis. Der vorhandene Progress-Writer
schreibt Revision, Receipt und nachvollziehbare Vorher-/Nachher-Historie.
Es gibt weder ein zweites Ledger noch einen neuen Speichertyp.

Die Party bindet Lesen und Schreiben an Kampagnentoken, Figuren-ID und
Fenstergeneration. Ein frischer Detailread prüft die gewählte Ledgerrevision,
ohne eine Auswahl im versteckten Live-Beuteregister vorauszusetzen. Abgelaufene
Antworten dürfen keine andere Figur oder geschlossenes Fenster überschreiben.
Bei unbestätigter Buchung bleiben Eingaben erhalten; „Buchungsstatus prüfen“
nutzt die vorhandene Receipt-Recovery direkt im Fenster. Es gibt keinen automatischen Neuversuch.

Gezielte Panel-, Party- und Ledger-Verhaltenstests prüfen Suche/Paging,
gleichnamige Figuren, Berichtigung, gespeicherte Verkaufspreise, stale Reads
und geschlossene Auswahl. Ein nativer Electron-Ablauf öffnet die Beute vom
Atlas, berichtigt7 auf3, liest den Verlauf, öffnet die zweite gleichnamige
Figur und prüft den gespeicherten Stand nach regulärem Neustart. Roster,
Szenenuhr, XP und Rast bleiben dabei unverändert; die Ansicht scrollt bei
240×160px ohne horizontales Überlaufen. Dies belegt diesen Anschluss, keine
vollständige OS-, 200%- oder kausale Party-Undo-Abnahme.
