# Katalogsuche und Gegenstandsreferenz

Quellen: [Original Catalog Tab UI](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/creatures/requirements/requirements-creatures-catalog.md),
[Catalog Requirements](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/catalog/requirements/requirements-catalog.md),
[Katalog-/Encountervertrag](../../../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md).
Für schreibende Vorlagen, Tabellen und Generatoren: [Encounterplanung](encounter-planning.md).
Übergaben am Spieltisch: [Referenzsuche](rule-references.md) und
[spontane Katalogübernahme](combat-recovery.md#spontane-katalogübernahme-ohne-teilkampf).

## Code und Prüfwege

| Anliegen | Besitzer / vorhandene Prüfung |
| --- | --- |
| Monsterquery, Detail, Quellenmetadaten | [catalog-ui.ts](../../../src/app/catalog-ui.ts), [encounters.ts](../../../src/app/storage/encounters.ts), [CreatureCatalog](../../../src/features/catalog/creature-catalog.ts); [Query-/Kontexttests](../../../tests/desktop-catalog-query-context.test.mjs) |
| SRD-Itemquelle und Inhaltswechsel | [item-reference.ts](../../../src/app/storage/item-reference.ts), [item-reference-ui.ts](../../../src/app/item-reference-ui.ts); [Provider-/DOMtests](../../../tests/desktop-item-reference.test.mjs) |
| Eigene Gegenstandsdefinition: Auswahl, Speichern, Antwortklärung | [items-ui.ts](../../../src/app/items-ui.ts): `selectDefinition`, `flushDrafts`, `recoveredItems`; [storage/items.ts](../../../src/app/storage/items.ts): `executeItemShop`; [Auswahl-/Schreibtests](../../../tests/desktop-item-selection.test.mjs), [native Auswahl-/Schreibprobe](../../../tools/test-desktop-item-selection.mjs) |
| Gemeinsame Filter im Generator | [generation-ui.ts](../../../src/app/generation-ui.ts); [Generierungskontext](../../../tests/desktop-generation-context.test.mjs) |

Obsidian-Catalogviewtests qualifizieren den Desktopcontroller nicht automatisch.
Native Lesefluss-, Enter-/Fokus- und Inhaltswechselproben sind begrenzte Belege;
Linkedomidentität allein beweist keinen nativen Fokus, verzögerter IPC keinen
physisch abgebrochenen Read. Gesamt-, Langlisten-, Tastatur-, 200%- und
Plattformabnahme bleiben eigenständig.

## Aktueller Suchvertrag

- Der gebundene Monsterprovider bleibt read-only. Mengenfilter sind im Provider
  validiert; viele Desktopcontrols liefern noch einwertige Arrays. Desktopseiten
  enthalten 25 Treffer, die historische Quelle nennt 50; Paging muss den ganzen
  vorhandenen Korpus erreichbar halten.
- Eingabe entwertet alte Queryantworten und Ergebnisaktionen sofort. Nach 200 ms
  beginnt die Suche auf Seite 1. Submit, Reset, Sort und Paging beenden den
  ausstehenden Timer. Reset erhält Sortierung und Encountereinstellungen.
- „Noch nicht geladen“, Suche, leer und Fehler sind verschiedene Zustände.
  Suche/Fehler sperren Paging; ein Fehler erhält Filter und explizites Submit-Retry,
  zeigt aber keine alten Treffer als aktuelle. Eine alte Detailantwort darf den
  Queryfehler nicht als „keine Kreaturen“ überschreiben. Bereits lesbare Details
  bleiben auch bei Suchfehlern eigenständige Referenzinformationen.
- Metadaten, Treffer, Vorlagen und Generator werden unabhängig gelesen.
  Metadatenfehler bleiben bei Quellen/Lizenz, erhalten gesunde Treffer/Details und
  werden beim erneuten Öffnen wiederholt. Direkte Quellenöffnung liest die gewählte
  Kreatur/Vorlage unabhängig von diesen Listen; spätere Antworten ändern sie nicht.
- Neue Detailauswahl leert den alten Statblock und sperrt Encounter-/Scene-/
  Tabellenübergabe bis zur passenden Creature-ID. Laden/Fehler stehen im Inspector;
  dieselbe Zeile wiederholt den Read. Alte oder falsche IDs erhalten keine
  Übergabeautorität. Kampagnenwechsel leert die Auswahl, geschlossener Tabellenlookup
  stellt die vorherige Auswahl wieder her; Kreaturdetails bleiben Quelleninformation.
- Detailstatus aktualisiert Inspector/Auswahlmarkierung, ohne Trefferzeilen neu
  aufzubauen. Stabile Creature-IDs erhalten DOMidentität und Enterfokus auch bei
  langsamem Read, Fehler und Retry; schmale Ansichten führen ausdrücklich zum
  Inspector. Erst eine neue Ergebnisquery ersetzt die Zeilen und markiert die
  weiterhin sichtbare ID. Keine zweite Auswahl-/Tastaturverwaltung oder Schemaänderung.

### Gültige HG-Bereiche und native Zahleneingaben

Die zuletzt durch `change` bestätigte Grenze bestimmt einen überkreuzten Bereich:
„von 8“ über „bis 5“ zieht die Obergrenze auf 8; „bis 2“ unter „von 8“ die
Untergrenze auf 2. Nicht jede Zwischenziffer beim Tippen darf die Gegengrenze
ändern. Submit bestätigt auch das fokussierte HG-Feld. Ein gültiger Debounceread
wird beim späteren Fokuswechsel nicht doppelt gesendet.

Endliche negative HG-Werte werden auf 0 begrenzt; Brüche wie 0,125 bleiben exakt,
es gibt keine zusätzliche feste Obergrenze. Leeres Maximum ist unbeschränkt.
Minimum 0 ist kein aktiver Chip/Queryfilter, Maximum 0 ist wirksam. Andere Filter,
Sortierung und Encountereinstellungen bleiben erhalten.

`catalog-ui.query()` unterscheidet leer von `validity.badInput` (etwa einem nativen
„−“) und prüft alle sechs HG-/RK-/HP-Grenzen auf endliche, nichtnegative Werte.
Ungültige oder noch widersprüchliche Eingaben zeigen Feld-/Ergebnisfehler und
senden keine unbeschränkte Suche. „Vorschläge“ bricht vor Planabschluss und
Generierungs-IPC ab; Planungstext und roher Wert bleiben erhalten. Der transiente
Vorschlagsfingerprint entwertet auch bei ungültigen Filtern alte Vorschauen;
historische Requestfilter bleiben unverändert. Korrigieren/Leeren gibt den
normalen Weg wieder frei, ohne neue Persistenz.

## Eigene Definitionsentwürfe und sichere Auswahl

Eigene Definitionen werden in „Gegenstände und Shops“ bearbeitet. Die öffentliche
SRD-Referenz bleibt read-only; eine eigene Kopie besitzt ihre eigene Identität.
[item-definition-validation.ts](../../../src/app/item-definition-validation.ts)
enthält die gemeinsame Strukturprüfung und die Konstruktion des nächsten eigenen
Definitionsstands. Renderer und Writer verwenden
denselben reinen Code. Ein leerer Name oder eine Beschreibung über 100.000 Zeichen
bleibt vor Prüfsumme, Buchungsmarker und IPC im bisherigen Editor korrigierbar.
[saveItemDefinition](../../../src/app/storage/item-definitions.ts) prüft aktuellen
Stand, SRD-Schreibschutz und historische Versionen innerhalb der Transaktion.
Keine Migration oder Änderung vorhandener
Definitionsbytes; gültige Korrekturen nutzen die bestehende
[Buchungsbestätigung](../../../ARCHITECTURE.md#buchungsantworten-klären).

`desktop-item-selection.test.mjs` prüft frühe Ablehnung ohne Buchungsbeginn und
DBänderung, genau eine korrigierte Buchung sowie einen gültigen Entwurf bei
gehaltener Prüfsumme. Die native Probe `tools/test-desktop-item-selection.mjs`
führt Namenskorrektur, blockierten Wechsel, Freigabe, Neustart und unabhängige Kopie
bei 100/200 Prozent aus. Unberührte CRLF-Prosa, andere Definitionen und die zweite
Figur bleiben erhalten; Vergabe, Schatz und Shopübernahme behalten ihre eigenen
Checks. Die Probe benutzt aktuelle Kampagnenkarten, Bereichsschalter und
Detailbereiche. Start, isoliertes Profil, Buildhashes, frische nichtleere Bilder,
normale Exits und verschwundene Prozess-IDs übernimmt der gemeinsame
`native-session.mjs`-Helfer. `GM_QA_ZOOM=1` bzw. `2` prüft den tatsächlichen
Anwendungszoom; Pixeldichte wird nicht als Zoomnachweis gewertet.
Historische Schalter für unsicheres Altverhalten entfallen. Diese Linuxprobe ist
keine vollständige Plattform-, Tastatur- oder Owner-Abnahme.

## SRD-Gegenstandsreferenz

`requirements-items-catalog.md` verlangt die öffentliche read-only SRD-Referenz.
Autorenwerte, Besitz und Handel gehören weiterhin der Gegenstands-/Shopverwaltung;
der Encounterentwurf bleibt beim Inhaltswechsel sichtbar und erhalten.
Kreaturquellen und Tabellenlookups öffnen den Monsterbereich.

Der Itemreader prüft das gepinnte `items-srd51-transcript.json` lazy mit dem
2020-12-Schema, gibt Quellenkopien zurück und schreibt weder Definitionen noch
SQLite. Name, Kategorie/Unterkategorie, Seltenheit, Magie, Einstimmung und exakte
Preisgrenzen sind kombinierbar. Namen, Kategorie, Seltenheit und Preis sortieren
mit stabiler Identität; unbekannte Preise stehen in beiden Richtungen am Ende
und zählen nicht als Null in Preisfiltern. 50er-Seiten erschließen den vorhandenen
Korpus. Spaltenköpfe, Pfeil und `aria-sort` teilen dieselbe Richtung; Reset und
Inhaltswechsel erhalten sie. Seltenheitsvarianten bleiben Treffer ihrer vollständigen
Quellgruppe mit unveränderten Fakten.

Details zeigen Beschreibung, Eigenschaften, Preis, Gewicht, Rüstung/Schaden,
weitere Quellenangaben und Attribution. „Stärke“ ist von Rüstungsklasse getrennt;
Originalwerte bleiben erhalten. Es gibt keine Inventar-, Vergabe- oder Editaktion.
Laden, leer, ungültiger Filter, fehlender Import, inkompatibles Schema und Lesefehler
bleiben unterscheidbar. Neue Eingaben entwerten alte Aktionen, Submit/Reset/Sort/
Paging beenden Timer; beide Inhalte bleiben per Tastatur und schmalem Inspector
zugänglich. Der Import ist unvollständig: weitere magische Abschnitte und die
unabhängige Quellenabnahme fehlen.

Die Referenzsuche zeigt Name, Kategorie, lesbar bezeichnete Ausrüstungsart und Preisobergrenze direkt. Seltenheit, Magie, Einstimmung und Preisuntergrenze stehen unter „Weitere Filter“; dessen Beschriftung nennt auch geschlossen die Anzahl wirksamer Zusatzfilter. Sortieren, Inhaltswechsel und Zurücksetzen verwenden weiterhin dieselben Filterwerte. Bei gewöhnlicher Ausrüstung entfallen die redundante Magiezeile und nicht angegebene Seltenheit/Einstimmung im Detail. Vorhandene Angaben, unbekannter Preis oder unbekanntes Gewicht sowie unveränderte englische Quellregeln bleiben sichtbar. Der gewählte Gegenstand ersetzt die allgemeine Inspectorüberschrift. Der kurze Quellenhinweis zeigt die vom Reader gelieferte Vollständigkeit; aufklappen erschließt weiterhin vollständigen Importtext und Lizenz. Fehlende Vollständigkeitsangaben gelten ausdrücklich als unbekannt.

## Inhaltswechsel und Wiederaufnahme

Akzeptierte Filter, Sortierung, Seite, Treffer, Auswahl, Inspector und Position
bleiben je Inhalt erhalten. Ausblenden beendet Debounce und entmächtigt laufende
Antworten, leert aber keine akzeptierte Page. Deren Zeilen binden an die Page-ID,
nicht an eine nur zum Abbruch erhöhte Requestnummer. Rückkehr braucht für einen
fertigen Stand keinen Quellenread; neue Eingabe/Campaignaktivierung entwertet ihn.

Unterbrochene Suche startet bei Rückkehr genau einmal mit den rohen Filtern;
wiederholtes Öffnen erzeugt keine Parallelreads. Suchfehler bleiben bis zum
expliziten Retry; leer, ungültig oder fehlender Import werden beim Wechsel nicht
neu gelesen. Ein unterbrochener Monsterstatblock verlangt erneute Auswahl;
versteckte Zeilen starten keinen Detailread. Campaignaktivierung setzt den
transienten Stand zurück; es gibt keine neue Speicher-/Migrationsgrenze.

Monster-Metadaten folgen derselben Sichtbarkeit, teilen einen laufenden Read und
cachen vollständige lokale Ergebnisse. Wechsel vor Dispatch verhindert den Read;
späterer Wechsel entwertet Erfolg und Fehler, bricht IPC aber nicht physisch ab.
Bei Rückkehr werden fehlende Metadaten unabhängig von erhaltenen Trefferzeilen
neu gelesen; ein synchroner Bridgefehler gibt Retry frei. Vorlagen-/Generatorreads
sind hiervon getrennte offene Owner.

## Offene Lieferungen

- Mehrfachauswahl und anhand sichtbarer Labels ohne Fall-/Diakritikaabhängigkeit
  auffindbare Werte; vollständige, identische Filtermenge in Chips, Sort/Paging
  und Generator. Schwierigkeits-/Mengen-/Diversitätsvorgaben und offene Prosa erhalten.
- Gemeinsame Biomidentität: `Creature.biomes`, Query `habitats`,
  `EncounterTable.habitats` und Hexterrain sind noch kein gemeinsamer Katalog.
  Stabile IDs/Labels an bestehender Definitions-/Importgrenze festlegen; freie
  Altwerte zuordnen oder ungeklärt erhalten. Geschützte `Any`-Tabelle gilt überall
  und ist kein Biomfilter. Tabellen mit sichtbarem Pool schneiden; Lootkonflikte
  sichtbar machen. Zwei Campaigns, unbekannte Altwerte und Importkonflikte prüfen.
- Übergaben nur ausdrücklich gewählter Kandidaten in die bestätigte Fokusgruppe;
  Drain/Read und Kampagnen-/Gruppenwechsel dürfen das Ziel nicht umdeuten.
  Native Fehler, schnelles Tippen, Enter, Paging, 200% und Fokusrückkehr qualifizieren.
- Vorlagen-/Generatorreads nur beim sichtbaren Owner starten und laufende Antworten
  beim Wechsel entmächtigen, ohne Encounterentwürfe oder Speicheraufträge zu verlieren.
- Ausdrücklicher Refresh soll akzeptierte Treffer erhalten und ausstehenden Filterstand
  davon unterscheiden; unveränderte IDs behalten Auswahl/Scroll, verschwundene IDs
  werden entwertet. Vorhandene Queryguards nutzen, keinen zweiten Providerbestand.
- NPCs, Fraktionen, Orte, Encounter und Tabellen über bestehende Owner in den
  Inhaltswechsel samt gemeinsamem Status-/Pagingfooter integrieren. Je Abschnitt
  unfertige Eingabe, Seite/Auswahl/Position, Fehler/Retry, Enter, schmale Ansicht,
  200% und fehlende versteckte Listenreads prüfen. Das ersetzt keine SRD-Abnahme.
