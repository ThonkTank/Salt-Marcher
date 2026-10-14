# Actor Autonomy: geprüfte Jobangebote und Zeitwiederaufnahme

Stand: 14.10.2026. Dieser Fachplan konkretisiert [SMR-09](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-09--actor-autonomy), die [Produktziele](../../PRODUCT.md), den [vollständigen Produktumfang](../../SCOPE.md), die [Lieferfolge](../../ROADMAP.md), den [Live-/Scenevertrag](smr03-live-scene-contract.md) und die [festgeschriebene Originalanforderung](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/autonomy/requirements/requirements-actor-autonomy.md).

## Anforderungen und vorhandener Anschluss

Die gepinnten `docs/autonomy/requirements/requirements-actor-autonomy.md`, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, verlangen ausdrücklich aktivierte
NPCs/Monster, bestätigte Campaignzeit, erreichbare Jobs und Reservierungen,
begrenzte Ownerwirkungen, Pausen vor Partygefahr und erklärbare atomare Folgen.
Der geprüfte Quellenhash entspricht
`95c42de5341aa005de49e0e5aea8c426f8793ea41ac1a96170a76ee0210abf0c` im Register.
Keine Wall-clock-Simulation, autonome Partyentscheidung oder Löschung von Identitäten.

`storage/autonomy.ts` speichert Actors, Jobs, bestätigte Intervalle, Reservierungen,
Buchungen, Logs und Receipts. `captureAutonomyBasis` bindet damalige Actor-/Job-/
Raum-/Routeneingänge; `recordAutonomyTime` hält den bestätigten Zeitrahmen fest.
`catchUpAutonomy` arbeitet begrenzt und hält bei einer späteren externen
Positionskorrektur an. Dungeon-/Ressourcen- und NPC-Owneroperationen stehen in
`autonomy-dungeon.ts`, `autonomy-resources.ts`, `npc-world.ts` und den jeweiligen
Raum-/Actorports. Die UI bietet Konfiguration, Angebote, Zuweisung und Catch-up.
Das ist ein Teilanschluss, keine vollständige SMR-AC-13-Abnahme.

## Geschlossene Lücke bei aktuellen Jobs

Vier SQLite-Gegenproben zeigten: korrekt gehashte Jobpayloads mit falscher ID oder
Revision wurden gelesen; nichtboolesche Schalter und ungültige Rollen-/Bedürfnis-
Formate konnten gespeichert oder gelesen werden. Ein Bytehash belegt keine
gültige Jobkonfiguration. Die globale Backupprüfung erkannte bereits beschädigte
Prüfsummen; die fachliche Jobprüfung fehlte dagegen.

`checkedAutonomyJob` in `autonomy-contracts.ts` ist jetzt die gemeinsame
Shape-/Wertprüfung für Schreibweg, aktuelle Query und Backup. `checkedJobRow`
bindet Payload-ID/Revision an die SQL-Zeile. `captureAutonomyBasis` benutzt
denselben geprüften aktuellen Reader, sodass eine ungültige Jobbasis keine neue
bestätigte Zeitwirkung erhält. Optionale spätere Dungeonfelder bleiben optional;
Custom-Needs bleiben zulässig. Historische Inhalte werden nicht neu geschrieben.

Sechs Prüfungen in `desktop-autonomy-jobs-integrity.test.mjs` belegen ungültige
Jobsteuerung ohne Teilzustand/Receipt, Row-/Payloadwidersprüche, abgewiesene
Zeitbestätigung ohne Wirkung, Backup-/Exportschutz sowie gültige Jobs nach Fresh
und unabhängiger Kopie mit unveränderten Paketbytes. Zusammen mit den 14 bestehenden
Autonomyprüfungen und 23 Chase-/Lootintegrationsprüfungen bestanden 43 Tests und
der Desktop-Typecheck. Das sind lokale SQLite-/kontrollierte DOM-Belege; native
Bedienung, Prozessabbruch, Cancel und gesamte Autonomyqualifikation bleiben offen.

## Historische Jobs und lokaler Mehractor-Rollback

`checkedIntervalRow` in `storage/autonomy.ts` prüft nun bestätigte Intervalle im
Catch-up und in der Backup-/Exportvalidierung: Intervall-/Scene-/Epochidentitäten,
positive Ordnungsnummer, kanonische nichtnegative Millisekunden und strikt
vorwärts laufende Zeitgrenzen; Actor-/Joblisten besitzen eindeutige Identitäten.
Jeder historische Job durchläuft `checkedAutonomyJob`. Dabei bleiben seine
aufgezeichneten Werte erhalten; heutige Jobrevisionen ersetzen sie nicht.

Drei korrekt gehashte Gegenbeispiele passierten zuvor den Reader: ungültige
historische Jobsteuerung, doppelte Jobidentität und umgekehrte Zeitgrenzen.
`desktop-autonomy-interval-integrity.test.mjs` prüft deren Ablehnung vor Wirkung,
unveränderte Datenbytes und erhaltene frühere Backup-/Exportdateien. Ein gültiger
historischer Job bleibt nach heutiger Jobänderung und Fresh unverändert.
Eine unabhängige Campaignkopie remappt die Actor-/Jobidentitäten in der
Intervallbasis konsistent und kann ihren Catch-up ausführen; die Paketbytes
bleiben unverändert. Die
bestehende Ownerrevisionregel pausiert Catch-up bei geänderter aktueller Quelle.

Eine weitere Storeprobe lässt den zweiten NPC-Positionsowner seine Bewegung
ablehnen, nachdem der erste Actor bewegt wurde. Der äußere Catch-up-Writer rollt
beide Actor-/Worldzustände, Logs, Buchungen und Commandreceipt zusammen zurück.
Ein erneuter bestätigter Command bewegt beide Actors genau einmal. Dieser lokale
Mehractorbeleg erweitert den bisherigen Jobnachweis; Hardcrash, Cancel und alle
Dungeon-/Trap-/Konfliktownerwirkungen sind weiterhin gesondert zu qualifizieren.

## Scenegrenze beim automatischen Catch-up

Der integrierte Zeitanschluss begrenzt `catchUpAutonomy` nun auf Epoch und
bestätigten Zeitpunkt der auslösenden Scene. Ein früherer bestätigter längerer
Zeitrahmen zieht einen Actor in einer zurückliegenden Scene nicht über deren Uhr
hinaus. Teilintervalle bleiben über Cursor und Offset fortsetzbar. Liegt der
bestätigte Actorstand schon später, pausiert er mit erklärtem Zeitkonflikt;
Bedürfnisse und Wirkungen werden nicht rückwärts simuliert.

`checkedIntervalRow` bleibt sowohl vor dieser Grenzauswahl als auch beim Lesen
des bestätigten Actorzeitpunkts wirksam. Die Zeitgrenze darf beschädigte
historische Jobs/Intervalle nicht zu scheinbar harmlosen übersprungenen Daten
machen. `tests/core/autonomy-scene-time-boundary.test.ts` prüft zwei unabhängige
Sceneuhren mit Teilfortsetzung und die Pause eines bereits späteren Actors.
Die sechs Intervall-/Mehractor-Rollbackprüfungen ergänzen diesen Anschluss;
alle Ownerwirkungen und native Zeitkonfliktbedienung bleiben gesondert offen.

## Aktivierungszeiten und Bedürfnisidentitäten bei Wiederaufnahme

Die Quellen L12–14, L79–86 und L167–176 binden Simulation an ausdrücklich
aktivierte Actors, bestätigte Campaignzeit und die damals geltenden Regeln.
`recordAutonomyTime` hielt zuvor bei einer leeren Actorbasis sofort an. War der
letzte Actor deaktiviert, blieb dadurch die Zeitfront stehen. Nach Reaktivierung
wurde der deaktivierte Zeitraum mit der neuen aktiven Konfiguration gefüllt.
Ein zweiter, unabhängiger aktiver NPC verhinderte den Fehler, weil dann weiterhin
Intervalle entstanden. Derselbe Aktivierungsablauf durfte davon nicht abhängen.

Die bestätigte monotone Zeitfront wird nun auch ohne aktive Actors gespeichert.
Es entsteht dafür kein erfundenes Actorintervall. Nach Reaktivierung beginnen
neue Regeln am nächsten tatsächlich bestätigten Zeitraum; vorhandene historische
Intervalle und Cursor bleiben erhalten. Die bestehende Epoch-/Scenegrenze und
konkurrierende frühere Scenezeiten werden weiterhin geprüft, nicht zurückgerollt.
Das verändert keine bereits gespeicherten Bedürfniswerte und repariert keine
historischen Intervalle automatisch.

Bei der Campaignkopie remappte der allgemeine IDwalker außerdem
`AutonomyActor.needs[].id` und dieselben historischen Konfigurationsslots.
Jobwirkungen benutzen diese fachlichen IDs jedoch als Schlüssel in `needEffects`.
`hunger` oder ein eigener Bedarf ist keine Campaignunitidentität. Der Corewalker
bewahrt diese Bedürfnisdefinitionen im konkreten Autonomiekontext jetzt exakt;
Actor-, Job- und Positionsreferenzen werden weiterhin auf die Kopie gebunden.
Manuelle Autonomielogs bewahren zusätzlich ihren festen `manual`-Intervallmarker
in SQL und Payload. Er ist keine zu remappende historische Intervall-ID.

`desktop-autonomy-disable-time.test.mjs` prüft zwei Minuten aktive Zeit mit einer
Stunde deaktivierter Zeit dazwischen: Hunger wächst um 0,1333 statt zuvor 4,1333,
mit und ohne unabhängigen NPC, nach Fresh sowie unabhängiger Kopie. Die Copyprobe
bewahrt normale und eigene Bedürfnisdefinitionen, historische Regeln und
Jobwirkungsschlüssel; ein bereits begonnener exklusiver Job wird fertig und
wendet seine Wirkungen auf beide Bedürfnisse an. Paketbytes bleiben unverändert.
Das qualifiziert diesen lokalen Aktivierungs-/Copyübergang, keinen vollständigen
Pause-/Gruppen-/200-Actor- oder nativen Wiederaufnahmevertrag.

Eine zusätzliche reale Gruppenprobe zeigte einen Writer-/Validatorwiderspruch:
Gruppen-Deaktivierung ließ eine aktive Reservierung des nun deaktivierten Actors
stehen. Die neue Persistenzprüfung lehnte dadurch ein vorher gesundes Backup ab.
`group-enable(false)` löst jetzt dieselbe aktive Reservierung wie die einzelne
Actor-Deaktivierung. Jobidentität, Fortschritt und historische Buchungen bleiben
erhalten; ein ausdrücklicher Gruppenbefehl setzt sie nicht zurück. Die Probe
führt den echten Gruppeneditor-/Draft-/NPC-/Jobweg aus und prüft Backup, Fresh
sowie anschließendes inaktives Catch-up. Die anschließende Gruppen-Reaktivierung und erneute exklusive Buchung nach Fresh
sind inzwischen in derselben Storeprobe geprüft; native Gruppenbedienung bleibt offen.

Der integrierte zeitgebundene Rastwriter bestätigt Partyfortschritt, Scenezeit
und World-/Autonomiefolgen in derselben Transaktion. Zwei zusätzliche reale
Storeproben verbinden ihn mit diesem Aktivierungsweg: eine kurze Rast nach einer
Stunde deaktivierter Autonomie simuliert ausschließlich die aktive Rastzeit.
Receipt-Replay nach Fresh hat dieselben JSON-Ergebniswerte und keine neue
Zeit-/Bedürfniswirkung. Ein abgelehnter Autonomieowner rollt Partyrest, Scenezeit,
Autonomiestand und beide Receipts gemeinsam zurück. Diese Proben verwenden einen
tatsächlichen gemeinsamen Scene-/NPC-Ort; unplatzierte NPCs werden nicht als
aktive lokale Owner ausgegeben. HP-/Slot-/D&D-Rastvollständigkeit und native
Gruppenbedienung sind damit nicht qualifiziert.

## Exklusive Pause, Deaktivierung und erneute Buchung

Eine reale Zweiactorprobe zeigte, dass Einzel-Deaktivierung und manuelle Pause
zwar die Live-Reservierung lösten, aber den ursprünglich bis Jobende gebuchten
Zeitraum behielten. Nach 60 ausgeführten Sekunden blockierten dadurch noch
540 nicht ausgeführte Sekunden andere Actors. Das betraf sowohl denselben Job
als auch einen anderen exklusiven Job am selben Ort. Die Live-Reservierung
allein beschreibt keine historisch zeitgebundene Konkurrenz.

`releaseActorReservation` in `storage/autonomy.ts` kürzt beide Buchungstabellen
an der geprüften bestätigten Actorzeit: Cursor/Offset bestimmen die tatsächlich
ausgeführte Grenze, nicht Wall-clock oder eine vorauslaufende andere Scene.
Einzel- und Gruppen-Deaktivierung sowie manuelle Pause verwenden dieselbe
Freigabe. Auch der ausdrückliche Jobabbruch benutzt diese Actorgrenze: der alte
Writer suchte ausschließlich ein nächstes Intervall und löste am bereits
ausgeführten Intervallende keine künftige Buchung. Zwei weitere Gegenproben
bestätigten ebenfalls 600 statt 60 Sekunden belegter Zeit. Der Abbruch löscht
den Jobfortschritt ausdrücklich; die ausgeführte Buchungsgeschichte bleibt erhalten. Vergangene Buchungsteile, Jobidentität, Fortschritt und Dungeonreise
bleiben erhalten. Fehlende oder ungültige Zeitgrundlagen werden nicht erfunden.

Die Live-Reservierung wurde bei Wiederaufnahme bereits erneut gesetzt.
`autonomy_booking` entstand dagegen nur bei Jobwechsel. Nach einer deaktivierten
Stunde setzte derselbe Job seine 60 Sekunden fort, ohne den neuen verbleibenden
Zeitraum zu buchen. `bookTarget` in `autonomy-resources.ts` bindet nun Job- und
Zielbuchung gemeinsam an den verbleibenden Zeitraum. Bereits abgedeckte Bereiche
erzeugen keine weitere Zeile. Kandidatenausschluss und deterministische Wahl
bleiben vor der Buchung wirksam; ein belegter Job wird nicht gewaltsam übernommen.

Acht zusätzliche Fälle in `desktop-autonomy-disable-time.test.mjs` prüfen
Einzel-Pause/Deaktivierung/Abbruch, zwei Actors mit demselben oder unterschiedlichen Jobs
am selben Ort, erhaltene Vergangenheit und Fortschritt, Fresh, Backup und die
erneute Buchung. Die Gruppenprobe prüft ebenfalls die Reaktivierung nach Fresh.
Eine Stunde ohne Simulation wird im Deaktivierungsfall geprüft; bei manueller
Pause wird unmittelbar nach Fresh wiederaufgenommen. Eine länger pausierte,
bereits bestätigte historische Basis sowie pausenbedingte Entscheidungen bleiben
separate Fälle. Historische Daten werden nicht nachträglich korrigiert.

## Neuer Persistenzgraph und Buchungsowner

Die integrierte Prüfung kontrolliert nun Zeitfronten, Receipts, Reservierungen,
Buchungsformen/-überschneidungen und Logs sowie deren erreichbare Corebezüge.
Die Prüfung erhält gültige historische Werte; ungültige Records werden weder
neu gehasht noch gelöscht. Backup und ausgewählter Export bleiben streng.
Catch-up darf eine widersprüchliche Buchungsgrundlage nicht als freien Job lesen.

Die SQL-Fremdschlüssel verhindern Buchungen mit fehlendem Actor oder Job im
normalen Schreibweg; Backup/Export erkennen sie bereits strukturell. Zwei
kontrollierte Gegenproben an beschädigten Arbeitsstores zeigten aber, dass
Catch-up solche formal gültigen Buchungen noch akzeptierte. Nur zur
Faultinjektion wurden Fremdschlüssel aus- und danach wieder eingeschaltet;
der normale Writer wurde nicht gelockert. `validateRuntimeLinks` prüft nun
vor der Verwendung beider Buchungstabellen, dass Actor und Job im selben
Campaignowner existieren. Eine SQL-Abfrage je Tabelle prüft diese Beziehung,
statt zusätzliche Ownerreader für jede historische Zeile aufzurufen.
Die Prüfung bindet erhaltene Identitäten, nicht allein heutige Aktivität;
alte Jobs dürfen deaktiviert bleiben. Catch-up hat bei Fehler keine Teilwirkung,
Backup/Export behalten ihren bestehenden strukturellen Schutz und erhalten den
sicheren Vorgänger. Historische Target-/Slotclosure bleibt gesondert offen.

## Abdeckung und verbleibende Produktlücken

| Originalanforderung | Aktueller Nachweis | Verbleibende Abnahme |
| --- | --- | --- |
| Opt-in für bestehende NPCs/Monster und Gruppen; Identität bleibt erhalten | Einzelaktivierung und revisionsgeschützte Aktivierung aller aktuellen Mitglieder einer bestehenden vorbereiteten Gruppe verwenden dieselben Actor-IDs. Aktivierung und Deaktivierung loggen Gruppen-ID und -Revision; Deaktivierung beendet laufende Arbeit und zukünftige Buchungen. | Gemeinsames Job-/Reiseverhalten sowie konfiguriertes Split und Merge fehlen. Der Sessionowner bietet dafür noch keine atomare Mitgliedschaftsoperation an. |
| Bedürfnisse, Rollen, erreichbare Jobs, Routen sowie exklusive Reservierungen und Zeitbuchungen | Needs und Prioritäten, Rollenfilter, World-/Dungeonpfade, Reservierungen und überlappungsfreie Buchungen liegen im produktiven Store. | Eine längere Campaignmessung muss noch zeigen, wie Intervall-, Buchungs- und Bewegungsdaten wiederholt wachsen. |
| Erklärbare deterministische Auswahl und stabiler Gleichstand | Jeder Jobwechsel loggt Grundpriorität, NPC-Bonus, konkrete Needbeiträge, bis zu sechs zulässige Kandidaten, bis zu sechs Ablehnungen, Restzähler und den Job-ID-Tie-break. Die Oberfläche zeigt diese Fakten aufklappbar. | Die native Tastatur-/Screenreaderprüfung der aufklappbaren Fakten bleibt offen. Die vollständige Kandidatenauswertung wird vertragsgemäß nicht dauerhaft gespeichert. |
| Einfache, vom referenzierten Feature angebotene Interaktion über dessen Owner | Der konkrete Trap-Owner bietet den atomaren, geloggten Resetjob an. | Ein allgemeiner Vertrag für weitere einfache Featureinteraktionen fehlt; er darf erst mit einem echten Featureowner ergänzt werden. |
| Begrenzter Nicht-Party-Konflikt mit geloggten Inputs, Würfen, Folgen und Schutzgrenzen | Angriff, Abwehr, Wurf, HP-Grenze und Schaden werden über den Actor-/HP-Owner atomar angewandt und kompakt geloggt; Partygefahr und Konzentration pausieren vorher. | Position/Flucht, Gefangenschaft, Verletzung/Tod, Ressourcenverbrauch und Besitztransfer sind noch nicht als freigegebene Owneroperationen modelliert. |
| Ausschließlich bestätigte Campaignzeit, atomare Steps, Pause/Cancel/Override und genau einmaliges Catch-up | Scenezeit erzeugt eingefrorene Intervalle; Cursor, Ownerwirkungen, Buchungen, Logs und Receipts committen gemeinsam. Pendingentscheidungen verlangen eine Begründung und überleben Fresh. | Abbruch vor Commit und lange Begründungen müssen noch nativ bedient werden; ein Hardcrashbeleg steht ebenfalls aus. |
| Partygefahr vor Wirkung und passender GM-Kontext | World- und Dungeonwahrnehmung pausieren vor Bewegung, Reset oder Konflikt; die Actor-Karte verlinkt in den Scene-/Dungeonkontext. | Kamerafreiheit und unabhängige Reads während eines längeren Catch-ups sind noch nativ zu qualifizieren. |
| 200 Actors, p95 höchstens zwei Sekunden und sichtbarer Fortschritt binnen 100 ms | Minimal- und räumliche 200-Actor-Baseline liegen lokal unter zwei Sekunden p95; der DOM-Beleg setzt den Fortschritt vor dem ersten Await. | Native Progress-, Cancel- und Kameraabnahme sowie eine längere räumliche Wachstumsmessung bleiben offen. |

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

Eine vorbereitete Gruppe bleibt Owner ihrer ID, Revision und aktuellen
Mitglieder. Gruppen-Opt-in akzeptiert deshalb nur die vom GM gesehene Revision
und protokolliert diese Identität je betroffenem Actor. Das erzeugt noch keine
zweite Autonomy-Gruppe: Bis der Sessionowner atomare Mitgliedschaftsänderungen
anbietet, bleiben gemeinsame Reise sowie Split und Merge ausdrücklich offen.

## Begründete Pending-Entscheidung

Ein Zeitkonflikt bleibt als pausierter Actorstand erhalten, bis der GM ihn über
`accept-pending` ausdrücklich klärt. Pause-, Actor- und Gruppenbefehle dürfen
diesen Zustand nicht nebenbei aufheben. Die Oberfläche zeigt den Abstand zwischen
Actor- und Scenezeit aus den persistierten Entscheidungsfakten sowie den aktuellen
World- und gegebenenfalls Dungeonstand. Fortsetzen mit diesem Worldstand und das
Auslassen des Zeitraums verlangen beide eine Begründung; Auflösung und Begründung
werden geloggt und bleiben nach Fresh nachvollziehbar.

## Sichtbare Jobentscheidung

Die deterministische Wahl sortiert zulässige Jobs nach berechneter Priorität und
bei Gleichstand nach stabiler Job-ID. Das Joblog zerlegt die Priorität in
Grundwert, NPC-Bonus, aktivierte Needbeiträge und gegebenenfalls die ausdrückliche
GM-Zuweisung. Rollen-, Reachability-, Reservierungs-, Zeit- und
Zielbedingungen erscheinen als Ablehnungsgründe; Partygefahr bleibt eine eigene
Pendingentscheidung. Pro Entscheidung werden
höchstens sechs zulässige und sechs abgelehnte Jobs gespeichert; Restzähler
machen die Begrenzung sichtbar. Damit bleibt die aktuelle Entscheidung prüfbar,
ohne die vollständige Kandidatenauswertung als dauerhaft wachsende Historie
anzuhängen.

## Lokaler Nachweis und Aussagegrenze

`tests/core/autonomy-persistence-integrity.test.ts` belegt korrekt neu gehashte
Beschädigungen an historischen Jobs, Actorregeln, Positionen, Routen, Features,
Dungeonreferenzen und Dungeon-Snapshots. Die Fälle prüfen Catch-up-Rollback,
unveränderten früheren Backupbestand, Ablehnung eines neuen Backups, Fresh sowie
eine gültige exklusive Ressourcenbuchung. Weitere Fälle prüfen Frontiers,
Reservierungen, beide Buchungstypen, Logs, Receipts und Campaign-Remap.

`tests/core/autonomy-scene-time-boundary.test.ts` belegt, dass automatischer
Catch-up an der bestätigten Uhr der auslösenden Scene endet und ein bereits
späterer Actorstand nicht zurückgerollt wird. Der Test belegt außerdem die
persistente Pause, die Sperre alternativer Aufhebungswege und die begründete
Auflösung nach einem Neustart. Ein zusätzlicher Fall belegt Needbeiträge,
Rollen-Ablehnung und den stabilen Tie-break im begrenzten Joblog. Der
Gruppenfall weist eine veraltete Revision ohne Teilwirkung ab und belegt nach
Aktivierung die geloggte Gruppenidentität sowie nach Deaktivierung den
abgebrochenen Job und die abgeschnittene Ressourcenbuchung.
`tests/core/autonomy-time-conflict-ui.test.ts` prüft am vollständigen DOM die
Zeit-/Worldinformationen, beide begründeten Entscheidungen und die sichtbare
Kandidaten-/Ablehnungszusammenfassung.

`tests/core/autonomy-owner-atomicity.test.ts` lässt Dungeonbewegung,
Fallenreset und begrenzten NPC-Konflikt jeweils erst nach einer Ownerwirkung an
der folgenden Logschreibung scheitern. Der komplette SQLite-Stand bleibt dabei
unverändert und ohne Receipt. Derselbe Command kann anschließend erfolgreich
ausgeführt werden; sein Replay verändert Position, Featureladung, HP, Logs,
Buchungen und Actorcursor nicht erneut. Diese SQLite- und DOM-Nachweise sind
keine native Bedien-, Hardcrash-, Größen- oder vollständige Produktabnahme.

## 200-Actor-Baseline

`npm run bench:autonomy` erzeugt für je 20 unabhängige Läufe zwei validierte
Quellzustände mit 200 aktivierten Actors, 15 Minuten bestätigter Zeit und
höchstens zwölf Catch-up-Schritten je Actor. Die Minimalbaseline verwendet einen
unplatzierten Guard-Job. Die räumliche Baseline verwendet fünf gleichzeitig
erreichbare Guard-Angebote, einen Dungeon-Snapshot und Actors, die höchstens rund
elf Meter vom Jobziel entfernt stehen. Die unabhängigen Prozesse verhindern,
dass die Messung selbst wegen des vorgeschriebenen 512-MiB-Prozessbaumlimits alte
V8-Heaps mehrerer Läufe ansammelt.

Auf dem lokalen Linux-x64-Prüfrechner vom 14.10.2026 lagen die p95-Werte der
Minimalbaseline bei 25,61 ms für Capture/Intervallbildung, 348,31 ms für den
vollständigen Catch-up einschließlich Response-View und 13,37 ms für einen
separaten View. Die räumliche Baseline benötigte 38,65 ms, 1.094,55 ms und
16,90 ms. Die höchsten Worker-RSS-Werte betrugen 112.799.744 beziehungsweise
204.947.456 Bytes.

Die räumliche Gegenprobe deckte zunächst eine interne Vervielfachung auf: Jeder
1,5-m-Routenpunkt publizierte eine eigene Spur und ein eigenes Geräusch. Ein
atomarer Bewegungsabschnitt publiziert nun genau einen Trace und ein Signal; der
Trace enthält weiterhin den vollständigen zurückgelegten Pfad. Dadurch sank der
mediane SQLite-Seitenzuwachs der räumlichen Erstbewegung von 2.359.296 auf
1.171.456 Bytes. Die Minimalbaseline belegt 344.064 Bytes; die historischen
Intervallpayloads belegen 159.708 beziehungsweise 180.207 Bytes. Diese ersten
Seitenzuwächse sind keine Langzeit-Wachstumsraten.

Beide Baselines erfüllen die Zwei-Sekunden-p95-Grenze. Die Oberfläche setzt
vor dem ersten asynchronen Command sofort einen Status im Live-Bereich und
deaktiviert den Startknopf; der DOM-Gegenbeleg hält die Commandantwort offen und
prüft diesen Zwischenzustand. Kamerafreiheit und unabhängige Reads sind damit
noch nicht nativ qualifiziert.


## Nächste ausführbare Schritte

1. **Historische Zeitbasis gemeinsam qualifizieren.** Die integrierten Reader
   prüfen nun auch historische Actorsteuerung, Needs, Positionen, Routen, Features
   und den internen Dungeongraphen. Diese Byte-/Shape-/Referenzbelege sind keine
   vollständige Wirkungsabnahme. Configänderung bei noch ausstehenden Intervallen,
   Aktivierungs-/Pausezeit, alte Revisionen, heutige Zieländerung und Fresh gemeinsam
   prüfen; historische Fakten nicht gegen ausschließlich aktuelle Aktivität binden.
   Aktivierungswechsel und ihre tatsächliche Zeitgrenze im dauerhaften Faktenlog
   nachvollziehbar machen, ohne vorhandene Geschichte nachträglich zu erfinden.
2. **Reservierungs-/Receipt-/Logabschluss vervollständigen.** `autonomy_booking`,
   `autonomy_reservation`, `autonomy_log` und `autonomy_receipt` bei Backup und
   Transfer weiter gemeinsam mit ihren Writern prüfen. Die vorhandenen Form-/
   Ownerprüfungen sind kein vollständiger Abschluss. Einzel-/Gruppen-Deaktivierung und unmittelbares manuelles Resume mit
   erneuter exklusiver Buchung sind lokal geprüft. Als nächste Gegenproben
   eine längere manuelle Pause mit ausstehenden bestätigten Intervallen,
   vorübergehende Belegung beim Resume sowie Positionsoverride gegen beide
   Buchungstabellen prüfen. Der ausdrückliche Abbruch am Intervallende ist mit
   derselben Freigabe jetzt lokal geschlossen. Historische Targetbindungen erhalten; fehlende
   aktuelle Aktivität nicht mit fehlender historischer Identität verwechseln.
   Fehler erklären und nicht still reparieren.
   Abnahme: zwei konkurrierende Jobs, unterbrochene Reservierung, Positionsoverride,
   unabhängige Kopie, Receiptreplay und erklärbare erhaltene Konfliktrollen.
3. **Zeit-/Ownerwirkung gemeinsam qualifizieren.** Der integrierte lokale
   Nachweis prüft Dungeonbewegung, Trap-Reset und Konfliktwirkung mit einem
   anschließenden Logfehler, vollständigem Rollback und genau einmal wirksamem
   Retry/Replay. Er ersetzt keine Fehlerprobe nach einer bereits vorher
   abgeschlossenen Wirkung eines anderen Actors im selben Catch-up-Command.
   Diesen Mehractor-/Mehrownerfall ergänzen; Logs, Gesundheit, Featureladung,
   Reservierung und Cursor gemeinsam vergleichen. Partygrenzen, echter
   Prozessabbruch/Cancel sowie Resume nach Fresh zusätzlich qualifizieren.
4. **Bedienbarkeit und Größenfall messen.** `autonomy-ui.ts` mit A/B/A,
   unbestätigten Rohwerten, Pending/Replyverlust, erklärtem Jobausschluss und
   Tastatur prüfen. Die integrierten einfachen und räumlichen 200-Actor-Baselines sind lokale
   Messungen. Längere bestätigte Campaignzeit und Wachstum gesondert messen;
   keinen Erstschrittwert linear fortschreiben. Native freie Kamera/Reads und
   Fortschritt ≤100 ms qualifizieren; Cancel vor Commit ohne Wirkung. Nur konkrete
   gemessene Engstellen ändern, keine zusätzliche persistierte Simulation.

5. **Gruppenreise an bestätigte Mitgliedschaft binden.** Gemeinsame Gruppenreise erst nach einer atomaren Mitgliedschaftsoperation des
   Sessionowners ergänzen. Diese Operation muss Split und Merge mit stabilen
   Gruppen-/Actor-IDs, erwarteten Revisionen und eindeutigem Zielverband
   veröffentlichen; Autonomy darf danach nur deren bestätigten Snapshot binden.
   Bis dahin stattdessen genau eine weitere einfache Featureinteraktion über
   einen bestehenden Owner liefern; keine parallele Simulationswahrheit anlegen.
