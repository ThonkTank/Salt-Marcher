# Gemeinsamer Katalog: Suchstand und nächste Lieferungen

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

### Gültige HG-Bereiche und native Zahleneingaben

Die zuletzt bestätigte HG-Grenze bestimmt den Bereich: „von8“ oberhalb „bis5“
zieht die sichtbare Obergrenze auf8; „bis2“ unterhalb „von8“ zieht die
Untergrenze auf2. Endliche negative HG-Eingaben werden auf0 begrenzt.
Bestätigt wird die vollständige Zahl durch den nativen `change`-Abschluss
(Fokuswechsel/Tab/Enter), nicht durch jedes Tastaturzeichen. Dadurch bleibt
beim Tippen von12 die ursprüngliche Untergrenze8 erhalten; die Zwischenziffer1
verschiebt sie nicht. Ein während der Bearbeitung widersprüchlicher Bereich
zeigt lokal den Hinweis zum Eingabeabschluss und sendet keinen Such- oder
Generierungsauftrag. Ein gültiger Bereich wird weiterhin nach200ms gesucht;
sein späterer Fokuswechsel erzeugt keine zweite Anfrage. Ein ausdrücklicher
Suchsubmit bestätigt auch das fokussierte HG-Feld.
Bruchgrenzen wie0,125 bleiben exakt; keine Rundung auf ganze HG und kein
zusätzlicher fester Höchstwert beschneiden den vorhandenen Providervertrag.
Leere Obergrenze bedeutet weiterhin unbeschränkt. Mindest-HG0 verändert den
Pool nicht und wird weder als aktiver Chip noch als zusätzlicher Queryfilter
weitergegeben. Höchst-HG0 bleibt dagegen ein wirksamer Filter. Andere
Katalogfilter, Sortierung und Encountereinstellungen bleiben erhalten.

Native Zahlfelder können beispielsweise ein eingegebenes „−“ als leeren Wert
mit `validity.badInput` melden. Das ist ausdrücklich kein leerer Filter.
Der gemeinsame `catalog-ui.query()`-Einstieg prüft diesen Zustand sowie endliche
nichtnegative vorhandene Werte für alle sechs HG-/RK-/HP-Grenzen. Er zeigt den
Fehler am Feld und in der Ergebnisfläche, ohne eine unbeschränkte Suche zu
senden. Derselbe Fehler erscheint beim Generator. „Vorschläge“ beendet den
Aufruf vor Planabschluss oder Generierungs-IPC; vorhandene Planungstexte und
der Rohwert bleiben erhalten. Der bestehende transiente Vorschlagsfingerprint
kennt auch ungültige Filter, sodass eine spät gelieferte Vorschau für den alten
gültigen Stand keine Übernahmeautorität für den neuen ungültigen Stand bekommt.
Die ursprünglichen Requestfilter bleiben historische Fakten. Korrigieren oder
Leeren stellt die normale Suche/Generierung wieder her, ohne neue Persistenz.

Die bisherigen Querytests deckten Requestreihenfolge und Chipentfernung ab,
prüften aber weder überkreuzte Grenzen noch die native Unterscheidung zwischen
leer und ungültig. Neue DOM-Gegenfälle prüfen beide Änderungsrichtungen,
Brüche, negative Werte, HG0, dieselben Filter im tatsächlichen Generatoraufruf,
Fehler/Recovery, mehrstellige Zahleneingabe ohne Änderung der Gegenbegrenzung
und eine spät eintreffende alte Vorschau. Diese Teilkorrektur
ersetzt nicht die noch offene Mehrfachauswahl, gemeinsame Biomidentität,
gesamte Katalog-/Generierungs- oder Plattformabnahme.

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
   Die HG-Bereichskorrektur und die Unterscheidung leer/ungültig sind oben
   angeschlossen; weitere Filter müssen denselben vollständigen Poolvertrag
   behalten. Abnahme: mehrere Typen/Biome,
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

Der Fraktions-/Ortsquelleneditor verwendet für Escape und Abbrechen dieselbe
Closeanfrage und denselben vorhandenen `generation-discard`-Dialog wie Tabellen
und Beute. Der Baselinevergleich berücksichtigt rohe Controlwerte einschließlich
Checkboxen; auch eine Schreibweise wie `02` statt `2` bleibt ein offener Entwurf.
Weiterbearbeiten hält Inputs und ursprüngliche Revision, Verwerfen schließt ohne
Write. Während `source-save` bleibt der Editor auch bei Escape offen und nimmt
keinen zweiten Submit an. Ein abgewiesener Write erhält Rohtext und Basis; erst
ein bestätigter Save schließt genau seinen Editor. Campaignreset entwertet alte
Save-/Discardcallbacks. Store-CAS und die bestehende Generationtransaktion bleiben
die einzige Schreibgrenze; es gibt keine neue Entwurfspersistenz.

Die Fraktionshaupttabelle erscheint nur im eigenen Selector. Ortscheckboxen
zeigen nur ortseigene Tabellen; sie duplizieren keine Fraktionstabelle als
vermeintlich fehlende Verknüpfung.

Die World-Source-DOMfälle prüfen diese Modalzustände, beide Closewege, Rohwerte,
Doppelsubmit und Contextreset. Eine native Probe verzögert den IPCdispatch und
weist den echten SQLitewrite durch einen Trigger ab: Escape während Save,
Weiterbearbeiten, Retry und ausdrückliches Verwerfen erhalten den richtigen
Bestand und unveränderte Autorenprosa. Frisches Storelesen ist vom vollständigen
Appneustart getrennt. Unbekannte Schreibausgänge bleiben der folgende offene
Recoveryanschluss; der geschützte Dialog beweist ihre Klärung nicht.

Der Fraktionseditor öffnet über „Neue Haupttabelle anlegen“ denselben
Tabellenmanager oberhalb seines weiterhin montierten Entwurfs. Neuanlage beginnt
im Campaignscope und erlaubt ausdrücklich den Installationsscope. Cancel/Discard
kehrt ohne Änderung zur Fraktion zurück; der Fokus landet auf dem Auslöser.
Bestätigter Save liefert genau den Record aus der Generationantwort zurück,
auch wenn der anschließende Quellenrefresh ausfällt. Nur die Haupttabellenwahl
und ihre davon abhängigen Bestände ändern sich: gemeinsame Kreaturen behalten
Limits samt rohem Eingabetext, entfernte Kreaturen verlieren die Limits,
neue Einträge sind unbegrenzt. Haltung und weitere offene Felder bleiben erhalten.
Eine Rückgabe nach Contextreset besitzt keine Auswahlberechtigung.

Die neue Tabelle ist bereits ein eigener bestätigter Datensatz. Erst „Quellen
speichern“ bindet sie mit der ursprünglichen Fraktionsrevision; Verwerfen der
Fraktion löscht die separat angelegte Tabelle nicht. Kein impliziter Fraktionswrite,
keine kopierten Tabellen oder neue Persistenzgrenze. DOM-/Storefälle und ein
nativer verschachtelter Ablauf prüfen Discard, nur oberstes Modal interaktiv,
Fokusrückkehr, Rawfields, Installationsscope und kontrollierten Nachreadfehler.
Vollständige200%- und unbekannte-Write-Abnahme bleiben offen.

Die nächsten Anschlüsse bleiben ausführbar:

1. **Unbekannten Ausgang wieder aufnehmen.** Der bestehende persistierte
   `generation_receipt` ist die Ergebnisquelle. Dessen Status und ursprünglichen
   Command/Fingerprint über die vorhandene Commit-/Recoverygrenze anbinden,
   statt einen neuen Command zu erfinden. Bestätigt, unbekannt und fehlgeschlagener
   Read bleiben getrennte Zustände. Momentan blockiert auch ein langsamer
   Nachread den laufenden UIauftrag. Verlorene Antwort, Close/Escape während
   Save, Restart und spätere Registryänderung gemeinsam qualifizieren.
2. **Verschachtelte Anlage vollständig qualifizieren.** Der Factionanschluss
   verwendet jetzt den gemeinsamen Manager und bestätigten Rückgaberecord.
   Restprüfung:200%, vollständige Tastaturwege, Appneustart nach getrenntem
   Table-/Factionwrite sowie unbekannter Ausgang eines der beiden Saves.
   Fraktionsentwurf und neu bestätigte Tabelle getrennt wiederfinden; abgewiesene
   Fraktionsrevision darf die angelegte Tabelle nicht löschen oder ihren Scope
   ändern. Weitere inline Konsumenten verwenden denselben Anschluss, keinen
   zweiten Tabelleneditor.
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
Die Item-Spaltenköpfe wählen die Sortierung und wechseln ihre Richtung. Ein
sichtbarer Pfeil und `aria-sort` zeigen dieselbe aktive Richtung; ein zusätzlicher
Richtungswähler entfällt. Filterreset und Inhaltswechsel erhalten die Sortierung.
Der Seltenheitsfilter berücksichtigt ausdrücklich benannte Varianten einer
Definition. Die Auswahl enthält deren einzelne Seltenheiten; der Treffer bleibt
die vollständige Quellgruppe mit unveränderten Fakten und Variantenangaben.

`item-reference-ui.ts` zeigt Originalbeschreibung und Eigenschaften, Preis,
Gewicht, Rüstung/Schaden sowie verfügbare weitere Quellenangaben und Attribution.
Rüstungs-Stärkevoraussetzungen stehen unter „Stärke“ neben der getrennten
Rüstungsklasse; ihre originalen Quellenwerte bleiben erhalten.
Es gibt keine Erzeugungs-, Editier-, Lösch-, Vergabe- oder Inventaraktion.
Loading, leere Treffer, ungültige Filter, fehlender Import, inkompatibles Schema
und unerwarteter Lesefehler bleiben unterscheidbar. Neue Eingaben räumen alte
Ergebnisaktionen sofort ab; verspätete Antworten und alte Zeilen besitzen keine
Auswahlberechtigung. Submit/Reset/Sort/Paging beenden den Debouncetimer.
Tastaturwechsel zwischen beiden Kataloginhalten und schmale Inspectorführung
bleiben ohne zusätzliche Navigationsfläche erreichbar.

Der aktuelle Import ist ausdrücklich unvollständig.
Weitere magische Quellenabschnitte und die unabhängige Quellenabnahme fehlen;
die Oberfläche behauptet keine Vollständigkeit. Provider-/DOMfälle prüfen die
vollständige Erreichbarkeit des vorhandenen Korpus, Filter/Sortierung, genaue
Rüstungs-/Waffenfakten, Ergebnisautorität und Fehlerisolation. Das ersetzt weder
die offenen Quellenabschnitte noch breite native Plattform-/200%-Abnahme.


## Inhaltswechsel und Wiederaufnahme

[Catalog Requirements](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/catalog/requirements/requirements-catalog.md)
verlangt pro Abschnitt erhaltene Filter, Sortierung, Seite, akzeptierte Treffer,
Auswahl und Ergebnisposition. Das Ausblenden der Itemreferenz entzieht laufenden
Antworten die Autorität und beendet den Debouncetimer; es leert keinen abgeschlossenen
Anzeigezustand. Bei Rückkehr bleiben dieselben DOMzeilen samt Auswahl, Inspector und
Scrollposition erhalten, ohne zusätzlichen Quellenread. Die Zeilen binden an die
akzeptierte Pageidentität; eine nur zum Abbruch erhöhte Requestnummer darf ihre
Bedienung nach Rückkehr nicht sperren. Eine neue Eingabe oder Campaignaktivierung
entzieht dagegen der alten Page die Auswahlberechtigung und leert sie weiterhin.

Eine unterbrochene Suche wird bei Rückkehr genau einmal aus den aktuellen rohen
Filterwerten fortgesetzt; wiederholtes Öffnen startet keine parallele Anfrage.
Eine bereits angezeigte Fehlerantwort bleibt mit ausdrücklichem Suchen als Retry
erhalten. Fehlender Import, ungültiger Filter und leeres Ergebnis werden ebenfalls
nicht beim bloßen Tabwechsel neu gelesen. Es gibt keinen zusätzlichen Speicher-
oder Migrationsvertrag: die Quelle ist lokal und read-only, Campaignaktivierung
setzt den transienten Zustand zurück.

Die Itemreferenztests zählen Reads und prüfen Page/Sort/Auswahl, abgebrochenen
Debounce, verspätete Antwort, Campaignreset und ausdrückliches Fehlerretry. Ein
nativer Tabwechsel prüft zusätzlich Scrollposition und erneute Enterauswahl mit
dem gebundenen Korpus; kontrollierte IPCverzögerungen/-fehler werden dabei getrennt
von echten Quellenfehlern bezeichnet. Das ist keine Gesamtabnahme des Katalogs.

Auch die Monstersuche beendet beim Inhaltswechsel ihren Debouncetimer und entzieht
laufenden Query-/Statblockantworten die Autorität. Versteckte Zeilen starten keinen
Statblockread. Akzeptierte Seite, Sortierung und Auswahl bleiben erhalten; eine
unterbrochene Suche startet bei Rückkehr einmal mit den aktuellen Filtern. Ein
unterbrochener Statblock zeigt wieder die Auswahlaufforderung und wird ausdrücklich
neu gewählt. Sichtbare Suchfehler bleiben bis zum Suchen-Retry stehen.
`desktop-catalog-query-context.test.mjs` prüft diese Wechsel einschließlich später
Erfolge und Fehler. Quellenmetadaten und Filteroptionen folgen beim Inhaltswechsel der Monsterauswahl.
Ein laufender Read wird dort geteilt; Ausblenden oder Campaignwechsel entzieht
auch Erfolg und Fehler die Autorität. Ein vor dem Dispatch erfolgter Wechsel
verhindert den Read ganz. Bei Rückkehr werden fehlende Metadaten unabhängig von
der erhaltenen Trefferseite neu gelesen, ohne deren DOMzeilen zu ersetzen.
Bereits vollständig geladene lokale Quellenmetadaten bleiben im vorhandenen
Cache. Ein synchroner Bridgefehler gibt den ausdrücklichen Retry wieder frei.
Die DOMgegenfälle prüfen versteckten Erfolg/Fehler, doppeltes Öffnen, Retry
und den gemeinsamen Monsterbrowser im Tabellenmanager;
ein bereits gestarteter IPCread wird nicht nachträglich als physisch abgebrochen
behauptet. Eine native Linuxprobe mit echtem SRDKorpus verzögert den Metadaten-IPC
und liefert getrennt kontrollierten Erfolg oder Fehler nach dem Wechsel zu Items.
Sie prüft die unveränderten Itemdetails, genau einen Read bei Rückkehr, dieselben
Monsterzeilen, unveränderte Kampagnenrevision und zwei normale Appaustritte.
Das qualifiziert weder den vollständigen Katalog noch alle Plattformen/200%.
Vorlagen- und Generatorreads bleiben getrennte offene Owner.

Die nächsten Anschlüsse aus derselben Quelle bleiben ausdrücklich offen:

1. Vorlagen-/Generatorreads in `activateCatalog`, `openCatalog` und
   `activateGeneration` nur aus ihrem sichtbaren Owner auslösen und deren laufende
   Antworten bei Inhaltswechsel passend entmächtigen. Encounterentwürfe und deren
   Speicheraufträge bleiben erhalten. Monsterquery, Detail und Quellenmetadaten
   sind sichtbar gebunden; das ist noch keine vollständige Sichtbarkeitsbindung
   aller Katalogprovider.
2. In beiden Providern akzeptierte Treffer während eines ausdrücklich angeforderten
   Refresh sichtbar erhalten, dabei ausstehenden Filterstand und aktuelle Treffer
   unterscheiden und Fehler ohne falsche Erfolgsmeldung zeigen. Auswahl/Scroll bei
   unveränderter Quellen-ID erhalten; verschwundene IDs ausdrücklich entwerten.
   Query-/Requestguards weiterverwenden, keinen zweiten Providerbestand anlegen.
3. Die verbleibenden fünf Abschnitte NPCs, Fraktionen, Orte, Encounter und
   Encountertabellen über ihre vorhandenen fachlichen Owner in den gemeinsamen
   Inhaltswechsel aufnehmen und den gemeinsamen Status-/Pagingfooter schließen.
   Eigene Abschnittsfilter und ausdrückliche Inspectoraktionen bleiben
   erhalten. Abnahme pro Abschnitt: Wechsel mit unfertiger Eingabe, Seite/Auswahl/
   Position, Fehler/Retry, Enter, schmaler Ansicht und200%; versteckte Provider
   dürfen keine neuen Listenreads starten. Providerintegration ersetzt weder die
   vollständige SRDquellenlieferung noch deren unabhängige Abnahme.

## Planungsparty zwischen Vorlage und Generator bearbeiten

„Aktuelle Party übernehmen“ ersetzt ausdrücklich den Planungssnapshot und lässt
den geöffneten Partyeditor sichtbar. „Zur Planungsparty“ öffnet den Partybereich
vor dem Fokus auf das erste Eingabefeld; bei leerer Party führt der Fokus zur
Zeilenanlage. Ohne geöffnete Vorlage öffnet der Rücksprung die Vorlagenliste
und fokussiert die Vorlagenanlage. Das Ziel wird direkt sichtbar gescrollt. Der Generatorzugang
bleibt nach der Partyübernahme erreichbar. Diese Navigation ändert weder
Szenenmitgliedschaft noch den unabhängigen Planungssnapshot beim Kampfstart.

## Bestehende Encounter-Vorlage auffüllen (0.149)

Die [Originalanforderung Encounter Generation](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/encounter/requirements/requirements-encounter-generation.md)
verlangt einen festen additiven Bestand. Im Katalog kann der GM jetzt eine
vorhandene Vorlage samt Planungsparty öffnen und im Generator „Aktuelle Vorlage
auffüllen“ wählen. Die vorherige Vorlage bleibt unverändert. Jeder Vorschlag
enthält unabhängige Eintrags-IDs, bewahrt die bestehenden Gegner einschließlich
Mobwahl und benannter NPCs und erhält die Originalnotizen vor seiner ergänzten
Herkunftsangabe. Die Vorschau benennt feste Basis, beibehaltene Gegner und
Ergänzung getrennt; Übernahme verwendet den vorhandenen Vorlagenwriter.

`GenerationRequest.fillPlan` bindet ID und gespeicherte Revision;
`GenerationRun.fixedRoster` hält den vollständigen historischen Ausgangsstand.
Der vorhandene pure Selector bewertet Gesamt-XP, Monsterzahl, Statblocks und
Initiativeplätze aus festem Bestand plus Ergänzung. Harte Kompositionsregeln
und Monsterfilter betreffen die Ergänzung. Ein bereits ausreichender Bestand
braucht keinen künstlichen Zusatz. Ohne passende Ergänzung kann die nächste
gültige Lösung außerhalb des Zielbands bleiben; die vorhandene Abweichungsanzeige
bleibt bindend. Gewählte endliche Bestände zählen vorhandene Gegner desselben
Kreaturtyps mit und werden beim Erzeugen nicht verbraucht.

Benannte Basisfiguren werden aus zusätzlichen NPC-Kandidaten ausgeschlossen.
Sie nochmals ausdrücklich als verbindliche Ergänzung auszuwählen ergibt eine
konkrete Korrekturmeldung. Quelle, Partymitgliedschaft, HP und Scenezeit ändern
sich beim Vorschlagen und Speichern einer Vorlage nicht. Die vorhandenen
Preset-, Tabellen-, Katalog-, NPC- und Weltquellenprüfungen bleiben zuständig.
Eine inzwischen geänderte Ausgangsvorlage sperrt eine neue Übernahme; ihre alte
Vorschau bleibt mit Originalsnapshot lesbar. Bestehende Previewformate ohne
Auffüllbasis bleiben gültig. Keine Schemaänderung, kein zweiter Selector.

Die UI entwertet eine sichtbare Auffüllvorschau auch bei Änderungen an Namen,
Notizen, Einträgen oder gewählter Ausgangsvorlage. Vor dem Erzeugen wird der
bestehende Vorlagenentwurf abgeschlossen und dessen bestätigte Revision gebunden.
Restart, Backup und unabhängiger Campaigntransfer erhalten die Vorschau;
Kopien remappen ihre lokalen Vorlagen-/Eintrags-/NPC-IDs im bestehenden Walker,
während Kreaturkatalogdaten und freie Prosa erhalten bleiben.

Gezielte Store-/DOMfälle prüfen Füllung außerhalb des Ergänzungsfilters,
Gesamtbewertung, unveränderte Quelle, keine künstliche Ergänzung, stale Basis,
endlichen Bestand, NPC-Eindeutigkeit und unabhängige Kopie/Fresh. Native Linux-
Belege prüfen tatsächliches Erzeugen/Übernehmen, getrennte Anzeige, erhaltene
Notizen, Ablehnung einer alten Basis sowie normales Wiederöffnen.
Das ist noch keine vollständige Scene-/Session-Parität: direktes Auffüllen
persistenter Scenegruppen, vollständige konkrete Kapazitätsallokation bei
ungleichen endlichen Statblockbeständen, p95-/200%-/Golden-/Plattformabnahme
bleiben offen. Alle weiteren Anforderungen des Originals behalten ihren Umfang.
