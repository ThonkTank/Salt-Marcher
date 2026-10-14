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
