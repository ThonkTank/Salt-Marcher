# SMR-03-P01: Party-, LiveScene- und Live-Session-Vertrag

Status: **Campaign/Data-Peerreviews R01/R02 und unabhängiger Architekturreview
R03 `CHANGES_REQUIRED`; Owner-abgestimmter Reparaturkandidat vor erneutem
Exact-SHA-Review; nicht ratifiziert und ohne Implementierungs-, Host- oder
Persistenzfreigabe.**

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
  TN-01 bis TN-03, TN-05, TN-07, TN-11, TN-15 bis TN-19, TN-21, TN-24,
  TN-27, TN-28, TN-31, TN-34 und TN-36.

Im Zielrepository bindet dieser Kandidat die reviewte SMR-07-Vertragssemantik
`94b1a15990b11a0cc00f3091ef24130a19a263a2` sowie den reviewten
SMR-01-Kandidaten `11e256309d43bcd1c14db66ffc41945c9360aec8` ein.
Beide bleiben getrennt ratifikationspflichtig. Java-, JavaFX-, Electron-,
JDBC- und historische Obsidian-Implementierungen sind ausschließlich
Verhaltensreferenzen, keine Zielarchitektur.

Der Campaign/Data-Peerreview R01 dokumentierte in
[Issue #1, Kommentar 6087727266](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6087727266)
zwei Pflichtlücken: Initialisierung bei bereits aktiver Party und die
Complete-vs-Salvage-Grenze bei Provider-/Medienschaden. Diese Fassung repariert
beide Punkte. Der fokussierte R02-Wiederreview dokumentierte in
[Issue #1, Kommentar 6087780040](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6087780040)
eine weitere Pflichtlücke: permanente Character-Löschung darf keine noch
lebenden Scene-, Masken- oder Combat-Referenzen hinterlassen. Diese Fassung
repariert auch diese Löschgrenze. Der vollständige Architekturreview R03 in
[Issue #1, Kommentar 6087888192](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6087888192)
forderte die explizite Auflösung widersprüchlicher Lösch- und Aktivierungsquellen,
vollständige Rejoin-/History-Verträge und eine Acceptance-Faultmatrix. Die
Campaign/Data-Entscheidung in Kommentar 6087908963 und die Music/Weather/Shops-
Ratifikation in Kommentar 6087913612 binden diese Reparatur. Keiner der
Vorgänger besitzt einen Architektur-PASS. Der R03-Wiederreview in Kommentar
6088021905 präzisierte Maskenautorität, dauerhaft fehlende Owner, Registry-
Vollständigkeit, Prepared-Import, Delete-Portabilität und Undo-Faults; die
Campaign/Data-Entscheidung 6088033502 bindet die capability-gebundene Erasure-
Grenze dieser Fassung. Der zweite R03-Wiederreview in Kommentar 6088109268
forderte exakte Target-/Survivor-Bindung, post-Publish Slot-Revisionssemantik
und die TN-05/TN-27-Auflösung; Campaign/Data-Entscheidung 6088120065 bindet
transportierte Tokens als nicht ausführbare Evidenz und lokales Import-Rebinding.
Der dritte R03-Wiederreview 6088191105 fand die verbliebene Export-
Zustandskollision und den absent-Provider-Bootstrap; die präzisierte
Campaign/Data-Entscheidung 6088202673 bindet die drei Zustände sowie den
providerunabhängigen, nicht ausführbaren Core-Quarantäne-Slot. Der vierte
R03-Wiederreview 6088273526 fand den providerlos fehlenden Abschlussweg;
Campaign/Data-Entscheidung 6088282319 bindet dafür ausschließlich die explizite
target-lokale Core-Envelope-Discard-Grenze.

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
Die Primary Scene kann nicht direkt gelöscht werden. Wird sie durch einen
bestätigten Rejoin vollständig leer, darf derselbe atomare Befehl die
Primary-Rolle auf seine ausdrücklich benannte, bevölkerte Ziel-Scene
übertragen und die leere Quelle entfernen. Eine leere letzte Primary Scene
wird nie entfernt.

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
aktuelle Wahrheit. Music, Weather, Shops, Karten und Passive Display konsumieren
nur ratifizierte immutable Projektionen und erhalten keine Scene-Interna.

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
- Wird eine nicht-Primary Scene leer, entfernt derselbe bestätigte Rejoin die
  leere Scene an der gemeinsamen Party-/Scene-Veröffentlichungsgrenze. Ist die
  leere Quelle Primary, gilt die oben definierte ausdrückliche
  Primary-Übertragung.
- Ein Rejoin nennt erwartete Source-/Target-Scene- und SceneClock-Revisionen
  sowie eine ausdrückliche GM-Zeitauflösung: bestätigte Source-Zeit, bestätigte
  Target-Zeit oder ein manuell bestätigter Auflösungswert. Sie setzt Target-
  Zeit/Revision vorwärts, archiviert/finalisiert die SourceClock und dreht weder
  Worldzustand, Geschichte noch eine andere Scene zurück.
- Derselbe Entscheid beschreibt den alten und neuen Primary- und Focus-Zustand.
  War Source fokussiert, wechselt Focus mit monotoner FocusRevision auf Target;
  war Target fokussiert, bleibt es Target mit neuer Revision; war eine dritte
  Scene fokussiert, bleibt sie unverändert. Source wird nie wieder `active`
  projiziert.
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
- Source-spezifische AmbienceOverrides sowie Weather-/Shop-Verfügbarkeiten
  werden archiviert oder suspendiert, niemals auf Target übertragen. Erst eine
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

Ein optionales passives Display liest ausschließlich die aktuelle sichere
Focus-/Scene-Projektion. Bei Focuswechsel, stale Revision, Providerfehler oder
`none` wird kein alter unsicherer Frame weiter als aktuell gezeigt. Es erhält
keine Schreibfähigkeit und keine GM-private oder mechanische Information.

## Acceptance vor jeder Implementierungsfreigabe

1. Eine neue, kopierte und importierte Campaign bleibt ohne LiveScene gültig.
   Ausdrückliches Continue mit einer bereits aktiven, geordneten Party erzeugt
   genau eine Primary Scene, ordnet alle aktiven IDs in Partyreihenfolge zu und
   publiziert Scene, Focus und Clock zusammen. Stale/unavailable Party vor
   Validate publiziert nichts; gleiche CommandId liefert dasselbe Receipt.
   Vollständiger LiveSession-Import ruft Init nie auf, beschädigter Import
   erzeugt keine synthetische leere Scene.
2. Innerhalb einer initialisierten Campaign bleibt bei leerer Party genau eine
   leere Primary Scene; direkte Löschung ist unmöglich.
3. Aktivierung mit validiertem Focus ordnet genau der gebundenen Ziel-Scene zu;
   ein Focus-Race wird stale abgewiesen und lenkt nie auf den neuen Focus um.
   Ein regulärer `unassigned`-Aktivzustand ist unmöglich; `pending` entsteht nur
   nach gespeicherter autoritativer Änderung mit abhängiger Reconciliation.
4. A/B/A: jede aktive Partyfigur erscheint in genau einer Scene, inaktive in
   keiner; Campaignwechsel vermischt keine IDs, Focus- oder Maskenzustände.
5. Split und Rejoin bewahren Party-Mitgliedschaft, bewegen jede CharacterId
   genau einmal, räumen nur die bestätigte leere Source auf, übertragen die
   Primary-Rolle ausdrücklich und löschen keine ortsgebundenen Inhalte.
6. Rejoin mit divergenten Source-/Target-Uhren verlangt eine ausdrückliche
   GM-Zeitentscheidung und erwartete Clock-Revisionen. Fälle mit Focus auf
   Source, Target und dritter Scene, Primary auf Source/Target, unavailable
   Maskenprovider sowie Crash/Restart liefern jeweils genau den festgelegten
   Focus-/Primary-/Clock-/Maskenausgang; keine Live-Projektion referenziert die
   entfernte Source. Source-Ambience/Weather/Shop-Verfügbarkeit wird nie auf
   Target übertragen und Target aktiviert erst aus frischer Projektion. Rejoin
   allein bewirkt niemals Masken-/Encounter-Completion, Transfer oder Folgen;
   ohne getrennte GM-Bestätigung werden übrige Teilnehmer/Inhalte nicht bewegt.
7. Deaktivierung bleibt bei Fehlern nichtdestruktiver abhängiger Projektionen
   genau einmal Party-autoritativ; nur betroffene Contexts werden pending,
   stale Contexts werden nicht als synchron gezeigt und Retry dupliziert nichts.
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
9. Zwei Masken verschiedener Typen und zwei Masken desselben Typs dürfen
   Teilnehmer teilen. Ein Scene-Move entfernt die Figur aus allen betroffenen
   Masken, ohne andere Teilnehmer oder Masken zu ändern.
10. Focuswechsel ändert ausschließlich Focus/Fokusprojektion. Primary Scene,
   Partyzuordnung, Uhren, Travel, WorldEffects und Campaign-weite manuelle
   Music-Entscheidungen bleiben unverändert; ein LiveScene-Override wird nur
   nach frischer Projektion suspendiert/aktiviert.
11. `none`, stale, beschädigte oder fremde Focus-/Scene-Referenzen speisen keine
   Music-, Weather-, Shop-, Karten- oder Passive-Display-Projektion mit alten
   Daten. Unabhängige manuelle Arbeit bleibt nutzbar.
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
19. Eine Faultmatrix für `InitializeLiveSession`, Split/Rejoin, Move,
    permanente Löschung, `QuarantineDiscard` sowie Undo und Redo injiziert
    Fehler vor, während und nach Stage, Validate, owner-lokalem Prepare,
    Publish, Verify und Finalize
    sowie Crash/Restart und unbekannten Ausgang—einschließlich zwischen
    HistoryReceipt und Owner-Reconciliation. Vor Publish ist ausschließlich
    Discard/Rollback, nach Publish ausschließlich Roll-forward sichtbar; nie
    partielle Fachwahrheit. Der ursprüngliche Ausgang wird vor einem neuen
    Versuch geklärt; keine zweite Umkehr oder doppelte Journey-/Combat-
    Reconciliation.
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

## Offene Ratifikations- und Review-Gates

- Campaign/Data ratifiziert pre-session Campaign, Import/Restore/Recovery,
  CampaignRevision und die fünf Phasen.
- Party ratifiziert Roster-/Membership-Autorität, Aktivierung/Deaktivierung,
  Profile, XP/Rest und CharacterId-Lifecycle.
- Encounter/Chase beziehungsweise jeder Maskenbesitzer ratifiziert
  Maskenidentität, Teilnahmeprojektion, Pending-Reconciliation und Completion.
- Scene/Time/Travel ratifiziert Primary/Focus-Trennung, SceneClock-Verweis,
  Split/Rejoin, Location/Travel-Grenze und Nicht-WorldEffect-Semantik.
- Music/Weather/Shops und Passive Display ratifizieren die immutable Focus-
  und LiveScene-Projektionen sowie `none`/stale-/Fehlerverhalten.
- Host/Security/Platform ratifiziert Capability-, Prozess-, Persistenz-,
  Cancellation- und Recovery-Realisierbarkeit ohne Fachautorität.
- Produkt-QA prüft später GM-Abläufe, ersetzt aber keine Eigentümerratifikation.

## Integrationsfolge

1. Campaign/Data- und Music/Weather/Shops-Peerreview dieses exakten Plans.
2. Unabhängiger Architekturreview; Befunde in einem getrennten Repairlauf.
3. Explizite Ratifikation aller betroffenen Eigentümer auf dem reviewten SHA.
4. Erst dann ein getrenntes Implementierungsplanpaket mit konkreten
   Contracts, Aggregategrenzen, Migration und Acceptance-Harness.
5. Domain, Persistenz-/Hostadapter, UI und Produkt-QA bleiben getrennte,
   jeweils reviewte Arbeitspakete.
