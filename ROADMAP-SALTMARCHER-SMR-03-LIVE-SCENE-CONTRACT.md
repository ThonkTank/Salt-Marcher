# SMR-03-P01: Party-, LiveScene- und Live-Session-Vertrag

Status: **Campaign/Data-Peerreviews R01/R02 `CHANGES_REQUIRED`; reparierter
Plankandidat vor erneutem Exact-SHA-Review; nicht ratifiziert und ohne
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
repariert auch diese Löschgrenze; keiner der Vorgänger besitzt einen PASS.

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
  eine andere Scene um.
- Deaktivierung ist im Party-Besitzer autoritativ. Die Figur wird aus jeder
  Scene und allen Masken entfernt. Fehler in nichtdestruktiven abhängigen
  Projektionen rollen die Party-Entscheidung nicht zurück, sondern erzeugen
  ausschließlich betroffene, sichtbare Reconciliation-Pflichten.
- Permanente Charakterlöschung ist dagegen ein bestätigter, unteilbarer
  Mehrbesitzerbefehl: Vor der sichtbaren Löschung des Party-Records müssen
  sämtliche teilnehmenden Scene-, Masken- und Combat-Besitzer die Entfernung
  jeder lebenden CharacterId-Referenz erfolgreich validiert, vorbereitet und
  in denselben durablen Publish-Entscheid eingebracht haben. Scheitert oder
  fehlt ein erforderlicher Besitzer vor Publish, bleibt der Character samt
  Referenzen unverändert erhalten und der Befehl scheitert sichtbar. Nach
  Publish darf weder eine Fachprojektion noch eine Retry-/Undo-History die
  gelöschte CharacterId als lebend oder wiederherstellbar ausgeben.
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

Während einer abhängigen Reconciliation wird eine betroffene Figur nicht aus
einer veralteten Scene- oder Maskenprojektion als aktuell angezeigt. Stattdessen
zeigt die Live Session ihre stabile CharacterId, die beabsichtigte Zielgrenze
und einen strukturierten Pending-/Retry-Zustand. Unbetroffene Scenes und Masken
bleiben verwendbar.

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
- Charakterlöschung entfernt sämtliche lebenden Scene-/Masken-/Combat-
  Referenzen in derselben bestätigten Veröffentlichungsgrenze, bevor der
  Party-Record sichtbar verschwindet. Abgeschlossene historische Fakten bleiben
  nach SMR-01 erhalten, zeigen die permanent entfernte Identität aber als
  `[UNKNOWN]`; nur ein noch tatsächlich recoverable Trash-Objekt darf verlinkt
  bleiben. Eine betroffene Undo-History darf die gelöschte CharacterId weder
  wiederherstellen noch erneut referenzierbar machen; erneute Anlage erzeugt
  immer eine neue stabile CharacterId.
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
  Primary-Übertragung. Masken- oder andere nachgelagerte Owner dürfen danach
  sichtbar pending bleiben und blockieren die autoritative Zuordnung nicht.
- Location-Wechsel ersetzt nur abgeleitete Location-Projektionen. Persistente
  Inhalte am alten Ort bleiben beim Orteigentümer; gepinnte oder mit genau
  einer Partyuntergruppe reisende Inhalte folgen nur mit eigener stabiler
  Identität und bestätigtem Befehl.
- Prepared-Scene-Import erzeugt jedes Mal eine neue unabhängige Runtime-Kopie
  mit Quellenprovenienz. Spätere Planänderungen mutieren die Runtime-Kopie
  nicht. Nur aktive, aktuell unzugeordnete Teilnehmer werden übernommen.

## Runtime-Masken

Encounter, Chase und spätere Masken überlagern die kontinuierlich bestehende
LiveScene. Mehrere Masken desselben oder verschiedener Typen dürfen gleichzeitig
existieren; ein Teilnehmer darf in mehreren Masken vorkommen.

Jede Maskenprojektion nennt mindestens CampaignId, LiveSceneId, stabile MaskId,
MaskKind, OwnerIdentity, OwnerRevision, Teilnehmerreferenzen und Lifecycle-
Status. Der Maskenbesitzer hält fachlichen Ablauf, History und Persistenz. Scene
führt keine kopierten Combat-/Chase-Zustände.

Eine bestätigte Teilnehmerbewegung oder Deaktivierung entfernt die CharacterId
aus allen betroffenen Masken, blockiert aber die autoritative Party-/Scene-
Entscheidung nicht. Fehlgeschlagene nichtdestruktive abhängige Maskenupdates
werden sichtbar pending; veraltete Masken werden nicht als synchron
dargestellt. Für permanente Charakterlöschung gilt stattdessen die unteilbare
Löschgrenze: Jeder Masken-/Combat-Besitzer mit einer lebenden Referenz ist ein
erforderlicher Publish-Teilnehmer; sein Ausfall lässt Character und Referenzen
vor Publish unverändert und erzeugt keinen Zustand „gelöscht, Cleanup pending“.
Completion einer Maske beendet niemals die LiveScene. Fehlende oder ausgefallene
Maskenprovider lassen Scene, Party, Notizen und andere Masken weiter nutzbar,
verhindern aber eine permanente Löschung, solange sie eine lebende Referenz
besitzen.

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

Permanente Charakterlöschung ist ausdrücklich keine solche vorgezogene
Party-Mutation. Ihre Stage-/Validate-Receipts schließen Party sowie jeden
Scene-, Masken- und Combat-Besitzer mit lebender CharacterId-Referenz ein. Der
gemeinsame Publish-Entscheid macht Referenzentfernung und Party-Record-Löschung
zusammen sichtbar; vor Publish ist alles alt und gültig, danach existiert keine
lebende Referenz mehr. Recovery rollt den vollständigen vorbereiteten Befehl
zurück oder finalisiert ihn vorwärts. Ein `pending`-Cleanup nach sichtbarer
Löschung, partieller Erfolg oder Undo auf dieselbe CharacterId ist unzulässig.

Restore behält Campaign-, Character-, LiveScene-, Masken- und
Referenzidentitäten. Import erzeugt eine neue Campaign und remappt jede
campaignlokale Identität und interne Referenz atomar bei erhaltener Topologie.
Copy folgt der SMR-01-Closure-Regel. Trashing oder Löschen einer Campaign darf
keine Ersatz-Campaign, Scene oder Party implizit aktivieren.

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

1. Eine neue, kopierte und importierte Campaign bleibt ohne LiveScene gültig;
   ausdrückliches Continue initialisiert genau eine Primary Scene idempotent.
2. Innerhalb einer initialisierten Campaign bleibt bei leerer Party genau eine
   leere Primary Scene; direkte Löschung ist unmöglich.
3. Aktivierung mit validiertem Focus ordnet genau der gebundenen Ziel-Scene zu;
   ein Focus-Race wird stale abgewiesen und lenkt nie auf den neuen Focus um.
4. A/B/A: jede aktive Partyfigur erscheint in genau einer Scene, inaktive in
   keiner; Campaignwechsel vermischt keine IDs, Focus- oder Maskenzustände.
5. Split und Rejoin bewahren Party-Mitgliedschaft, bewegen jede CharacterId
   genau einmal, räumen nur die bestätigte leere Source auf, übertragen die
   Primary-Rolle ausdrücklich und löschen keine ortsgebundenen Inhalte.
6. Deaktivierung bleibt bei Fehlern nichtdestruktiver abhängiger Projektionen
   genau einmal Party-autoritativ; nur betroffene Contexts werden pending,
   stale Contexts werden nicht als synchron gezeigt und Retry dupliziert nichts.
   Permanente Löschung veröffentlicht dagegen erst, wenn alle lebenden Scene-,
   Masken- und Combat-Referenzen in derselben Grenze entfernt werden können;
   Providerfehler lassen den Character samt Referenzen unverändert, und nach
   Erfolg kann Undo dieselbe CharacterId nicht wiederherstellen.
7. Zwei Masken verschiedener Typen und zwei Masken desselben Typs dürfen
   Teilnehmer teilen. Ein Scene-Move entfernt die Figur aus allen betroffenen
   Masken, ohne andere Teilnehmer oder Masken zu ändern.
8. Focuswechsel ändert ausschließlich Focus/Fokusprojektion. Primary Scene,
   Partyzuordnung, Uhren, Travel, WorldEffects und Campaign-weite manuelle
   Music-Entscheidungen bleiben unverändert; ein LiveScene-Override wird nur
   nach frischer Projektion suspendiert/aktiviert.
9. `none`, stale, beschädigte oder fremde Focus-/Scene-Referenzen speisen keine
   Music-, Weather-, Shop-, Karten- oder Passive-Display-Projektion mit alten
   Daten. Unabhängige manuelle Arbeit bleibt nutzbar.
10. Campaignwechsel und Neustart stellen nach ausdrücklichem Continue Focus,
    Scenes, Masken, SceneClock-Verweise und Pending-Reconciliation vollständig
    wieder her; unbestätigte Drafts werden nicht zu Fachwahrheit.
11. Restore bewahrt alle Identitäten. Import remappt alle campaignlokalen IDs
    und Referenzen in eine unabhängige Campaign, ohne Topologieverlust oder
    Rückreferenz; Konflikte bleiben fail-closed.
12. Ausfall eines Masken-, Music-, Weather-, Shop-, Karten- oder
    Passive-Display-Providers lässt Scene, Party, Notizen, bestätigte Arbeit
    und Preservation nutzbar. Complete Export bleibt nur dann Complete, wenn
    er jedes erforderliche verifizierte Medium und alle retained
    Capability-Daten enthält und nichts still auslässt. Fehlende oder
    unrecoverable Daten erlauben ausschließlich einen getrennt bezeichneten
    Salvage-Export, dessen Manifest jede betroffene stabile Identität,
    erhaltene Metadaten und Auswirkung nennt; kein stilles Downgrade.
13. Name-only-Erstellung, zwei gleichnamige Rosterfiguren und das Leeren jedes
    optionalen Profilfelds erhalten stabile Identitäten, echte Abwesenheit und
    inaktive Mitgliedschaft ohne Scene-/Travel-Nebenwirkung.
14. XP-Zuteilung/Korrektur, ausgewählte Short-/Long-Rests und
    Adventuring-Day-Berechnung ändern keine Scene-Zuordnung. Eine planning-only
    expected Party verändert weder Roster-Mitgliedschaft noch LiveScene.
15. Der repräsentative technische Fall mit 20 Rosterfiguren, vier unabhängig
    getakteten Scenes, acht Masken und 50 Teilnehmern erfüllt die TN-21-
    Livebudgets; die großen Profile truncaten oder vermischen keine Wahrheit.
16. Tastatur, 200-Prozent-Skalierung, lange Namen, `pending`/`unavailable` und
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
