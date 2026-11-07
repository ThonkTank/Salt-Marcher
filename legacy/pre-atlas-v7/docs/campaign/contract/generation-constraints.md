# Bindende Weltvorgaben für Encounter und Spielabend

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: campaign
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 17.10.2026. Fachumfang: [Encounterplan](../../catalog/requirements/catalog-encounters.md)
und [Spielabendplanung](manual-session-planner.md). Die gepinnten Program
Capabilities, Revision `9de85c1a26f526acbc1af332ac5962e185c0aab2`, L143–156,
verlangen jede ausgewählte Orts-/Fraktions-/NPC-/Itemvorgabe im vorgeschlagenen
Spielabend. Unpassende Vorgaben werden vorher erklärt und abgewiesen.
Bindung: [Quellenregister](../../project/requirements/sources.json), SHA256
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.

## Vorhandener Anschluss und konkrete Korrektur

`storage/world-sources.ts` führt Fraktionshaupttabelle/Bestand sowie Ortsquellen
und Fraktionsverknüpfungen. `resolveWorldSources` verbindet diese Vorgaben mit
der ausdrücklichen Tabellenauswahl; `storage/generation.ts` benutzt deren
Kandidaten und Mengengrenzen. `sourceBasis` bindet die Weltquellen an einen
Generierungsrun. Vor Annahme prüfen `assertGenerationSourcesCurrent` und der
Sessionwriter erneut Quellen, Preset, Katalog und Tabellenrevisionen.
Der integrierte `generateSession` kann Ortsquellen je Besuch (`worldSourcesByLocation`)
auflösen und trägt jeden tatsächlichen Generierungsrun am Encounter weiter.
Scene- und Rewardvorschläge sind unabhängig editierbar; die Gesamtbudgets und
verbindliche Quellenbeiträge benötigen weiterhin den unten beschriebenen Abschluss.

Jede ausdrücklich gewählte Fraktion muss nach gemeinsamen Tabellen-/Ortsfiltern
mindestens eine erreichbare Tabelle mit positivem Gewicht und positivem oder
unbegrenztem Bestand behalten. Andernfalls wird sie genannt und die Generierung
abgewiesen. Die Auswahl von Fraktionen und Orten prüft Dokumentformat,
Prüfsumme, Identität und Revision vor Projektion oder Fraktionsfilter. Auch
bestehende Weltquellen prüfen ihre verknüpften Dokumente; archivierte Bindungen
bleiben erhalten. Reads verändern weder Quellendaten noch Bestände.

Die [Storeprüfung](../../../tests/campaign/desktop-world-source-constraints.test.mjs)
deckt fehlende Quellen, ausgeschlossene Tabellen/Orte, Nullbestand, endliche
Bestände, geänderte Quellenbasis und beschädigte Auswahlquellen ab.

## Gespeicherte Vorschau ausdrücklich übernehmen

Die Historienauswahl entfernt zuerst die vorherige Vorschau samt Aktionen.
Laden und Fehler stehen am Generator; dieselbe Auswahl wiederholt den Read.
Nur eine Antwort mit passender Run-ID erhält wieder Übernahmeaktionen.
Eine leere Auswahl, neuere Abfrage oder Kampagnenaktivierung invalidiert alte
Antworten. Eine laufende ausdrückliche Übernahme wird durch Historienereignisse
nicht ersetzt. Vorschau- und verknüpfte Beuteaktionen sind an den dargestellten
Run gebunden. Die Übernahme derselben Planungsparty wie im Run macht eine
Vorschau nicht fälschlich veraltet; andere geänderte Kriterien bleiben gesperrt.
Ein entfernter alter Button kann keine neue Vorschau übernehmen
oder deren Seed für alte Beute benutzen.

Die vorhandenen Request-, Operations- und Store-Revisionsgrenzen genügen;
kein zusätzlicher Statusautomat oder persistenter Verlauf. DOMgegenproben
verzögern/fehlen Historienreads, liefern fremde IDs, prüfen alte Klickhandler,
Retry und Seedbindung. Ein nativer Lauf mit zwei echten Generierungen prüft
lokalen Fehler, falsche Antwort, Retry und erst danach die ausdrücklich gewählte
Übernahme. Nach erneutem Öffnen bleibt die konkrete Zusammensetzung erhalten;
der erste Run und die unveränderlichen Generierungsdaten bleiben unverändert.
Das ist keine vollständige Selector-, Preset- oder Plattformabnahme.

## Encounter-Tabellen: Identität und Geltungsbereich

Eine Encounter-Tabelle erhält bei der Neuanlage ausdrücklich `campaign` oder
`installation`; neue Dialogentwürfe wählen zunächst die Kampagne. Dieser Owner
bleibt nach der Anlage stabil. `executeGeneration/table-save` prüft erst
Sichtbarkeit und erwartete Revision und lehnt anschließend jede Änderung des
Geltungsbereichs vor dem Write ab. Das vorhandene Formular zeigt die gewählte
Quelle weiter an, sperrt sie bei gespeicherten Tabellen und verweist für einen
anderen Geltungsbereich auf eine neue Tabelle. Die normale Bearbeitung verändert
Name, Beschreibung, Einträge und Bedingungen unter derselben ID/Revision.
Beim Speichern einer kampagneneigenen Tabelle prüft und beschneidet
`pruneWorldStock` ausschließlich Fraktionsquellen desselben geprüften Owners.
Die Einschränkung erfolgt in der Query vor dem Decodieren, über den bestehenden
Campaign-/Kind-Schlüssel. Eine beschädigte Quelle einer unabhängigen Kampagne
kann diesen lokalen Save weder blockieren noch wird sie dabei geändert. Für
Installationstabellen bleiben sämtliche Kampagnen im Prüfbereich; betroffene
Bestände und Revisionen ändern sich zusammen mit der Tabelle atomar. Ein
beschädigter Record in diesem gemeinsamen Prüfbereich bricht den gesamten
Write einschließlich schon bearbeiteter Bestände und Receipt ab. Reparatur,
globaler Backup und vollständige Löschung bleiben eigene Aufgaben, kein stilles
Überspringen beschädigter gemeinsamer Daten. Keine Migration oder neuer Cache.

Jeder Input übernimmt ausschließlich sein bearbeitetes Feld. Ein Name-/Filter-
oder Gewichtsedit liest unberührte Beschreibung nicht neu aus dem Browsertextarea;
so bleiben deren originale Zeilenumbrüche und Autorenbytes erhalten. Tatsächliche
Textbearbeitung bleibt eine ausdrückliche Änderung dieses Feldes.

Eine Installationstabelle einer einzelnen Kampagne zuzuschlagen ließ zuvor
Verknüpfungen anderer Kampagnen mit einer dort unsichtbaren Tabelle zurück.
Die Gegenrichtung stellte eine kampagneneigene Identität unbemerkt allen
Kampagnen zur Verfügung. Weder ein gewöhnlicher Save noch ein Revisionsvergleich
ist ein ausdrücklicher Move-/Copyvertrag. Es gibt deshalb keinen automatischen
Ownerwechsel, kein stilles Entlinken und keine Migration vorhandener Tabellen.
Schon früher verschobene Tabellen brauchen eine gezielte Prüfung ihrer alten
Referenzen; ihren ursprünglichen Owner nicht aus heutigen Daten erraten.
Eine spätere Kopieraktion benötigt eine neue ID und eine bewusste Behandlung
kampagnenlokaler Lootbindungen; sie ersetzt keine bestehende globale Identität.

`desktop-table-scope.test.mjs` prüft beide unzulässigen Richtungen mit echten
SQLitezuständen, darunter Quellen zweier Kampagnen, Fraktionsbestände,
vollständiger Rollback, Shared-Revision, Receiptreplay und Fresh. Die neue
Gegenprobe belegt den zuvor durch B blockierten lokalen A-Save; weitere Fälle
prüfen echte Bestandsbereinigung beider Campaigns einer Shared-Tabelle und
Rollback bei beschädigter gemeinsamer Quelle. Entfernte Kreaturen fallen aus
dem Fraktionsbestand, der Source-Editor muss die erhöhte Revision neu laden.
`desktop-table-weights.test.mjs` prüft den gesperrten vorhandenen und frei
wählbaren neuen Scope sowie das erneute Öffnen nach einem Installation-Save.
Nativer Teilbeleg am 16.10.: lokalen Tabellenname ändern und Kreatur entfernen,
Save über echte IPC trotz beschädigter B-Fraktionsquelle, erwartete A-Bestandskürzung,
Originalprosa/Foreignrecords unverändert, erneutes Öffnen und Profilneustart;
zwei normale Exits ohne Rendererfehler. Die Queryplanprüfung bestätigt die Suche
über den vorhandenen Campaign-/Kind-Index; daraus folgt keine allgemeine
Latenz- oder Großbestandsabnahme. Vollständige Dialog-/Quellenlebenszyklus- und
Generatorabnahme bleiben getrennt.

### Gespeicherte Tabellen behalten dieselben Inhaltsregeln

`storage/generation.checkTableContent` prüft Entwurf und gespeicherte Tabelle:
nichtleerer Name, gültige Bedingungen, mindestens ein eindeutiger Kreatureintrag,
exakte nichtnegative Gewichte mit wenigstens einem positiven Anteil und eine
zum Owner passende optionale Loot-ID. Die Prüfung berechnet keine Encounter und
ändert beim Lesen weder Gewichtsschreibweisen noch Autorenprosa. Bereits
unterstützte Dezimalgewichte und Nullanteile innerhalb einer positiven Tabelle
bleiben gültig; der offene Original-`1..10`-/TN-37-Abgleich unten wird damit
nicht stillschweigend entschieden.

Ein gültiger Hash beweist nur unveränderte Bytes, keinen gültigen Tabelleninhalt.
Der vorhandene `decodeTable` weist deshalb auch korrekt gehashte, aber leere,
doppelte oder anderweitig widersprüchliche Inhalte ab. Reads, reguläre
Bearbeitung/Trash und der bereits vorhandene Backupdecoder verwenden dieselbe
Regel. Eine ungültige Tabelle ersetzt keine bekannte gute Sicherungsdatei und
wird nicht durch einen gewöhnlichen Save heimlich repariert. Die Originalzeile
bleibt für eine gezielte Wiederherstellung erhalten; keine Migration oder neue
Backuppipeline. Ein früher bestätigter Originalauftrag behält seinen damaligen
Receipt; dieser historische Beleg repariert oder autorisiert keinen inzwischen
beschädigten aktuellen Tabellenstand.

Die Strukturprüfung liest keinen aktuellen Kreaturkatalog und keine fremde
Lootquelle. Stabile, inzwischen nicht mehr installierte Kreatur-IDs bleiben als
Referenzen lesbar; ihre tatsächliche Generierbarkeit wird weiterhin beim
bestehenden Kandidaten-/Saveweg geprüft. Kampagnenlokale beschädigte Tabellen
bleiben im eigenen Querybereich; sie sperren keine unabhängige Kampagne.
Installationstabellen und globale Sicherungen behalten ihren gemeinsamen
Prüfumfang und überspringen beschädigte Records nicht.

`desktop-encounter-table-integrity.test.mjs` prüft acht fehlerhafte Inhalte,
verweigerte Writes/Fresh, unveränderte Originalbytes und eine bereits gute
Sicherungsdatei. Gegenkontrollen erhalten exakte Dezimalwerte, Nullanteile,
fehlende Kreaturdefinitionen, Originalprosa, unabhängige lokale Tabellen samt
scoped Export und die gemeinsame Prüfgrenze einer Installationstabelle. Eine
native Linuxprobe speichert eine intakte lokale Tabelle trotz fremder lokaler
Beschädigung, zeigt den Fehler samt erneutem Read in der betroffenen Kampagne
und prüft exakte Gewichte/Prosa nach drei normalen App-Exits und Fresh.
Diese Nachweise schließen weder endgültige Tabellenlöschung noch vollständige
Dialog-, Generierungs- oder Plattformabnahme ab.

### Unbekannter Speicherausgang

Ein Transportabbruch beim vorhandenen `executeGeneration` hält den ursprünglichen
Auftrag, Entwurf und die Speichersperre im offenen Manager. „Speicherausgang klären“
verwendet dieselbe Kennung und Nutzlast: der vorhandene Receiptwriter bestätigt
die erste Buchung oder führt den noch nicht angewandten Auftrag einmal aus.
Schließen und weitere Saves bleiben bis zur bekannten Antwort gesperrt. Ein
bestätigter Schreibfehler gibt den unveränderten Entwurf wieder frei. Ein direkter
Aktivierungswechsel entzieht dem alten Auftrag seine UI-Autorität; er wird nicht
in die neue Aktivierung übernommen. Kein neuer Receiptvertrag und kein Journal;
die Klärungsabsicht selbst überlebt keinen Prozessneustart. Bereits bestätigte
Tabellen bleiben nach Neustart normal lesbar. Separate Generierungs-/Lootroll-
und Vorschlagsannahmeaufträge sind damit nicht vollständig qualifiziert.

### Weitere ausführbare Tabellenabschlüsse

- **Gemeinsamen Manager einschließlich Fraktionsnesting am Host abschließen.**
  `generation-ui.openTable` mit Katalogslot ist bereits der direkte und genestete
  Tabelleneditor; keinen zweiten Manager bauen. Die bestehende DOMprüfung
  erhält den Fraktionsentwurf und übernimmt erst eine bestätigte neue Tabellen-ID.
  Titelclose, Escape und Abbrechen benutzen denselben Discardpfad. Verbleibende
  native Abnahme: nur oberste Bestätigung interaktiv, Cancel zurück zum
  unveränderten Manager, anschließend mit erhaltenem Fokus zur Fraktion;
  ausstehender Save darf weder doppelt starten noch geschlossen werden.
- **Trash von endgültiger Löschung unterscheiden.** Das vorhandene
  `table-trash` erhält Identitäten/Verknüpfungen für Restore. Es erfüllt die
  Originalforderung einer endgültigen Löschung samt atomarem Entfernen von
  Ortslinks, Fraktionshauptquelle und abgeleitetem Bestand noch nicht.
  Vor einem endgültigen Command konkrete betroffene Quellen aller Campaigns
  einschließlich recoverable/trashed zeigen, Revisionen und Wiederholung
  schützen und in derselben Transaktion bereinigen. Autorenprosa, unabhängige
  Tabellen und historische Generierungsruns erhalten. Spätes Fault/Fresh,
  globale Referenzen und stale Source-Editor sind Abnahmen.
- **Kandidaten und Gewichte bis zur Annahme prüfen.** Effektiv keine Tabellen
  bedeutet sichtbare Katalogquelle mit aktuellen Filtern; ausdrücklich wirksame
  Tabelle ohne passende Einträge bedeutet No-solution. Ausgewählte Tabellen
  mit sämtlichen Kreaturfiltern und XPceiling schneiden, authored Gewichte
  bis ins Ranking erhalten, unterschiedliche Lootbindungen als nichtblockierenden
  Konflikt erklären. Original `1..10` und bestehende exakte Dezimalwerte mit
  TN-37 (exakte relative Verhältnisse) ausdrücklich abgleichen; keine stillen
  Rundungen oder Ablehnung bereits gespeicherter Werte. Die Generatorregeln
  nicht im UI duplizieren. Abnahme: überlappende Tabellen, leere Filtermenge,
  exakte 100%-Anteile, Restart/Locale und keinerlei Encounterbuchung allein
  durch Tabellenauswahl.

## Neuer Anschluss für benannte NPCs

Der integrierte `storage/generation-npcs.ts` führt einen endlichen Pool bereits
vorhandener aktiver, feindlicher World-NPCs mit passendem Kreaturverweis, HP,
Orts-/Fraktionsfilter und Quellenrevisionen. Encountereinträge tragen
`worldActorIds` und Anzeigenamen; sie sind keine Anweisung zum Klonen dieser
NPCs. Der vorhandene Tabellenguard qualifiziert diesen separaten Pool noch
nicht. Bindende Beiträge aller ausgewählten Fraktionen, Poolerschöpfung,
NPC-Rename/Healthänderung zwischen Vorschau/Annahme, Fresh/Import und Wechsel
zwischen benannten NPCs und Katalogkreaturen brauchen eigene Gegenproben.

## Komposition verstehen und Vorlieben ändern

Katalogvorschau, Spielabendvorschläge und der Generator für die aktuelle
Live-Gruppe zeigen dieselben gespeicherten Kompositionsdaten: Rollen/HG,
Mengen und positive Statblock-Slots je CR-Block, Gesamtzahlen für Kreaturen,
Statblocks und Initiativeplätze, XP-Ziel/Ergebnis/Abstand, untersuchte
Kompositionen und Treffer im ±5%-XP-Band. Die Anzeige berechnet keine neuen
Kandidaten und leitet fehlende Daten älterer Vorschauen nicht aus Gegnernamen ab.
Bei Auffüllvorschauen beschreiben die Blöcke die Ergänzung; die Kennzahlen
berücksichtigen die feste Basis zusammen mit der Ergänzung. Soft-Diagnosen
zeigen Wert, Zielbereich und gespeicherten normierten Abstand. Die Menge der
XP-Bandtreffer wird ausdrücklich nicht als Menge vollständig erfüllter weicher
Zielbereiche bezeichnet.

Anzahl, Stärkeverteilung und Statblock-Vielfalt sind jetzt auch im Live-Generator
wählbar; Änderungen sperren die Übernahme bis zur passenden neuen Vorschau.
Eine geladene Vorschau stellt ihre gespeicherten Vorlieben wieder her. Die
Spielabendplanung bietet dieselben Vorlieben, zunächst als „Vorgabe des wirksamen
Presets“. Die tatsächliche Presetvorgabe wird bei Erzeugung gelesen und als
konkreter Request gespeichert; eigene Auswahl bleibt davon unabhängig. Die
XP-Ziele des Spielabends stammen weiter aus dessen Adventure-Day-Allokation.
Die vorhandene Selektor-Rangfolge und alle harten Bindungen bleiben erhalten.

Diese UI-Lieferung ersetzt keine vollständige Scene-Auffüllung, keine
abstrakte Session-Orchestrierung und keine unabhängige Selector-/Skalierungs-
oder Plattformabnahme.

## Vorschau für die laufende Gruppe

`live-generation-ui.ts` liest aktive Mitglieder der fokussierten Scene und deren
bekannte XP/Level. Sie benutzt dieselben Worldquellen und gespeicherten
`GenerationRun`s wie der bestehende Generator. Vorschauerzeugung schreibt keine
Kampfmaske. „Für diese Gruppe vorbereiten“ übergibt Run-ID, Vorschlagsindex,
Registryrevision, Scenemembership, Focusrevision und Ort an den Combatwriter.
`storage/combat.ts` prüft vor atomarer Übernahme aktuelle Gruppe/Level, Ort,
Quellen und Registry; Vorlage, Kampfmaske und Belege teilen die Transaktion.
Initiative, Kampfstart und Abschluss bleiben ausdrückliche weitere Aktionen.
Die Planungsparty anderer Abende ist keine Ersatzquelle für die Live-Gruppe.

Der Dialog bindet jeden Vorschlagsbutton an den angezeigten Run, Owner und
Dialoggeneration. Späte Fehler, Bestätigungen und `finally`-Rückläufe dürfen
weder die nächste Vorschau schließen noch deren laufenden Auftrag entsperren.
Close/Reset invalidiert auch einen noch ausstehenden Flush vor Öffnung. Fünf
DOMgegenproben in `desktop-live-generation-context.test.mjs` waren vor dieser
Korrektur rot; sie qualifizieren diese Renderergrenzen, nicht bereits sämtliche
Writer-, Last- oder Nativefälle.

Nächster eigener Lieferabschluss: mit echten gespeicherten Runs Level-/Member-/
Focus-/Ortswechsel vor Annahme, Registry-/NPC-/Tabellenänderung, falschen Index
und kontrollierten Rollback an Vorlage/Kampf/Receipts prüfen. Danach verlorene
Antwort nach bestätigter Übernahme mit bestehendem Combatbeleg rekonstruieren;
neuere Eingaben und wieder geöffnete Vorschau bleiben getrennt. Kein neuer
Command oder zweiter Kampf allein wegen einer fehlenden Antwort. Die aktuell
vollständigen Reads von Roster, Tabellen, Worldsources und Runliste sowie große
Statblockvorschauen benötigen eine gemessene Query-/Darstellungsgrenze. Native
Tastatur, Esc/Fokusrückgabe, Fresh und 100 %-Darstellung bleiben separat offen.

## Noch fehlende fachliche Abschlüsse

Die Quellenvorprüfung beweist nicht, dass jede verbleibende Fraktion in den
konkreten Encountereinträgen vorkommt. Der aktuelle Materializer wählt Kreaturen
über einen gemeinsamen Pool und aggregierte Mengengrenzen; ihm fehlen explizite
Beiträge je Fraktion. Auch verbindliche NPC-/Itemvorgaben, kumulative
Bestandsverteilung über den gesamten Spielabend und vollständige
Adventure-Day-Lootbudgets sind damit nicht abgenommen. Mehrere alternative
Encountervorschläge und mehrere aufeinanderfolgende Spielabendbesuche benötigen
unterschiedliche Bestandsregeln; Vorschauerstellung allein verändert keine Worldbestände.

## Nächste ausführbare Umsetzung

1. `generation-contracts.ts`, `world-sources.ts`, `generation.ts`: Herkunft je
   ausgewählter Fraktion und konkrete Mengenkapazität durch den Materializer
   führen. Vor Ausgabe nachweisen, dass jede bindende Auswahl tatsächlich einen
   Beitrag liefert. Keine Ersatzkreatur aus fremder Quelle als Erfüllung zählen.
   Wenn Zusammensetzung/Filter/Bestand dies verhindern, keine Teilvorschau
   speichern. Abnahme: disjunkte und überlappende Haupttabellen, Nullbestand,
   gemeinsame Kreatur mehrerer Fraktionen, Budget zu klein und genaue Fehlermeldung.
2. `session.ts`, Session-Generierungsrequest/UI: Orte, Fraktionen, benannte NPCs
   und Items mit IDs und ursprünglichen Revisionen binden; jeden ausgewählten
   Gegenstand mindestens einem Besuch zuordnen. Bereits angenommene World-NPCs
   behalten ihre Identität. Mit Planungsparty und Gesamtbudget alle Besuche
   prüfen; individuelle Neugenerierung erhält übrige Beiträge und manuelle Texte.
   Abnahme: selektierte NPCs/Orte fehlen nie stillschweigend; kein neuer NPC bei
   bloßer Vorschau; infeasible Adventure Day ohne Timeline-/Worldänderung.
3. Annahme und Wiederaufnahme: konkret benötigte Quellenrevisionen einschließlich
   neuer NPC-/Itembindungen im Run erhalten und im Writer erneut prüfen.
   Zwischen Vorschau und Annahme geänderte/gelöschte/trashed Quellen verwerfen die
   alte Annahme ohne Teilwirkung. Retry/Fresh erhält bereits bestätigte Inhalte.
   Abnahme: echte Store-/UIantworten, Fehler/unklarer Commitausgang, unabhängiger
   Campaignimport und native Bedienung; Testzahlen ersetzen diese Abnahmen nicht.
4. Nach funktionalem Abschluss `world-sources.ts` mit kleinen ID-/Tabellenmaps
   statt wiederholter Vollsuche und begrenzten Queries vereinfachen. Vorher
   tatsächliche Eingabegrößen/Kosten messen; keine zweite Generatorarchitektur.
