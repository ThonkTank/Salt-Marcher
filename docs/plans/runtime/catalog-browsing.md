# Kreaturkatalog: verbindlicher Suchstand und nächste Filterlieferung

Stand: 16.10.2026. [Original Catalog Tab UI](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/creatures/requirements/requirements-creatures-catalog.md),
[Katalog-/Encountervertrag](../../../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md)
und [Referenzsuche](rule-references.md). Die konkrete historische Shellaufteilung
ist austauschbar; auffindbare Kreaturen, nachvollziehbarer Filterstand und
sichere ausdrückliche Übergaben bleiben Fachziele.

## Aktueller Suchvertrag

Der Desktop verwendet `app/catalog-ui.ts`, `storage/encounters.searchCreatures`
und den unveränderten offline gebundenen `features/catalog/CreatureCatalog`.
Tests des älteren Obsidian-Catalogviews qualifizieren diesen Desktopcontroller
nicht automatisch. Der Provider besitzt bereits validierte Mengenfilter;
der Desktop gibt derzeit zahlreiche Einzelwerte als einwertige Arrays weiter.
Die Seitengröße ist aktuell25, die historische Quelle nennt50. Eine andere
Seitengröße verringert den durch Paging erreichbaren Korpus nicht; Last und
Bedienbarkeit sind anhand realer Aufgaben zu beurteilen.

Filtereingabe entzieht jeder älteren Queryantwort sofort ihre Autorität,
leert alte Ergebnisaktionen und zeigt den lokalen Suchzustand. Erst nach200ms
startet die neue Anfrage ab Seite1. Submit, Reset, Sortieren und Paging
beenden einen noch ausstehenden Debouncetimer; eine spätere Antwort ersetzt
keine jüngere Query oder Kampagne. Reset leert Katalogfilter und erhält die
gewählte Sortierung; die Encountereinstellungen bleiben beim vorhandenen Generierungsowner.

Die Ergebnisfläche unterscheidet „noch nicht geladen“, Suche, leeres Ergebnis
und lokalen Fehler. Während Suche/Fehler sind beide Pagingaktionen gesperrt.
Ein Suchfehler zeigt weder alte Treffer noch einen falschen Erfolg; die Filter
erhalten ihre Werte, Submit wiederholt ausdrücklich dieselbe Suche.
Quellen-/Filtermetadaten, Trefferliste, gespeicherte Vorlagen und Generator
werden unabhängig gelesen. Metadatenfehler erscheinen bei Quellen und Lizenz,
ohne gesunde Treffer oder Details zu leeren. Erneutes Öffnen wiederholt fehlende
Metadaten. Eine ausdrückliche Quellenöffnung aus Schnellsuche oder Verweisen
liest die gewählte Kreatur/Vorlage direkt; sie wartet weder auf Metadaten noch
auf Treffer-, Vorlagen- oder Generatorlisten. Deren spätere Antwort ändert die
angesehene Quelle nicht. Kampagnen- und Requestgrenzen gelten weiterhin. Eine verspätete
Detailantwort darf den Queryfehler nicht als „keine Kreaturen“ überschreiben.
Bereits lesbare Kreaturdetails bleiben bei Suchfehlern eigenständige Referenzinformationen.
Eine neue Kreaturauswahl leert dagegen den bisherigen Statblock und sperrt
Encounter-, Szenen- und Tabellenübernahme bis zur passenden Detailantwort.
Laden und Fehler erscheinen direkt in der Detailfläche; dieselbe Ergebniszeile
wiederholt die Abfrage. Falsche Kreatur-IDs und überholte Antworten erhalten
keine Übergabeautorität. Kampagnenwechsel leert die Auswahl; beim Schließen
einer Tabellensuche wird die vorherige Auswahl wiederhergestellt. Der
Statblock bleibt schreibgeschützte Quelleninformation.
Detail-Loading, Erfolg und Fehler erneuern nur Statblock und Auswahlmarkierung;
sie bauen die Trefferzeilen nicht erneut auf. Ergebnisbuttons tragen die stabile
Creature-ID. Damit bleiben DOMidentität und Desktop-Tastaturfokus bei Enter,
langsamem Read, Fehler und ausdrücklichem Retry erhalten. Bei schmalem Viewport
bleibt die vorhandene ausdrückliche Fokusführung zum Inspector wirksam. Erst
eine neue Ergebnisquery ersetzt die Zeilen; die weiterhin sichtbare ID wird
dabei wie bisher markiert. Keine zweite Auswahl- oder Tastaturverwaltung.

Es gibt keine neue Persistenz oder Schemaänderung.

`desktop-catalog-query-context.test.mjs` verzögert Query-/Detailantworten und
Debouncetimer kontrolliert. Es prüft alte Antwort während neuer Eingabe,
Fehler/Recovery, Reset/Sort ohne Folgeanfrage, Kampagnenwechsel und Indexfehler.
Detailfälle prüfen zusätzlich fehlende/ausgefallene Quellen, falsche Identität,
Retry und gesperrte Übergaben während Laden/Fehler.
`desktop-generation-context.test.mjs` prüft zusätzlich Filterweitergabe und
Invalidierung alter Generierungsvorschläge. Verzögerte Quellen werden einzeln
geprüft; derselbe Lesefluss ist in der nativen Desktop-App mit echtem Korpus
und vier gleichzeitig ausstehenden Nebenquellen geprüft. Das sind begrenzte
Controller-/DOM- und native Lesebelege.
Ein zusätzlicher nativer Enterlauf prüft den Ergebnisfokus vor/während/nach
Detailread, kontrolliertem Fehler und Retry sowie die schmale Inspectorführung;
Linkedomidentität allein gilt dafür nicht als Fokusbeleg. Vollständige
Tastaturnavigation, Langlisten und fachliche Generierung benötigen weiter eigene
Nachweise.

## Nächste ausführbare Lieferungen

1. **Angezeigter Filterstand und gemeinsame Menge.** In `catalog-ui.query`,
   den sichtbaren Controls und der bestehenden Generierungsbridge die gleiche
   vollständige Filtermenge verwenden. Einzeln entfernbare Chips und sichtbare Headersortierung sind vorhanden;
   Mehrfachauswahl fehlt im Desktop noch. Gewählte Werte beim Suchen erhalten,
   sichtbare Labels ohne Groß-/Kleinschreibung und Diakritika auffindbar machen.
   HGgrenzen sinnvoll begrenzen und den vollen Standardbereich nicht als
   zusätzlichen Filter veröffentlichen. Abnahme: mehrere Typen/Biome,
   gleichzeitige Werte, Chip entfernen, Reset, Sort/Paging und exakt dieselbe
   Kandidatenmenge bei der Generierung. Schwierigkeits-/Mengen-/Diversitäts-
   vorgaben und offene Encounterprosa dürfen dabei nicht überschrieben werden.
2. **Biomidentität vor Umdeutung.** `Creature.biomes`, Query `habitats` und
   `EncounterTable.habitats` sind derzeit Zeichenketten; der Hexeditor hat seine
   Terrainmenge. Das ist noch kein gemeinsamer installationseigener Biomkatalog.
   Vor Migration stabile BiomIDs, sichtbare Labels und Tabellenbindungen an
   einer bestehenden Definitions-/Importgrenze festlegen. Bestehende freie
   Werte ausdrücklich zuordnen oder als ungeklärt erhalten, nicht verwerfen.
   Geschützte `Any`-Tabelle wirkt in jedem Biom und ist selbst kein Biomfilter.
   Ausgewählte Tabellen mit dem sichtbaren Kreaturpool schneiden; unterschiedliche
   Lootbindungen als Konflikt zeigen. Zwei Kampagnen, Importkonflikt, unbekannte
   Altwerte und durchgängiger Hex-/Katalog-/Generierungsfall sind Abnahmen.
3. **Auswahl und Übergabe schließen.** Bestehende Details/Provider weiterverwenden;
   gleich sichtbare Kreatur-ID nach Refresh erhalten. Zeilenbestätigung per
   Tastatur und explizite Encounter-/Sceneaktionen anhand desselben Ziels
   prüfen/ergänzen. Nur ausdrücklich gewählte Kandidaten in die bestätigte
   Fokusgruppe übernehmen; Kontextwechsel während Drain oder Read darf das
   Ziel nicht still umdeuten. Quellenbestand bleibt read-only. Native
   Queryfehler, schnelles Tippen, Enter, Paging,200%, Gruppenumwahl und
   Fokuswiederaufnahme mit echtem Korpus prüfen.

## Begegnungstabellen: bestätigter Save und nachgelagerte Anzeige

Die gepinnte Originalanforderung `requirements-encountertable.md` verlangt
revisionierte Tabellen, einen gemeinsamen Manager mit Kreaturfilterung,
geschützte Close-/Discardabläufe und kontrollierte Weltquellenbindungen.
Der Desktop verwendet `generation-ui.ts`/`world-source-ui.ts` und den
transaktionalen Owner `storage/generation.ts`; die Auswahl bleibt read-only.
Bestehende Tabellen behalten ihren Scope. Die sichtbare Dezimalgewichtung ist
weiterhin eine offene Abweichung vom ursprünglichen Ganzzahlbereich1..10;
Altgewichte werden nicht still gerundet oder verworfen.

`executeGeneration` bestätigt Tabellen-/Loot-/Presetresultat in seinem Receipt.
Der Controller übernimmt dieses Resultat sofort nach erfolgreicher Antwort.
Ein anschließender `generationSources`-Read kann diesen Write nicht zum
fehlgeschlagenen Save erklären. Bei Readfehler schließt der erfolgreich
abgeschlossene Manager, die Übersicht enthält die bestätigte Revision, und
„Änderung bestätigt“ benennt den fehlgeschlagenen Refresh samt ausdrücklichem
Aktualisieren. Der Hinweis steht auch direkt beim Tabellenbereich und bleibt
bis zu erfolgreichem Refresh sichtbar. Ein weiterer Edit bindet an die neue Revision; er wiederholt
keinen alten Save. Weltquellenprosa und offene Factionentwürfe werden bei einem
Readfehler nicht geleert. Ihre bestehenden Revisionschecks bleiben wirksam.
Ein fehlgeschlagener Write lässt dagegen den Entwurf offen. Keine Schemaänderung,
zweiter Writer oder neuer Tabellenbestand.

Die Store-/DOMfälle in `desktop-table-weights.test.mjs` trennen bestätigten
Write mit danach defektem Result-/Transportread von einem abgewiesenen Write
und prüfen den nächsten Edit mit der bestätigten Basis. Scope-/Generationtests
sichern die angrenzenden Grenzen. Das beweist keine Recovery eines unbekannten
Schreibausgangs und keine vollständige native Tabellenabnahme.

Die nächsten Anschlüsse bleiben ausführbar:

1. **Unbekannten Ausgang wieder aufnehmen.** Der bestehende persistierte
   `generation_receipt` ist die Ergebnisquelle. Dessen Status und ursprünglichen
   Command/Fingerprint über die vorhandene Commit-/Recoverygrenze anbinden,
   statt einen neuen Command zu erfinden. Bestätigt, unbekannt und fehlgeschlagener
   Read bleiben getrennte Zustände. Momentan blockiert auch ein langsamer
   Nachread den laufenden UIauftrag. Verlorene Antwort, Close/Escape während
   Save, Restart und spätere Registryänderung gemeinsam qualifizieren.
2. **Factionanschluss liefern.** Aus `world-source-ui` denselben Tabellenmanager
   über dem unveränderten Factiondraft öffnen, neue Tabelle zurückgeben und dort
   auswählen. Neue Scopewahl bleibt sichtbar. Cancel/Discard benötigen dieselbe
   Closeanfrage; nur oberstes Modal ist interaktiv. Native Fokus-/Esc-/200%-Probe
   schließt diese Anforderung ab, keine zweite Tabellenmaske.
3. **Delete von Papierkorb unterscheiden.** `table-trash` erhält heute reversible
   Verknüpfungen. Das ist kein Beleg für endgültiges Delete der Originalquelle.
   Den finalen Löschweg mit `world_source`-Ortslinks, Factionhaupttabelle und
   abgeleiteten Bestandslimits in derselben Transaktion liefern; Installation
   betrifft sämtliche Campaigns. Restore darf keine früher entfernte Bindung
   erfinden. Stale Revision, Fehler bei späterer Faction und unveränderte freie
   Prosa/Receipts sind notwendige Abnahmen.
4. **Quellregeln vollständig schließen.** Gewichtbereich vor neuem Schreiben
   verbindlich entscheiden und vorhandene exakte Altgewichte ausdrücklich
   migrieren/erhalten. No-table-Fallback von gewählter leerer Tabelle trennen,
   alle Kreaturfilter und XPceiling schneiden, Loot-Konflikt nur warnen.
   Diese Quellenregeln brauchen eigene Store-/Nutzerablaufbelege; grüne
   Tabelleneditierung qualifiziert sie nicht automatisch.


## SRD-Gegenstandsreferenz im gemeinsamen Katalog (0.146)

Die gebundene Originalanforderung `requirements-items-catalog.md` verlangt eine
schreibgeschützte öffentliche SRD-Referenz neben Monster. Der Desktop besitzt
jetzt diesen eigenen Inhaltswechsel; die bestehende Gegenstands-/Shopverwaltung
bleibt der getrennte Owner für authored Definitionen, Besitz und Handel.
Der Encounterbereich bleibt beim Wechsel sichtbar und behält seinen Entwurf.
Explizite Kreaturquellen und Tabellenlookups öffnen wieder den Monsterbereich.

`storage/item-reference.ts` liest ausschließlich das vorhandene gepinnte
`items-srd51-transcript.json` und prüft es lazy mit dem vorhandenen
2020-12-Schema. Es schreibt weder Definitionen noch SQLite und gibt Kopien der
Quellenrecords zurück. Name, Kategorie, Unterkategorie, Seltenheit, Magie,
Einstimmung und exakte Preisgrenzen sind kombinierbar. Name/Kategorie/Seltenheit/
Preis sortieren mit stabiler Identität; unbekannte Preise bleiben unabhängig von
der Richtung am Ende und werden nicht als Nullpreise in Preisgrenzen aufgenommen.
50er-Seiten machen den gesamten vorhandenen Korpus erreichbar.

`item-reference-ui.ts` zeigt Originalbeschreibung und Eigenschaften, Preis,
Gewicht, Rüstung/Schaden sowie verfügbare weitere Quellenangaben und Attribution.
Es gibt keine Erzeugungs-, Editier-, Lösch-, Vergabe- oder Inventaraktion.
Loading, leere Treffer, ungültige Filter, fehlender Import, inkompatibles Schema
und unerwarteter Lesefehler bleiben unterscheidbar. Neue Eingaben räumen alte
Ergebnisaktionen sofort ab; verspätete Antworten und alte Zeilen besitzen keine
Auswahlberechtigung. Submit/Reset/Sort/Paging beenden den Debouncetimer.
Tastaturwechsel zwischen beiden Kataloginhalten und schmale Inspectorführung
bleiben ohne zusätzliche Navigationsfläche erreichbar.

Der aktuelle Import enthält 289 Records und ist ausdrücklich unvollständig.
Weitere magische Quellenabschnitte und die unabhängige Quellenabnahme fehlen;
die Oberfläche behauptet keine Vollständigkeit. Provider-/DOMfälle prüfen die
vollständige Erreichbarkeit des vorhandenen Korpus, Filter/Sortierung, genaue
Rüstungs-/Waffenfakten, Ergebnisautorität und Fehlerisolation. Das ersetzt weder
die offenen Quellenabschnitte noch breite native Plattform-/200%-Abnahme.
