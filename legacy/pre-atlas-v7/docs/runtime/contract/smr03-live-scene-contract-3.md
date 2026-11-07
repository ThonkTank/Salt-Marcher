# Fachliche Abnahmekriterien

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

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
22. Tastatur, 100 %-Skalierung, lange Namen, `pending`/`unavailable` und
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

Die Desktopanwendung verwendet [SQLite-Commands](../../../src/app/storage/live.ts), [Maskenabgleich](../../../src/app/storage/mask-health.ts) und [GM-Oberfläche](../../../src/app/runtime/live.ts). Gesamt-E2E-02 und weitere Plattformen bleiben getrennt zu belegen. Die providerunabhängige immutable Sourceprojektion aktiviert keine Playerausgabe: absent/disabled bleibt Default-Deny. Vor einer SMR-10-Bridge sind Knowledge-/Perception-/Fog-/Camera-Filter sowie TN-21/TN-24/TN-31 und AC-L10/AC-T07 zu belegen. Music/Weather/Shops erhalten immutable Focus-/LiveScene-Consumer mit none/stale/Fehlerzuständen; Capability-, Cancellation- und Recoverygrenzen bleiben erforderlich.

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
Das ist keine vollständige Tastatur-/100 %- oder Betriebssystemabnahme.
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
| Party auf kleinem Raum lesen | `party-topbar-ui.ts`, `party-overview.ts`, `index.html`, bestehende Styles: kompakter Teilstand oben. Keine zweite Fortschrittsrechnung. Vorher bestand nur die flüchtige820px-Breite ohne Geometriepräferenz; neue Maße ersetzen keine fremde Shellgeometrie. | Weitere100 %-, vollständige Tastatur/Fokus- und Fenstermigrationsabnahme; die lokalen360/240px-Belege ersetzen sie nicht. |
| Mehrere Mitglieder bewusst ändern | Vorhandene `scene-roster`-Übernahme bindet die komplette Auswahl an Roster/Fokus/Scene-Revision und schreibt atomar; stabile CharacterIds, Auswahl außerhalb des Filters erhalten; andere Scenes nur über gemeinsamen Move | Store-/DOMfälle mit45 Figuren, gleichen Namen, Filter-ABA, Stale-Basis und atomarem Rollback sind unten beschrieben. Vollständige100 %-/OS-Abnahme bleibt offen; keine Schleife separat bestätigter Einzelbefehle ergänzen. |
| Gruppe gemeinsam bewegen | Bestehender `LiveAction.move` und Scene-/Maskenreconciliation; bestehendes/neues Ziel mit Ort und Mitgliedern, namenlose neue Scene mit geerbtem Ort/Uhr | Split/Rejoin samt divergenten Uhren, letzte Figur, Combat/Journey, Fehler/Replay; keine eigene Movefachlogik im Party-Popup. |
| Bestätigte Partyaktionen zurücknehmen | Bestehende `executeLive`-/`executeProgress`-/Lootreceipts und gezielte Vorher-/Nachherfelder inventarisieren; Schema und atomaren Historyanschluss in deren vorhandenen Transaktionen ergänzen | Erst echte XP-, Rast-, Profil-, Membership-, Move- und Lootfälle samt Konflikt/Replyverlust/Fresh schließen; danach 100 Schritte, Redobranch und Importinvalidierung. Keine Ableitung inverser Aktionen allein aus Text-/Anzeigehistory. Der normative Historyvertrag oben bleibt unverändert. |
| History sicher anbieten | Erst nach belastbaren Historycommands im Party-Popup vier Readzustände, aktuelle Undo-/Redoautorität, isoliertes Retry und Originalcommand-Recovery anbinden | Verspätete Antwort nach Close/Workspace-ABA, beschädigter Read ohne neue Schreibautorität, 240 px Fehler/Retry mit Tastatur. Quickfieldpräferenzen an ihrem tatsächlichen Installationsowner beteiligen; keine zweite DB nur wegen der Quellarchitektur einführen. |

Migrationen ändern keine alten XP-/Rastfakten, Profilinhalte oder historischen
Receipts still. Vor einer Shell-/Historymigration aktuelle lokale Persistenz und
Import-/Restorepfade prüfen; Source-Window- und Schema-42/43-Beispiele begründen
keine neue parallele Desktoparchitektur. Die vollständige Produktabnahme bleibt
offen, bis Nutzerwirkungen einschließlich Recovery und Migration belegt sind.
