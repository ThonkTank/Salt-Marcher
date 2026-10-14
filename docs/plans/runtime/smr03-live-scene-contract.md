# SMR-03-P01: Party-, LiveScene- und Live-Session-Vertrag

Abschnitte: [Normativer Lebenszyklus](#normativer-lebenszyklus) · [Mehrbesitzer-Commit und Recovery](#mehrbesitzer-commit-und-recovery) · [Party-Command-History und kausales Undo/Redo](#party-command-history-und-kausales-undoredo) · [Offene Produktanschlüsse](#offene-produktanschlüsse) · [Kernverträge und Umsetzung](#kernverträge-und-umsetzung)

Status: **Lifecycle-/Zeit-, Ownership- und Host/Security/Platform-Re-reviews
`PASS`; Passive-Display-Phasensplit auf Exact-SHA `PASS` und vom Source-Owner
ratifiziert; Music/Weather/Shops-Consumer-Rekonfirmation auf Exact-SHA lokal
dokumentiert; ohne
Implementierungs-, Host- oder Persistenzfreigabe.**

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

Die fachlichen Verträge unten unterscheiden unveränderliche Preparation, explizite Runtimeinitialisierung, Scene-/Maskenidentität und kausales Undo. Technische und Produktabnahmen sind nur in ihrem nachgewiesenen Umfang gültig; die alten Review-/Ratifikationsläufe bleiben im Git-Verlauf.

## Umfang und Nichtziele

Dieser Lauf definiert nur den hostneutralen Fachvertrag für Campaign-Roster,
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

Mehrbesitzerbefehle verwenden die mit SMR-01 und SMR-07 gemeinsame öffentliche
Folge `Stage → Validate → Publish → Verify → Finalize`. Owner-lokales `Prepare`
bleibt eine unsichtbare Unterphase im Participant-Slot des Stage-Receipts und
ist keine sechste Phase.

Jeder Befehl führt stabile CommandId, CampaignId, ausdrücklich beteiligte
Owner, beabsichtigte Zielidentitäten und erwartete Owner-Revisionen. Vor dem
durablen Publish-Entscheid bleibt die alte bestätigte Wahrheit sichtbar und
Recovery rollt vorbereitete Beiträge zurück. Nach Publish wird ausschließlich
vorwärts verifiziert/finalisiert. Ein unbekannter Ausgang wird über dieselbe
CommandId und das Receipt aufgelöst, niemals als neuer Befehl wiederholt.

Cancellation ist ein commandgebundener Intent, kein zweiter Fachbefehl. Ein
Command ist nur bis zu seinem durablen Publish-Entscheid cancellable. Cancel und
Publish linearisieren genau einmal an derselben durablen Grenze; ein bereits
begonnener nicht cancellable irreversibler Abschnitt wird als solcher sichtbar
gemeldet und niemals als erfolgreich wirkungslos abgebrochen dargestellt.

Gewinnt Cancel vor Publish, schreibt dasselbe CommandReceipt den Ausgang
`cancelled-before-publish`. Die alte bestätigte Fachwahrheit bleibt vollständig
unverändert. Stage- und owner-lokale Prepare-Beiträge werden verworfen oder
recoverbar zurückgerollt; jede Participant-, Worker- und Callback-Generation
wird für diesen Command geschlossen. Eine verspätete Antwort, ein alter Handle
oder ein reconnectender Participant darf danach weder Publish noch eine
abhängige Wirkung erzeugen. Bei Import bleiben Source, bestehende Campaigns und
shared Definitions byte- und semantisch unverändert.

Gewinnt Publish, ist ausschließlich Roll-forward zulässig. Ein nachfolgender
Interrupt darf das lokale Warten beenden, aber weder bestätigte Wirkung
zurückrollen noch einen Cancellation-Erfolg melden. Verify-, Finalize- und
Closure-Pflichten bleiben mit ursprünglicher CommandId und ursprünglichem
Receipt sichtbar pending und werden nur darüber aufgelöst; temporäre
Nichtverfügbarkeit oder erneutes Cancel erzeugt keinen Ersatzbefehl.

Für anwendbare Hintergrundarbeit gilt TN-22: Vor Publish wird Cancel innerhalb
von einer Sekunde p95 bestätigt. Spätestens zehn Sekunden danach existieren
keine lebenden Tasks, Handles oder Queueeinträge und keine unmarkierten
temporären Artefakte des abgebrochenen Versuchs. Ein zulässiges resumable
Artefakt ist ausdrücklich markiert, liegt außerhalb bestätigter Campaign-
Wahrheit und innerhalb des Temp-Budgets. Tombstone, Manifest, Publish-/Closure-
Receipt und andere bestätigte Recovery-Evidenz sind keine temporären Artefakte
und werden durch Cleanup niemals entsorgt.

Wo Party gemäß bestätigtem Cross-Workflow-Vertrag die primäre autoritative
Änderung vor abhängigen Contexts veröffentlicht, enthält derselbe Publish-
Entscheid die genaue Scene-/Masken-Reconciliation-Pflicht. Die UI zeigt weder
eine alte Zuordnung als aktuell noch eine unbestätigte neue Zuordnung als
fertig. Retry wendet die primäre Mutation nicht erneut an.

Bei permanenter Charakterlöschung schreibt derselbe Publish-Entscheid die
autoritative Party-Löschung, einen Tombstone und ein geschlossenes
`ReferenceOwnerManifest`. Das Manifest enthält ausschließlich CommandId,
CampaignId, CharacterId, OwnerId, Referenz-/Revisionsbeleg und Closure-Status,
niemals Profil, Werte, Medien oder anderen rekonstruierbaren Payload. Erfasst
werden alle registrierten Besitzer lebender Character-Referenzen, insbesondere
Party, Scene, Masken/Combat, SMR-06 Preparation, SMR-07/Travel sowie jeder
retained Capability-Owner; zusätzlich sind Registry, Tombstone,
PartyCommandHistory, Staging, Temp, Recovery und app-kontrollierte Exportkopien
eigene Closure-Teilnehmer. Ein möglicher unbekannter Owner blockiert Publish.

Stage pinnt eine immutable `ReferenceOwnerRegistryProjection` mit CampaignId,
RegistryRevision, jedem Owner, seinen vollständigen Character-referenzierenden
Payloadklassen und je Klasse einer capability-gebundenen unveränderlichen
Erasure-Slotdefinition samt eigener SlotRevision. Der daraus lokal gemintete
immutable `ErasureToken` bindet DeletionCommandId, CampaignId, CharacterId,
OwnerId, owner-definierte exakte ErasureUnitId/TargetScope, Payloadklasse,
SlotRevision, erwarteten Before-Hash sowie den erwarteten Survivor-Set-/Root-
Hash. Er ist kein durch SMR-03 interpretierbarer Pfad, SQL-Schlüssel oder frei
nutzbarer Locator. Der Lifecycle darf ausschließlich die idempotente Host-
Erasure-Capability mit genau diesem Token aufrufen und öffnet oder verändert
niemals fremden Owner-Speicher selbst. Ein Owner darf erst nach bestätigter
Closure aus der Registry verschwinden.

Die globale RegistryRevision beweist ausschließlich die vollständige
Pre-Publish-Enumeration und wird unmittelbar vor Publish stale-validiert. Nach
dem durablen Publish bleibt der gepinnte Manifest-Snapshot autoritativ. Erasure
revalidiert Tombstone, TargetScope, Hashbelege und die per-Owner/per-Slot-
Revision; eine unabhängige globale Registry-Fortschreibung invalidiert einen
unveränderten Slot nicht. Ändert sich ein betroffener Slot, führt ein
ausdrücklicher idempotenter Rebind-/Closure-Pfad die alten und neuen Scope-/
Hashbelege zusammen und rollt die Party-Löschung nie zurück. Neu registrierte
Owner müssen Tombstone-IDs ablehnen und dürfen keine neue Referenz erwerben.

Jeder Manifesteintrag ist vor Publish entweder `removed` oder
`unavailable-quarantined`. Danach erzwingt jeder Lese-, Undo-, Import- und
Recovery-Rand den Tombstone: quarantined Bytes sind nicht live auflösbar und
können keinen neuen Effekt erzeugen. Beim Reconnect entfernt der Owner seine
Alt-Referenz mit ursprünglicher CommandId genau einmal und schreibt ein
`ClosureReceipt`. Kehrt ein registrierter Owner dauerhaft nicht zurück, löscht
die gebundene Erasure-Capability ausschließlich seine manifestierten
Payloadklassen byteweise, ohne sie fachlich zu interpretieren, und schreibt
dasselbe nichtrekonstruktive ClosureReceipt. Dieses enthält nur Command-,
Character-, Owner-, TargetScope-, Slot-/OwnerRevision-, Before-, After- und
Survivor-Hash- sowie Outcome-Belege. After-/Survivor-Belege müssen zeigen, dass
genau die Target-Unit fehlt und alle übrigen Records derselben Payloadklasse
byte- und semantisch unverändert blieben.

PartyCommandHistory und immutable Receipts projizieren ab logischer Löschung
nur nichtrekonstruktive Belege. Verfügbare rekonstruierbare Vorher-/Nachher-
Fakten, Profile, XP, Quick Fields, Loot- oder Medienpayloads werden in History,
Recovery, Staging, Temp, retained storage und app-kontrollierten Exportkopien
entfernt oder anonymisiert, ohne den erklärenden `[UNKNOWN]`-Fakt umzuschreiben.
Noch unavailable Bytes bleiben bis Closure ausschließlich offline quarantined
und dürfen nur im unten definierten `closure-pending` Complete mitgeführt
werden. Erst die vollständige semantische und Byte-Closure erlaubt physischen
Payload- und Tombstone-Purge sowie den Status `permanent-purge-finalized`.
Recovery rollt vor Publish alles zurück und finalisiert danach nur vorwärts;
Retry wiederholt weder Party-Löschung noch abhängige Effekte.

Der veröffentlichte Receipt-/UI-Status unterscheidet drei Zustände:

1. `logical-delete/closure-pending`: Party-/Live-Identität ist tombstoned;
   verbliebene Bytes existieren ausschließlich opaque, offline und quarantined.
   Campaign Complete bleibt nach TN-27 nur zulässig, wenn es alle diese Bytes
   zusammen mit Tombstone, Manifest, Scope-/Hashbelegen und nicht ausführbarer
   Erasure-Evidenz vollständig und verifiziert einschließt. Es behauptet keinen
   finalisierten Purge.
2. `permanent-purge-finalized`: semantische und Byte-Closure sind bewiesen;
   kein app-kontrollierter Live-, Trash-, Recovery-, Staging-, Temp-, retained-
   oder Export-Payload kann den Character rekonstruieren. Campaign Complete ist
   für den dann aktuellen kanonischen Campaign-Zustand zulässig und enthält nur
   nichtrekonstruktive `[UNKNOWN]`-/Receipt-Evidenz. Ein separat angeforderter
   Character-/Closure-/History-Export heißt ausschließlich `evidentiary`, nie
   Complete, und suggeriert keine Wiederherstellbarkeit.
3. `prior-external-gm-export`: die vor der Löschung erzeugte externe Kopie ist
   nicht widerrufbar, aber nur Evidenz/Importquelle und verleiht weder Restore-
   noch Purge-Berechtigung für die Quell-Campaign.

Kann die geschlossene pending Quarantäne nicht vollständig bewiesen werden,
ist Complete blockiert; nur ein ausdrücklich gewählter Salvage-Export darf
genau manifestierte quarantined Bytes auslassen und nennt jede Identität und
Auswirkung.

Ein exportierter ErasureToken ist ausschließlich nicht ausführbare Provenienz-
und Closure-Evidenz. Import legt opaque Bytes und portable, nicht ausführbare
Slotbeschreibung zunächst in einen Core-eigenen providerunabhängigen
`RetainedQuarantineSlot`. Dieser ist kein Capability-Owner, besitzt keine
Fachprojektion und darf weder Erasure ausführen noch einen Owner simulieren; er
hält nur immutable validierte Quarantäne-Evidenz und Remap-Closure.

Nach vollständigem Campaign-/Character-/Command-ID-Remap und erfolgreicher
lokaler Installation des Target-Owners validiert dieser die Bytes gegen das
neue Registry-Snapshot und mintet lokal einen neuen, eng an Target-Campaign,
Target-Character, Target-Owner und Target-Slot gebundenen Token. Der Source-
Token wird niemals ausgeführt oder umgebogen; Source-Slots, externe Pakete,
gleichnamige/sibling Campaigns und fremde Slots bleiben unerreichbar. Bei
absent, disabled oder ersetztem Provider bleiben Campaign und unabhängige
Workflows nutzbar, während Capability-Aktivierung und Tombstone-Auflösung
fail-closed bleiben. Installation, Reaktivierung oder Providerwechsel löst
weder Aktivierung, Löschung, Restore noch Token-Minting ohne ausdrücklichen
validierten Rebind aus. Beschädigte oder unverifizierbare Quarantäne führt nur
zu atomarer Ablehnung beziehungsweise getrennt offengelegtem Salvage, niemals
stillem Complete.

Bleibt der Target-Owner dauerhaft absent, darf der GM die bereits manifestierte
Closure ausdrücklich mit `FinalizeImportedTombstone/QuarantineDiscard`
fortsetzen. Diese irreversible target-lokale Lifecycle-Aktion ist weder Owner-
Rebind noch ErasureToken-Ausführung und entfernt ausschließlich den vollständig
remappten, isolierten Core-Envelope als opaque Ganzes, ohne fremden Payload zu
interpretieren. Vor Publish validiert sie TargetCampaignId, TargetCharacterId,
remappte DeletionCommandId, CoreEnvelopeId, Tombstone/Manifest sowie Before-/
Survivor-Hashes; falsche, überlappende oder unvollständige Envelope-Closure
bricht fail-closed ab.

Das idempotente Receipt bezeichnet exakt `local opaque envelope discard; no
provider semantic closure claimed`. Crash, Restart, Retry und unbekannter
Ausgang werden über dieselbe CommandId aufgelöst. Absent/Disable/Remove/Replace
löst nie automatisch Discard aus. Ein späterer Owner-Rebind konvergiert auf das
bestehende Receipt und darf weder Reaktivierung, Rekonstruktion noch zweite
Closure erzeugen. Danach beschreibt Campaign Complete nur den aktuellen
kanonischen Zustand plus nichtrekonstruktive Evidenz, niemals verworfenen
Character-Payload oder eine vorgetäuschte provider-semantische Löschung.

Restore behält Campaign-, Character-, LiveScene-, Masken- und
Referenzidentitäten. Import erzeugt eine neue Campaign und remappt jede
campaignlokale Identität und interne Referenz atomar bei erhaltener Topologie.
Copy folgt der SMR-01-Closure-Regel. Trashing oder Löschen einer Campaign darf
keine Ersatz-Campaign, Scene oder Party implizit aktivieren.

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

## Acceptance vor jeder Implementierungsfreigabe

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

## Offene Produktanschlüsse

Persistenz, Recovery und GM-Anwendung des Party-/LiveSession-Kerns sind Kandidat in [PR160](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/160). Integration, Gesamt-E2E-02 und weitere Plattformen bleiben getrennt zu belegen. Die providerunabhängige immutable Sourceprojektion aktiviert keine Playerausgabe: absent/disabled bleibt Default-Deny. Vor einer SMR-10-Bridge sind Knowledge-/Perception-/Fog-/Camera-Filter sowie TN-21/TN-24/TN-31 und AC-L10/AC-T07 zu belegen. Music/Weather/Shops erhalten immutable Focus-/LiveScene-Consumer mit none/stale/Fehlerzuständen; Capability-, Cancellation- und Recoverygrenzen bleiben erforderlich.

Der integrierte SQLite-Adapter entfernt bei bestätigtem Move oder Deactivate verfügbare Character-Teilnahmen aus offenen Combat- und Chase-Masken atomar mit der Partyänderung und speichert je betroffenem Owner einen revisionsgebundenen Reconciliation-Beleg unter derselben CommandId. Retired der bestätigte Scene-Cleanup die Quell-Scene, wechseln ihre offenen Combat-/Chase-Owner ohne Completion, Ergebnis, Belohnung oder Transfer in den terminalen Zustand `retired`; Fachstand und Reconciliation-Beleg bleiben erhalten. Eine GM-Archivansicht für diese Owner, Provider-Ausfall mit sichtbarem `pending` sowie Character-Tombstone/Closure bleiben offene Produktanschlüsse; dieser Teilstand ist keine vollständige SMR-03- oder E2E-02-Abnahme.

## Kernverträge und Umsetzung

## Kernverträge und Umsetzung — Hostneutraler Kern

Der reine, deterministische TypeScript-Kern ist zuständig für
Party, LiveScene und LiveSession. Der Kern besitzt keine Hostimporte, keine
Datei-, Datenbank-, Fenster-, Audio- oder Prozessrechte und keine direkte
Obsidian-/Electron-Kopplung. Er verarbeitet validierte immutable Eingaben,
liefert immutable Ergebnisse und erzeugt explizite, noch nicht persistierte
Command-/Reconciliation-Entscheidungen.

Der reine Kern belegt Fachinvarianten, aber noch keine
durable Mehrbesitzertransaktion, keinen Campaign-Write, keine Migration, keine
Hostoberfläche und keine Passive-Display-Ausgabe. Diese Grenzen benötigen die jeweiligen produktiven Adapter und direkten Belege.

## Kernverträge und Umsetzung — Abhängigkeiten und harte Gates

| Gate                                 | Aktueller Zustand                                        | Wirkung auf SMR-03                                                                                                         |
| ------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| SMR-03-Semantik   | für den gebundenen SHA geprüft               | Der reine Kern bleibt hostneutral; produktive Adapter benötigen eigene Funktionsbelege                                                       |
| SMR-01 Campaign-/Transaktionsvertrag | Kandidat, nicht als Produktadapter freigegeben           | keine persistente Mutation, kein Import/Export und kein Recovery-Adapter in I01                                            |
| SMR-07 Clock-/Travel-Vertrag         | fachlich bestätigte Semantik       | I01 speichert nur opaque `SceneClockRef` und erwartet revisionierte Entscheidungen; keine eigene Uhr                       |
| SMR-00-ADR-01                        | vorgeschlagen, P01–P04/C01 nicht vollständig entschieden | keine neue Obsidian- oder Desktopkopplung und keine IPC-/SQLite-/Fensterwahl                                               |
| Encounter/Chase-Vertrag            | Runtime-Mask-Lifecycle nur eng ratifiziert               | nur Maskenidentität, Teilnehmer-Reconciliation und Lifecycle-Status; keine Regeln, HP, Initiative, Completion oder Effects |
| Passive Display                      | PlayerProjection-Vertrag offen                                     | kein Export, Kanal, DTO, Subscription oder Rendering aus der internen Source                                               |

Fehlt ein erforderlicher Owner oder liefert ein Port `unavailable`, bleibt der
reine Kern lesbar und erzeugt ausschließlich den normierten Pending-/Fail-
Closed-Ausgang. Ein fehlender Adapter wird nicht durch einen Dummy ersetzt.

## Kernverträge und Umsetzung — Geplante Modulgrenzen

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
einem Commit zu bauen. Die folgenden Abschnitte beschreiben technische Abhängigkeiten.

## Kernverträge und Umsetzung — Öffentliche Kernverträge

### Kernverträge und Umsetzung — Identität und Revision

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

### Kernverträge und Umsetzung — Party

`PartyState` enthält mindestens CampaignId, PartyRevision, geordnetes Roster,
aktive Membership, Profile/Quick-Fields, XP-/Rest-/Adventuring-Day-Fakten,
Tombstones und den aktuellen History-Cursor. Name-only-Erstellung und
Duplikatnamen bleiben erlaubt; Identität stammt ausschließlich aus CharacterId.

Party kennt Scene-Zuordnung nur als revisionierte Projektion beziehungsweise
als auszugebende Reconciliation-Pflicht. Party schreibt keine Scene direkt.
Planning-only Expected Party gehört nicht in dieses Aggregate.

### Kernverträge und Umsetzung — Scene

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

### Kernverträge und Umsetzung — Projektionen

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

## Kernverträge und Umsetzung — Command- und Zustandsmodell

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

### Kernverträge und Umsetzung — Deterministischer Cleanup

Move, Rejoin, Deactivate und Delete berechnen vor einer Veröffentlichung einen
vollständigen `SceneCleanupPlan`. Er bindet Source-/Target-/Primary-/Focus-ID,
erwartete Revisionen, Successor, Clockentscheidung, Retirement und alle
Masken-/Consumer-Reconciliation-Pflichten. Eine nichtleere Source wird nie
retired. Eine leere letzte Primary bleibt bestehen. Prepared Runtime Scenes
sind bis zum ersten bestätigten Move kein Primary-/Focus-Kandidat.

### Kernverträge und Umsetzung — Rejoin und Zeit

I01 interpretiert keinen Kalender und wendet keine WorldEffects an. Rejoin
akzeptiert ausschließlich einen validierten, **noch nicht veröffentlichten**
`ClockMergeParticipantContribution`. Er bindet CampaignId, dieselbe CommandId
und denselben kanonischen CommandDigest wie der Rejoin, Source-/Target-Scene und
ClockRef, erwartete Scene-/ClockRevisionen, die ausdrückliche GM-Wahl, den
gewählten—auch rückwärts erlaubten—Zeitwert, Clock-OwnerIdentity und dessen
owner-lokales PrepareReceipt. Das Receipt bestätigt nur Validierung/Prepare;
es ist weder separater Clock-Commit noch Durabilitybeweis und ersetzt keine
fachlichen Bestätigung des späteren SMR-07-Ports.

Scene- und Clock-Beitrag werden ausschließlich durch denselben gemeinsamen
Publish-Entscheid sichtbar. Rejoin-Konflikt, stale Revision oder vor Publish
gewonnener Cancel lassen Scene, Clock-Beitrag und alte bestätigte Wahrheit
unveröffentlicht. Nach gewonnenem Publish ist nur Roll-forward über dieselbe
CommandId zulässig: genau der gewählte Zeitwert wird gebunden und ausschließlich
der Clock-Owner erhöht die Target-ClockRevision. I01 modelliert diese gemeinsame
Grenze rein; reale Atomarität, Crash-/Restart- und Durabilitybelege bleiben I02.

### Kernverträge und Umsetzung — Masken

`MaskParticipationProjection` enthält nur CampaignId, LiveSceneId, MaskId,
MaskKind, OwnerIdentity, OwnerRevision, Teilnehmer-IDs und Lifecycle-Status.
Der Kern berechnet remove/retain/suspend/retire-Pflichten. Er kann niemals eine
Maske starten, abschließen, übertragen oder ihre Fachwirkung ableiten.

## Kernverträge und Umsetzung — Mehrbesitzer- und Persistenzgrenze

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

## Kernverträge und Umsetzung — Reference-Owner- und Löschgrenze

I01 modelliert RegistryProjection, Manifest, capability-gebundene
ErasureSlotDefinition, opaque ErasureToken, Tombstone, ClosureReceipt und
RetainedQuarantineSlot nur als validierte Verträge. Der Scene-/Party-Kern darf
keinen fremden Payload öffnen und keinen ErasureToken ausführen.

Permanente Löschung kann im reinen Kern ausschließlich einen gebundenen
Manifest-/Tombstone-Entscheid und owner-lokale Pflichten erzeugen. Byteweise
Erasure, Quarantänespeicher, Import-Rebind und vollständige Audit-/Purgebeweise
bleiben bei SMR-01 beziehungsweise den jeweiligen Capability-Ownern. Ein
unknown Owner oder eine unvollständige Registry scheitert fail-closed.

## Kernverträge und Umsetzung — Migration und Bestandsschutz

Im Zielrepository existiert noch kein kanonischer Campaign-/Party-/LiveScene-
Produktstore. Deshalb enthält I01 keine automatische Migration und liest weder
Obsidian-Vaults noch SaltMarcher-Datenbanken.

Die Migration benötigt mindestens folgende technische Nachweise:

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

## Kernverträge und Umsetzung — Acceptance-Harness

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

### Kernverträge und Umsetzung — Vollständige Zuordnung der 22 Fach-Acceptance-Fälle

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

## Kernverträge und Umsetzung — Geordnete Implementierungsslices

### Kernverträge und Umsetzung — I01-A – Verträge und Projektionen

- IDs, Revisionen, Parser und immutable DTOs;
- Party-/Focus-/LiveScene-/LiveSession-Projektionsbuilder;
- negative Boundary-Tests einschließlich fehlender Passive-Display-Oberfläche;
- keine Zustandsmutation und keine Ports.

Abschluss: eigener Implementation-Commit, `npm run check`, gezielte Tests,
vollständiges `npm test`, unabhängiger Review. Ein PASS öffnet nur I01-B.

### Kernverträge und Umsetzung — I01-B – Pure Party-/Scene-Aggregate

- Initialize, Roster/Membership, Focus, Split, Move, Rejoin und Cleanup;
- Clock-/Masken-/Consumerentscheidungen ausschließlich als opaque Inputs und
  Reconciliation-Ausgaben;
- immutable Prepared-Runtime-Kopie samt Provenienz und getrenntem Move;
- Invariant-Fuzzer und reine Modellorakel für Acceptance 1–7, 9–12, 15–18
  sowie die nichtnormative Scale-/DTO-Seite von 21–22. History aus Acceptance
  20 bleibt vollständig I01-C; echte Persistenz-, Performance- und UI-Gates
  bleiben I02/I03/SMR-11.

Abschluss: getrennte Implementation, Review, Repair und Re-review.

### Kernverträge und Umsetzung — I01-C – History, Lösch- und Coordinator-Verträge

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

### Kernverträge und Umsetzung — I02 – Persistenter Campaign-/Recovery-Adapter

Erst nach ratifiziertem SMR-01-Port und passender Plattformentscheidung:
durable Transaction, Receipts, Restart/Reconciliation, Backup, Import/Export,
Quarantäne und Migration. Eigene Host-/Crash-/Denied-write-/Low-space-
Abnahmen; nicht Teil von I01.

### Kernverträge und Umsetzung — I03 – GM-Anwendung und Consumeradapter

Erst nach ADR-/UI-Gate: Roster-, Party-, Scene-, Focus- und Pending-UX,
Tastatur/200 Prozent/Lokalisierung sowie Music/Weather/Shops/Karten-
Consumeradapter. Kein Passive Display; dessen sichere Projektion bleibt SMR-10.
