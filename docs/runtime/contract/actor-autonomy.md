# Actor Autonomy: bestätigte Zeit und persistente Grundlage

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-28 (begrenzter Quellenauftrag vor Autonomyausbau; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 15.10.2026. Dieser Fachplan konkretisiert [SMR-09](../../project/requirements/product-scope-2.md#smr-09--actor-autonomy), den [Produktumfang](../../project/requirements/scope.md) und den [Live-/Scenevertrag](smr03-live-scene-contract.md).

## Nutzerablauf und Grenze

Der GM aktiviert einzelne NPCs oder Gruppen, konfiguriert Bedürfnisse und
freigegebene Jobs und bestätigt Campaignzeit über eine Scene. Autonomy verarbeitet
diese Zeit in begrenzten Schritten. Auswahl, Ausschlüsse, Bewegung, Wartezeiten,
Unterbrechungen und Wirkungen bleiben geloggt. Partygefahr, eine inzwischen
geänderte Worldposition und ein bestätigter NPC-Stand nach der lokalen Scenezeit
pausieren den NPC für eine GM-Entscheidung. Ein zeitlich zurückliegender NPC kann
dagegen nur bis zur bestätigten lokalen Scenezeit aufholen (`catchUpAutonomy`).

Autonomy trifft keine Party- oder Erzählentscheidung, läuft nicht anhand der
Wall-clock und erzeugt oder löscht keine Autoreninhalte. Konfliktschaden und
Fallenreset bleiben ausdrücklich freigegebene, begrenzte Owneroperationen.

## Persistierter Vertrag

`storage/autonomy.ts` führt Actors, Jobs, bestätigte Intervalle, Zeitfronten,
Reservierungen, Job- und Ressourcenbuchungen, Logs und Commandreceipts. Ein
Intervall friert die damaligen Actorregeln, Jobs, Worldpositionen, Routen,
Feature-Revisionen und Dungeon-Snapshotreferenzen ein. Catch-up darf diese Fakten
nicht durch heutige Werte ersetzen.

Die Reader-, Wirkungs- und Backupgrenze prüft deshalb:

- SQL- und Payloadidentität sowie Revision aktueller Jobs und Actors,
- kanonische positive Intervallgrenzen mit bestehendem Sceneowner,
- vollständige historische Actorsteuerung, Needs, Wahrnehmungs-/Spurenregeln,
  World- und Dungeonpositionen,
- historische Jobs, Routen, Featurestände und eindeutige Dungeonreferenzen,
- interne Owner-, Raum-, Geschoss-, Element-, Stil-, Pfad-, Passage- und
  Volumenstruktur jedes `autonomy_dungeon_basis`-Snapshots,
- Zeitfronten, Reservierungs-/Actorstand, überschneidungsfreie exklusive
  Buchungen, Logowner und Receipt-Fingerprint/Fortschritt.

Historische IDs werden nur gegen Daten innerhalb desselben eingefrorenen
Snapshots gebunden. Ein gelöschter oder heute geänderter Raum, Job oder Ort macht
eine damals gültige Zeitbasis nicht rückwirkend ungültig. Referenzen auf den
gespeicherten Dungeon-Snapshot selbst müssen dagegen weiterhin auflösbar sein.

Campaign-Kopien remappen kampagnenlokale Identitäten. Der fachliche Logwert
`intervalId: "manual"` bleibt dabei in SQL und Payload unverändert; Actor- und
Campaignowner werden remappt.

Einzel-/Gruppen-Deaktivierung, manuelle Pause, Pendingpause bei Zeitkonflikt
und ausdrücklicher Jobabbruch geben zukünftige exklusive Buchungen an der
bestätigten Actorzeit frei. Beide Buchungstabellen (`autonomy_booking` und
`autonomy_target_booking`) behalten nur die ausgeführten Abschnitte. Die
frühere Zeit einer anderen Scene ist keine Rückrollgrenze für den Actor. Bereits
ausgeführte Buchungsteile bleiben erhalten. Die Freigabe selbst verwirft keinen
Jobfortschritt; Jobabbruch und begründete Pending-Neuwahl behandeln den Laufstand
ausdrücklich. Wiederaufnahme bucht den verbleibenden Zeitraum für Job und Ziel
neu. Ein belegtes Ziel wird dabei nicht gewaltsam übernommen.

Gruppen-Opt-in bindet zusätzlich die aktuelle Revision der vorbereiteten Gruppe
und loggt ihre ID/Revision je Actor. Deaktivierung pausiert die automatische Arbeit
und erhält den bestätigten Jobfortschritt; ausdrücklicher Jobabbruch bleibt eine
eigene Aktion. Gemeinsame Gruppenreise, Split/Merge und weitere Konfliktfolgen
brauchen noch atomare Operationen ihrer jeweiligen Owner.

## Begründete Pending-Entscheidung

Ein Zeitkonflikt bleibt als pausierter Actorstand erhalten, bis der GM ihn über
`accept-pending` ausdrücklich klärt. Pause-, Actor- und Gruppenbefehle dürfen
diesen Zustand nicht nebenbei aufheben. Die Oberfläche zeigt den Abstand zwischen
Actor- und Scenezeit aus den persistierten Entscheidungsfakten sowie den aktuellen
World- und gegebenenfalls Dungeonstand. Fortsetzen mit diesem Worldstand und das
Auslassen des Zeitraums verlangen beide eine Begründung; Auflösung und Begründung
werden geloggt und bleiben nach Fresh nachvollziehbar. Wiederaufnahme endet an
der bestätigten Scenezeit; spätere Intervalle bleiben ausstehend. Ist der Actor
bereits weiter, darf Resume ihn nicht zurückrollen: der GM lässt den veralteten
Zeitraum begründet aus.

Bei „Mit aktuellem Worldstand fortsetzen“ bleiben Job-ID, bereits geleisteter
Fortschritt und gespeicherter Dungeonweg erhalten, solange die vollständige
Positionsbasis einschließlich Revision unverändert ist. Erst der nächste normale
Step prüft Angebot, Weg und exklusive Belegung und bucht nur die verbleibende
Dauer. Die Entscheidung selbst bewegt weder Actor noch Zeit. Eine bewusste
Positionskorrektur oder „Zeitraum als GM auslassen“ verwendet weiterhin eine neue
Jobauswahl. Das Entscheidungslog hält bisherigen Job/Fortschritt und die Neuwahl
fest; diese Jobreferenz wird bei unabhängiger Campaignkopie remappt. Eine neue
Schema- oder Datenmigration ist dafür nicht nötig.

Die [Storegegenprobe](../../../tests/runtime/desktop-autonomy-disable-time.test.mjs)
prüft echte Zeitkonfliktpause, Fresh, begründetes Resume, verbleibende Dauer und
Receiptwiederholung. Sie trennt unveränderte Position, bewussten Ortswechsel und
Skip; ein spätes Log-Fault darf keine Teilentscheidung speichern. Native
Bedienung und eine unterbrochene räumliche Dungeonroute bleiben eigene Abnahmen.

## Lokale Belege und verbleibende Grenzen

| Verhalten | Bestehende Prüfungen |
| --- | --- |
| Historische Jobs, Regeln, Positionen, Routen, Features und Dungeonstruktur; unveränderte Fakten und Backupschutz | [autonomy-persistence-integrity.test.ts (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/shared/core/autonomy-persistence-integrity.test.ts), `tests/runtime/desktop-autonomy-interval-integrity.test.mjs` |
| Aktuelle Jobidentität und Steuerwerte; Zeitbestätigung, Backup/Export und rein lesende Fallenangebote | `tests/runtime/desktop-autonomy-jobs-integrity.test.mjs` |
| Unabhängige Sceneuhren, begrenzte Fortsetzung, persistente Pause und begründete Auflösung nach Fresh | [autonomy-scene-time-boundary.test.ts (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/shared/core/autonomy-scene-time-boundary.test.ts), [autonomy-time-conflict-ui.test.ts (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/shared/core/autonomy-time-conflict-ui.test.ts) |
| Kampagnen-/Aktivierungswechsel, verspätete Reads und Commands, gemeinsame Flushes und Abbruch vor oder nach dem ersten Schritt | [desktop-autonomy-context.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/runtime/desktop-autonomy-context.test.mjs) |
| Sprachunabhängige Job-/Routenreihenfolge in Vorschau, Ausführung, Replay und Fresh | `tests/campaign/desktop-autonomy-order.test.mjs` |
| Bewegung, Trap-Reset und Konfliktwirkung mit spätem Logfehler; vollständiger Rollback, Retry und Replay | [autonomy-owner-atomicity.test.ts (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/shared/core/autonomy-owner-atomicity.test.ts) |
| Inaktive Zeit übersprungen, Standard-/Custom-Needs bei Kopie erhalten, Einzel-/Gruppenreservierungen sowie Pending-Zeitkonflikte freigegeben; neue Buchung durch anderen NPC, spätes Log-Fault/Rollback und atomare Rasten | `tests/runtime/desktop-autonomy-disable-time.test.mjs` |

Diese SQLite-/kontrollierten DOMbelege schließen weder alle Ownerwirkungen noch
native Bedienung, echten Prozessabbruch, Cancel oder die Gesamtqualifikation.
Historische Fakten bleiben erhalten; fehlende aktuelle Aktivität ist keine
fehlende historische Identität. Defekte Daten werden erklärt, nicht still repariert.

## 200-Actor-Baselines

`npm run bench:autonomy` misst je 20 unabhängige Läufe mit 200 aktivierten Actors,
15 Minuten bestätigter Zeit und höchstens zwölf Catch-up-Schritten je Actor.
Die Minimalbaseline hat einen unplatzierten Guard-Job; die räumliche Baseline
fünf erreichbare Guard-Angebote, einen Dungeon-Snapshot und höchstens etwa elf
Meter Abstand zum Ziel. Der dokumentierte lokale Lauf vom 14.10.2026 ergab p95
Capture/Catch-up samt View/separate View: 25,61/348,31/13,37 ms beziehungsweise
38,65/1.094,55/16,90 ms. Höchster beobachteter Worker-RSS: 112.799.744 bzw.
204.947.456 Bytes. Das qualifiziert diese Quellzustände, keine beliebige Last.

Ein atomarer Bewegungsabschnitt publiziert einen Trace mit vollständigem Pfad
und ein Signal statt einer Publikation je 1,5-m-Routenpunkt. Der dokumentierte
mediane SQLite-Seitenzuwachs der räumlichen Erstbewegung sank dadurch von
2.359.296 auf 1.171.456 Bytes; der Minimalfall belegte 344.064 Bytes. Erstschritte
sind keine Langzeit-Wachstumsrate. Der DOM-Test prüft sofortigen Status und einen
gesperrten Startknopf bei offener Antwort, keine native Reaktionszeit.

## Aktivierungswechsel und offene UI-Aufträge

`autonomy-ui.ts` bindet Leseantworten, Commandantworten, Formularflush und
mehrteilige Nachholläufe an eine konkrete Aktivierung, auch wenn derselbe
Workspace mit demselben Token erneut geöffnet wird. Alte Antworten dürfen weder
`data` noch Formulare, Status oder den Startknopf eines neuen Laufs übernehmen.
Der ursprüngliche Storecommand bleibt unter seinem ursprünglichen Campaignowner;
seine bereits bestätigten Wirkungen werden durch einen UI-Wechsel nicht gelöscht.
Ältere Reads verlieren außerdem gegen einen späteren Read oder gestarteten Write.

Jeder Nachhollauf besitzt sein eigenes Abbruchsignal und seinen Abschluss. Ein
Abbruch während vorbereitender Formularspeicherung verhindert den ersten
Catch-up-Command. Während eines bereits gesendeten Commands stoppt er weitere
Chunks; der laufende atomare Command kann noch bestätigen. Das ist ausdrücklich
**kein Vor-Commit-Cancel** innerhalb der synchronen SQLiteausführung. Ein alter
Lauf kann einen neu gestarteten nicht entsperren oder unter dessen Campaign-ID
weitermachen. Mehrfachstart öffnet nur einen Lauf.

Formularstufen prüfen ihre Aktivierung zwischen Route, Job und Actor. Dirty-
Versionen halten spätere Eingaben während einer offenen Speicherung fest; ein
Flush verarbeitet diese anschließend mit der neuen bestätigten Revision. Ein
alter Finalizer kann keinen neuen Pendingflush freigeben. Keine zusätzliche
Persistenz oder Simulation. `desktop-autonomy-context.test.mjs` prüft echte
SQLitezustände über kontrollierte DOM-/IPC-Antworten; diese Verzögerungen sind
keine nativen Latenz- oder Cancelnachweise. Der reproduzierbare native Prüfweg
`node tools/test-desktop-autonomy.mjs` prüft die Fallen-Auswahl, einen als GM
angelegten Wachjob, ausdrückliches Actor-Opt-in, bestätigte Scenezeit und
Nachholen. Er prüft nach erneutem Nachholen und nativem Neustart unveränderte
Ergebnisse und ursprüngliche NPC-Textbytes sowie normales Prozessende. Mit
Derselbe Ablauf läuft ausschließlich bei 100 Prozent. Kampagnenwechsel,
verzögerte Antworten und Abbruch während eines offenen Commands bleiben durch
diese Probe nativ unqualifiziert.

Die Autonomieansicht liest ihre Fallen-Angebote direkt mit
`readDrawingElements` aus dem Drawing-Owner. Der Reader behält Prüfsummen-,
Identitäts-, Werte- und Platzierungsprüfungen bei. Die vollständige Dungeonansicht
mit Keys, Wegen, Passagen, Volumen und Featurezuständen wird dafür nicht aufgebaut.
`desktop-autonomy-jobs-integrity.test.mjs` vergleicht die konkrete Fallenliste,
prüft rein lesenden Zugriff und den vollständigen Command-Rollback bei beschädigten
Elementquellen. Im kleinen Vergleichsfall sinken vorbereitete SQL-Anweisungen von
25 auf 16; das ist keine allgemeine Latenz- oder 200-Actor-Qualifikation.

## Quellenklärung vor dem jeweiligen Autonomystep

SMR-09/SMR-AC-13 bleibt eine eigene offene Abnahme. Anders als beim
Wonderdraft-Vergleich gibt es hier keinen behaupteten Originalbedienbeleg:
Die [gebundene Autonomyquelle](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/autonomy/requirements/requirements-actor-autonomy.md)
und der Vertrag oben besitzen die Regeln. Vor Ausbau einer Job-/Konfliktfamilie
zuerst nur deren Needs, Auswahl/Ausschlüsse, Reservierungen, Partygrenze und
bestätigte Zeit gegen die relevanten Quellenabschnitte prüfen; bestehende
selektive Storebelege anschließend zuordnen.

Kleine Handlungsprobe für den gewählten Schritt: ein aktivierter Actor, zwei
konkurrierende erreichbare Angebote, ein belegtes Ziel und eine Partygrenze.
Eingefrorene Inputs, erklärbare Auswahl, erlaubte Ownerwirkung und geloggte
Unterbrechung benennen; Cancel/Retry/Restart und unabhängige Campaignkopie müssen
denselben bestätigten Verlauf erhalten. Ein späteres Owner-Nein darf keine
Teilbuchung oder Fremdwirkung veröffentlichen. Korrektur ergänzt die Geschichte
nach dem geltenden Vertrag; kein allgemeines Autonomy-Undo ableiten.

Bei einem echten Quellenkonflikt vor Umsetzung Alternativen samt Folgen für
GM-Autorität, bestätigte Zeit und bestehende Fakten sowie eine Empfehlung
festhalten. Fehlende aktuelle Belege bleiben als Prüfaufgabe offen; erst den
geklärten Schritt nach Codeprüfung schätzen. Stadtlebensdaten entscheiden keine
autonome Ausführung. Die folgenden vorhandenen Arbeitspakete bleiben maßgeblich;
Terrain/Meer und der bestätigte Flussabschluss warten nicht auf diesen Ausbau.

## Nächste ausführbare Schritte

1. **Bestehende Zeit-/Ownergrenze vollständig qualifizieren.**
   `storage/autonomy.ts`, `autonomy-dungeon.ts`, `autonomy-resources.ts` und
   Scene-/Wirkungsowner gemeinsam prüfen: historische Configänderung bei offener
   Zeit, Aktivierungsgrenzen, lange Pause, belegtes Resumeziel und Positionsoverride.
   Mehractor-Rollback nach erster erfolgreicher Fremdwirkung ist durch
   `desktop-autonomy-interval-integrity.test.mjs` lokal belegt; weitere kombinierte
   HP-/Feature-/Ressourcenwirkungen und echter Prozessabbruch bleiben offen.
   Alter oder kompletter neuer Schritt, dieselbe Command-ID ohne zweite Wirkung,
   Fresh und unabhängiger Campaigntransfer sind jeweils eigene Abnahmen.
2. **Abbruch und reaktionsfähige Ausführung schließen.** Die aktuelle synchrone
   Transaktion unter `executeAutonomy` nicht als cancellable Worker ausgeben.
   Vor einer Auslagerung tatsächliche langlaufende Actor-/Routenpopulation messen.
   Falls nötig, vorhandenen Main-/Storageowner um abgegrenzte Vorbereitung,
   Fortschritt und überprüften Commit ergänzen: Cancel vor Commit hinterlässt
   weder Needs-/Job-/Fremdwirkungen noch Randomresultate/Receipts. Nach Commit
   bleiben Originalfakten erhalten. Unabhängige Reads, Kamera und Auswahl während
   Arbeit nativ prüfen; Fortschritt ≤100 ms und 200 Actors ≤2 s p95 bleiben
   gebundene Qualifikationsziele, keine aus den obigen Teilmessungen abgeleitete
   Gesamtzusage.
3. **Gruppenverhalten auf individuellen Fakten aufbauen.** `group-enable` ist
   Opt-in, noch keine gemeinsame Gruppenreise oder autonome Split-/Mergefähigkeit.
   Bestehende Gruppen-/Positionsowner müssen konfigurierte gemeinsame Jobs,
   Reservierungen, dringlichen individuellen Austritt und erlaubtes Zusammenführen
   atomar anbieten. Individuelle Identitäten und historische Bindungen erhalten;
   keine zweite NPCidentität oder Neuberechnung alter Intervalle. Abnahme:
   exklusives Ziel, Teilgruppen-Partyberührung, unzulässiger Split und spätes
   Owner-Nein lassen keine halbe Gruppe/Buchung zurück.
4. **Jobfamilien und begrenzte Folgen vollständig anbinden.** Aktuelle Jobs und
   HP-Verlust ohne Todesfolge sind ein Teilstand. Erlaubte Flucht/Position,
   Gefangenschaft, Verletzung/Tod, Verbrauch und Besitztransfer brauchen jeweils
   eine ausdrückliche idempotente Owneroperation und konfigurierte Schutzgrenzen.
   Fehlender Owner macht nur das betroffene Angebot unzulässig. Kritische
   nichtunterbrechbare Teilschritte dürfen Party-/GM-Grenzen nie überschreiten.
   Wahrnehmung, höherer Bedarf, Prioritäten und Zielverlust unterbrechen am
   fachlichen Schritt; die Wiederaufnahme prüft Reservierung/Erreichbarkeit neu.
   Abnahme: dieselben Kandidaten deterministisch gewählt; ausschließlich
   Konfliktwürfe zufällig, mit vollständigen Inputs, Referenzen, Modifikatoren,
   Schutzentscheidung und Ergebnis dauerhaft auditierbar; spätes Owner-Nein
   rollt den gesamten unbestätigten Schritt zurück.
5. **Den vollständigen GM-Fluss abnehmen.** Aktivieren, konfigurieren,
   Entscheidung inspizieren, bestätigte Zeit, Hintergrundkontext öffnen,
   Partygrenze begründet klären, normale Ownerkorrektur und Restart am gleichen
   Build. Fokus/Rohwerte, A/B/A, Antwortenverlust, Cancel, Tastatur/100 % und
   200 Actors mit realen Wegen und Logwachstum nativ prüfen. Korrekturen ergänzen
   Geschichte; kein stilles Autonomy-Undo oder Identitätslöschen. Die vorhandenen
   Store-/DOMfälle und Baselines begrenzen diesen Pflichtumfang nicht.

Dossier, Gespräche und die Wiederaufnahme ungeklärter Profilübernahmen stehen im [NPC-Vertrag](../../campaign/contract/npc-dossiers.md).

## Aktuelle Entscheidungsinspektion ab0.123

„Entscheidung ansehen“ öffnet je NPC die gespeicherte Jobauswahl mit Bedürfnissen,
Prioritätsbeiträgen, deterministischem Gleichstand, Weg-/Restdauer und allen
zulässigen/abgelehnten Angeboten. Suche, Statusfilter und 20erSeiten begrenzen die
Anzeige, nicht den ausgewerteten Angebotsumfang. Laufende Jobs und eine mögliche
Unterbrechung werden benannt. Pausen, fehlendes Opt-in, Worldpositionsabweichungen
und erkennbarer Party-Kontakt stehen als Ausführungsgrenzen separat daneben.

Der nächste offene bestätigte Zeitraum verwendet seinen eingefrorenen Regelstand.
Ohne Restzeit ist es ausdrücklich eine Vorschau mit aktueller Konfiguration;
offene Formulareingaben zählen nicht. Es wird keine Zeit genehmigt, kein Zufall
gewürfelt, kein Ziel reserviert und kein Log/Geometriesnapshot gespeichert.
Dungeon-Geometrie für die heutige Vorschau wird ausschließlich im Speicher
gelesen; historische Inspektion benutzt vorhandene bestätigte Snapshots. Die
Simulation verwendet weiterhin denselben Selektor und prüft aktuelle Owner-/
Partygrenzen vor tatsächlichen Bewegungen und Wirkungen erneut. Eine Vorschau
ist keine vorweggenommene Ausführungszusage.
