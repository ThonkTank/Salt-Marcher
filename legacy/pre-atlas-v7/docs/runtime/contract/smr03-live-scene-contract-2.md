# LiveScene-Projektion

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

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
im [Campaignvertrag](../../campaign/contract/archive.md).
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
