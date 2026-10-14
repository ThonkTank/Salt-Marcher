# Bindende Weltvorgaben für Encounter und Spielabend

Stand: 14.10.2026. Fachumfang: [Encounterplan](../../../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md)
und [Spielabendplanung](manual-session-planner.md). Die gepinnten Program
Capabilities, Revision `9de85c1a26f526acbc1af332ac5962e185c0aab2`, L143–156,
verlangen jede ausgewählte Orts-/Fraktions-/NPC-/Itemvorgabe im vorgeschlagenen
Spielabend. Unpassende Vorgaben werden vorher erklärt und abgewiesen.
Bindung: [Quellenregister](../../scope-sources.json), SHA256
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

Die Vereinigungsmenge mehrerer Fraktionsquellen konnte bislang vollständig nur
A enthalten, obwohl der GM A und B ausgewählt hatte: B hatte keine Hauptquelle
oder wurde von Tabelle/Ort ausgeschlossen. Ein vorhandener Treffer aus A
verdeckt diese verlorene Vorgabe. `resolveWorldSources` prüft jetzt jede
explizite Fraktion nach den gemeinsamen Filtern auf mindestens eine erreichbare
Tabelle mit positivem Gewicht und positivem bzw. unbegrenztem Bestand.
Andernfalls nennt es die betroffene Fraktion und lehnt vor Generierung ab.
Nullbestand zählt nicht als erreichbarer Beitrag. Die Prüfung mutiert weder
Quellen noch Bestand und verbraucht keine Kreaturen.

`tests/desktop-world-source-constraints.test.mjs` reproduzierte die drei
verlorenen Bindungen vor der Korrektur. Es prüft fehlende Quelle, ausgeschlossene
Tabelle, ausgeschlossenen Ort und Nullbestand sowie eine gültige endliche
Bestandsgrenze und veränderte Quellenbasis nach Bestandsänderung. Der echte
SQLitewriter legt die Testdaten an; abgewiesene Reads erhalten die Datenbytes.
Das ist ein lokaler Teilnachweis für die Quellenvorprüfung.

## Neuer Anschluss für benannte NPCs

Der integrierte `storage/generation-npcs.ts` führt einen endlichen Pool bereits
vorhandener aktiver, feindlicher World-NPCs mit passendem Kreaturverweis, HP,
Orts-/Fraktionsfilter und Quellenrevisionen. Encountereinträge tragen
`worldActorIds` und Anzeigenamen; sie sind keine Anweisung zum Klonen dieser
NPCs. Der vorhandene Tabellenguard qualifiziert diesen separaten Pool noch
nicht. Bindende Beiträge aller ausgewählten Fraktionen, Poolerschöpfung,
NPC-Rename/Healthänderung zwischen Vorschau/Annahme, Fresh/Import und Wechsel
zwischen benannten NPCs und Katalogkreaturen brauchen eigene Gegenproben.

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
Tastatur, Esc/Fokusrückgabe, Fresh und 200%-Darstellung bleiben separat offen.

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
