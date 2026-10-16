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
Controller-/DOM- und native Lesebelege;
native Tastatur/Fokus, Langlisten und fachliche Generierung benötigen ihre
eigenen Nachweise.

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
