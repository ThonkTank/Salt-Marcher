# Gemeinsame Providerverträge

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: catalog
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Gemeinsame Providerverträge

### Ziel und Wahrheitsgrenze

CE-02 erweitert den bestehenden, qualifizierten Monsterkatalog zu genau einem
zustandserhaltenden Katalog mit sieben Bereichen:

1. Monster;
2. Items;
3. gespeicherte Encounter;
4. NPCs;
5. Fraktionen;
6. Orte;
7. Encounter-Tabellen.

Bindend sind die CE-02-Anforderungen in
`docs/catalog/requirements/catalog-encounters.md`, die dokumentierten
SaltMarcher-Anforderungen und -Verträge sowie die bestehenden CE-01-Belege.
SaltMarcher-Code ist nur Verhaltensreferenz. Die aktuelle Zielarchitektur
entscheidet Datenbesitz und Adapter.

CE-02 ist erst vollständig, wenn alle sieben Bereiche ihre echten, geprüften
Datenquellen besitzen. Ein sichtbarer Bereichswähler oder ein typisierter
Nichtverfügbar-Zustand ist allein keine Fachfreigabe. CE-01 bleibt trotz dieser
Planung mit physischer Eingabe, Screenreader und weiteren Plattformen offen.

### Nichtziele

Dieser Plan autorisiert noch keine Umsetzung von:

- Item-Import, Loot-Erzeugung, Inventar- oder Shopmutation;
- Encounter-Builder, DMG-2014-Berechnung, Initiative oder Combat-State;
- CRUD-Oberflächen für NPCs, Fraktionen, Orte oder Encounter-Tabellen;
- automatische Übergaben an Encounter, Scene oder Atlas;
- SQLite, eine allgemeine Repository-/ORM-Schicht oder eine zweite
  Katalogwahrheit;
- eine Vorentscheidung der noch vorgeschlagenen Zielplattform-ADR.

### Ein gemeinsamer Katalog, sieben Eigentümer

#### Kanonische Bereichsquelle

Eine einzige geordnete, unveränderliche `CATALOG_SECTIONS`-Definition ist die
Quelle für Schlüssel, Label, Reihenfolge und Capability-Status. Die Schlüssel
sind stabil und hostneutral:

`creatures`, `items`, `savedEncounters`, `npcs`, `factions`, `places`,
`encounterTables`.

Rail, Persistenznormalisierung, Fokusfolge, Tests und Providerregistrierung
leiten sich aus dieser Quelle ab. Kein zweites Array, Switch mit denselben
sieben Paaren oder manuell synchronisierte Tab-/State-Liste ist zulässig.

#### Zustand

Der neue hostneutrale `CatalogWorkspaceState` besitzt eine explizite
Schemaversion, `activeSection` und genau einen getrennten Zustand je Bereich.
Jeder Bereich behält mindestens:

- angewandte Suche und noch nicht angewandten Draft;
- bereichseigene Filter und Chips;
- Sortierspalte und Richtung;
- Seite;
- ausgewählte stabile ID;
- Ergebnis- und Inspector-Scrollposition;
- den letzten sichtbaren Lade-/Leer-/Fehlerstatus nur soweit er keine
  veralteten Daten als Wahrheit persistiert.

Der Monsterzustand bleibt der bestehende `CreatureCatalogViewState` und wird
nicht in einen kleinsten gemeinsamen Datentyp gepresst. Die anderen Bereiche
erhalten eigene typisierte States. Eine State-Map kapselt diese Typen, ohne
ihre fachlichen Filter anzugleichen.

Die Normalisierung erkennt ausschließlich den aktuellen unversionierten
CE-01-Zustand als Ausgang des fortgeführten Produkts und legt ihn verlustfrei
unter `sections.creatures` ab. Unbekannte Bereichsschlüssel, ungültige Werte
und beschädigte Payloads werden verworfen oder auf dokumentierte Defaults
gesetzt; sie dürfen keinen anderen Bereich beschädigen. Es gibt keine
Migration historischer Alt-Editorformate.

#### Gemeinsame Interaktion

Alle Bereiche verwenden:

- 200-ms-Draftsuche mit sofortigem Enter-Flush;
- entfernbare aktive Chips und bereichseigenen Reset;
- sortierbare Tabellenköpfe;
- begrenztes Paging und Ergebnisfooter;
- explizite Lade-, Leer-, Nichtverfügbar-, ungültige-Filter- und Fehlerzustände;
- tastaturbedienbare Zeilenauswahl;
- einen read-only Inspector.

Der Bereichswähler ist ein zugängliches Tab-/Panel-Muster mit sichtbarer
Auswahl, roving Tabindex, Pfeil/Home/End sowie Enter/Space. Umschalten speichert
den alten Bereichszustand vor dem Rendern des neuen. Escape schließt nur die
aktuelle Auswahl, nicht den Bereich. Auswahl bleibt nebenwirkungsfrei; eine
spätere Übergabe benötigt einen ausdrücklich benannten Button und ein eigenes
Anwendungskommando.

### Hostneutrale Providergrenze

Die View erhält eine registrierte read-only Provider-Map. Jeder Provider
besitzt seinen Query-, Row-, Detail- und Fehlervertrag und bietet nur:

- eine begrenzte, deterministisch sortierte Ergebnisseite;
- Detail für eine stabile ID;
- Capability-/Quellenmetadaten;
- `AbortSignal` beziehungsweise eine gleichwertige Abbruchgrenze.

Rows und Details sind immutable DTOs. Provider veröffentlichen keine
Speicherrecords, Vaultpfade, SQLitezeilen, mutable Domainmodelle oder
allgemeinen Querybuilder. Die View importiert keinen Vault-, Datei- oder
Datenbankadapter.

Jede Anfrage bindet Bereichsschlüssel und monotone Generation. Nach einem
Bereichswechsel, neuer Suche oder Close dürfen verspätete Resultate weder den
aktuellen Bereich noch dessen Auswahl, Footer oder Inspector überschreiben.
Fehler und Retry sind auf genau den betroffenen Bereich begrenzt.

Die gemeinsame Shell besitzt Rail, Header, Status, Ergebnisfläche, Footer und
Inspector. Bereichseigene Filter, Spalten, Row- und Detailprojektionen werden
über enge Deskriptoren eingesetzt. Es entstehen weder sieben Viewkopien noch
ein generischer Renderer, der unvalidiertes HTML oder beliebige Funktionen aus
Datenquellen ausführt.

### Datenbesitz je Bereich

#### Monster

Die vorhandene CE-01-Wahrheit bleibt unverändert: gepinnte SRD-5.1-Daten,
Manifest, SHA-256, Attribution, lazy Loader und `CreatureCatalog`-API. Filter,
Draftzuordnung und Statblockprojektion werden nicht dupliziert. Der neue Shell-
Adapter muss die bestehenden CE-01-Tests und Hostbelege erhalten.

#### Items

Items erhalten einen eigenen lokalen, read-only Referenzkatalog mit stabilen
Quellenschlüsseln. Vor dem ersten Datenimport benötigt das Umsetzungspaket:

- eine ausdrücklich freigegebene öffentliche Quelle samt Version, Lizenz und
  Attribution;
- Manifest, Dateihash und reproduzierbaren Generator;
- ein Schema für Name, Kategorie, Unterkategorie, Rarität, Magiestatus,
  Einstimmung, Kosten, Gewicht, Eigenschaften, Beschreibung, Schadens- oder
  Rüstungsdaten und Quellenverweis;
- fail-closed Unterscheidung von fehlendem Import, inkompatiblem Schema und
  beschädigten Daten.

SaltMarchers Loot-Index ist ausdrücklich keine Item-Detailquelle. Browsing
führt keinen Netzwerkzugriff und keine Mutation aus.

#### Gespeicherte Encounter

Encounter bleibt alleiniger Eigentümer. Die Katalogsuche liest nur stabile
Plan-ID, Name und Encounter-eigene Kurzfassung. Roster und XP werden erst für
die ausgewählte ID über einen getrennten begrenzten Detailread hydratisiert.
Statblocks, Initiative, HP, Runde, Zug und Combat-State werden weder kopiert
noch hier gespeichert.

Encounter besitzt revisionierte Store-Records und einen abgeleiteten Suchindex.
Sein Codec und Referenzvertrag müssen vor der ersten Persistenz konkret geprüft
sein; atomare Writes und Konfliktbehandlung folgen dem gemeinsamen Storevertrag.
CE-02 konsumiert ausschließlich read-only Projektionen.

#### NPCs, Fraktionen und Orte

World Planner verantwortet die revisionierten Store-Records und ihre
abgeleiteten Suchindizes:

- NPC: stabile Identität, Name, Creature-ID-Referenz, Lebenszyklus, Notizen und
  optionale Fraktions-/Ortsreferenzen; keine kopierten Statblockfelder;
- Fraktion: stabile Identität, Name, Notizen, Mitgliedschaften, Disposition,
  primäre Encounter-Table-ID und Inventargrenzen;
- Ort: stabile Identität, Name, geordnete Tags, Read-aloud, GM-Notizen sowie
  Referenzen auf Fraktionen und Encounter-Tabellen.

Die Katalogprovider veröffentlichen read-only Projektionen. Fremde Creature-
oder Encounter-Table-Wahrheit wird über deren Besitzer nachgelesen. Auswahl
mutiert keine Beziehung und keine globale Scene.

#### Encounter-Tabellen

Encounter Tables verantwortet stabile Tabellen-IDs, revisionierte Store-Records
und einen eigenen read-only Provider. Auswahl kopiert weder
Tabellenmitgliedschaften noch Creature-Wahrheit. Spätere Pool-/Encounter-
Aktionen referenzieren IDs über eigene Commands.

World Planner und Encounter Tables benötigen konkrete Codecs und gültige
Referenzprojektionen vor ihrer ersten gespeicherten Wirkung. Der gemeinsame
Store besitzt Writes, Revisionen und Recovery; die Viewer-Shell liest nur.

### Umsetzungspakete

#### CE-02-I01 – Shell und Zustand

- kanonische sieben Bereichsdefinitionen;
- versionierter Workspace-State mit verlustfreier CE-01-Einordnung;
- gemeinsamer Rail-/Shell-/Status-/Paging-/Inspector-Rahmen;
- read-only Providerverträge und Stale-/Abort-Schutz;
- echter Monsterprovider über die gemeinsame read-only Querygrenze;
- für die sechs noch nicht gelieferten Provider ausschließlich ehrliche
  `unavailable`-Capabilities mit erklärendem Status.

I01 schließt keinen neuen Datenbereich und CE-02 nicht ab. Es darf keine
Beispiel- oder erfundene Produktwahrheit als Inhalt anzeigen.

#### CE-02-I02 – Items

Nach eigenem Provenienz-/Schema-Review: gepinnter Itemkatalog, Generator,
Manifest/Attribution, Provider, Filter, Sortierung, Paging und vollständiger
read-only Inspector. Item-Acceptance wird getrennt reviewed; die übrigen fünf
Provider bleiben dadurch nicht bestanden.

#### CE-02-I03 – Encounter-Readmodel

Nach reviewtem Encounter-Dokument-/Indexvertrag: gespeicherte Encounter suchen,
auswählen und begrenzt hydratisieren. Keine Builder- oder Combatmutation.

#### CE-02-I04 – World-Planner-Readmodels

Nach reviewten Owner-Schemata: NPCs, Fraktionen und Orte als getrennte
Providerprojektionen. Beziehungen werden nur gelesen und als stabile Links
gezeigt.

#### CE-02-I05 – Encounter-Table-Readmodel

Nach reviewtem Tabellenvertrag: suchen, auswählen, inspizieren; keine
Generierung oder globale Poolmutation.

#### CE-02-H01 und CE-02-C01

Der gemeinsame echte Hostlauf muss alle sieben realen Provider prüfen. Die Providerbelege allein ersetzen keine Encounter-Builder- oder Combatabnahme. Offene Providerbefunde bleiben sichtbar und werden nicht durch spätere Funktionsbelege geschlossen.

### Technische Modulgrenzen

CE-02-I01 liefert Bereichsdefinitionen, Workspace-State, Providerprojektionen und die gemeinsame read-only Oberfläche. Codecs, Queryadapter und deren DOM-/Fokusgrenzen folgen der [Gesamtgrundlage](../../project/architecture/overview.md). I02 bis I05 ergänzen die tatsächlichen Datenprovider; Encounter-/Combat-/Scene-/Atlasmutationen gehören zu ihren Fachabläufen.

Die heutigen Anschlüsse unter `src/features/catalog/`, `src/ui/view-types.ts`, `src/main.ts` und `tools/host/ce02-catalog.cjs` sind Istcode. Seine Verhaltenstests und Quellenartefakte können nach Prüfung verwendet werden; interne APIs und Hostkopplung müssen nicht erhalten bleiben.

### Automatisierte Gates

Für jedes Produktpaket bestehen `npm run check`, `npm test` und
`npm run build`. I01 benötigt zusätzlich mindestens:

- exakt sieben Schlüssel, Label und Reihenfolge aus der einen kanonischen
  Quelle;
- Migration des aktuellen CE-01-Zustands sowie Normalisierung beschädigter,
  unbekannter und partieller Workspace-Payloads;
- Bereichswechsel erhält je Bereich Draft/Applied Query, Filter, Sortierung,
  Seite, Auswahl und beide Scrollpositionen;
- 200-ms-Debounce, Enter-Flush, Reset, Chips, Tabellenkopf, Paging und
  Zeilennavigation laufen über gemeinsame Interaktionspfade;
- roving Bereichsfokus und Tastaturfolge einschließlich Home/End;
- verspätete, abgebrochene und fehlerhafte Providerantworten bleiben im
  verursachenden Bereich;
- Missing-/Unavailable-/Empty-/Invalid-/Error-Zustände sind unterscheidbar und
  retrybar, ohne Monster zu beschädigen;
- Auswahl ist nebenwirkungsfrei und es existiert kein implizites
  Encounter-/Scene-/Atlas-Kommando;
- vorhandene CE-01-State-, DOM-, Adapter-, Buildasset- und Boundarytests bleiben
  grün;
- kein direkter Vault-, Datei-, SQLite- oder Obsidianzugriff in State, Shell
  oder Providervertrag.

I02 bis I05 ergänzen je Eigentümer Contract-, Schema-, Provenienz-, beschädigte
Daten-, Revision-, Indexrebuild-, Query-/Detail- und Cross-reference-Tests.
Testzahlen allein schließen keine Fachabnahme.

### Echter Host und physische Gates

CE-02-H01 verwendet neue isolierte Profile unter
`/home/aaron/.cache/dungeon-native-qa/` und bindet exakten sauberen SHA,
Produktbytes und normalen Prozesslebenszyklus. Mindestens:

- überlappende Open-Kommandos ergeben genau einen Katalogleaf;
- alle sieben Bereiche werden mit Maus und automatisierter Tastaturfolge
  geöffnet; ihre getrennten Zustände bleiben nach Wechsel erhalten;
- frischer Obsidian-Prozess stellt aktiven Bereich und sämtliche sieben
  Zustände exakt wieder her;
- pro Provider werden Loading, Empty, Invalid, Unavailable, Error und Retry
  dort geprüft, wo sie fachlich möglich sind;
- 900×650 und 1150×700 besitzen keinen horizontalen Hauptscroll und halten
  Rail, Ergebnisse, Footer und Inspector bedienbar;
- beschädigter Workspace- oder Providerzustand bleibt auf seinen Bereich
  begrenzt und erlaubt same-leaf Retry;
- Auswahl verändert keine Encounter-, Scene-, Atlas- oder Ownerdatei;
- Close/Restart endet normal ohne erzwungene Terminierung.

Physische Tastatur/Maus, Screenreader und weitere Plattformen bleiben eigene
Pflichtzeilen. Automatisierte DOM- oder Playwrightfolgen ersetzen sie nicht.
