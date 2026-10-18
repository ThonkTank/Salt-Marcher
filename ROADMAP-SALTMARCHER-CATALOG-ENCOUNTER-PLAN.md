# SaltMarcher-Katalog- und Encounter-Migration

Abschnitte: [Monsterkatalog](#monsterkatalog) · [Monster-Hostprüfung](#monster-hostprüfung) · [Gemeinsame Providerverträge](#gemeinsame-providerverträge) · [Itemquellen und Provider](#itemquellen-und-provider)

Stand: 10. Oktober 2026. Dieser Plan überführt die Katalog- und Encounter-
Funktionen aus `ThonkTank/Salt-Marcher` in das Obsidian-Plugin. SaltMarcher ist
die Implementierungs- und Verhaltensquelle; die vergleichbaren aktuellen
D&D-Beyond-Abläufe bilden die Mindestabnahme. Der bestehende Dungeon-, Hex- und
Stadtstand bleibt erhalten.

## Technischer Anschluss vom 11.10.2026

[ARCHITECTURE](ARCHITECTURE.md) ersetzt alte Host-/Persistenzvorschriften:
Installationcatalog, World/Plan/Runtime und Ledger im gewählten SQLite-Store;
readonly Provider liefern revisionierte DTOs, UI besitzt keine SQLrechte.
Quellen/2014-Regeln/Attribution, Full-S01 und fachliche Goldens bleiben bindend.
Die unten beschriebenen gzip-/main.js-/Vault-/Obsidianimplementationen sind
datierte Ist-/Übergangsbelege, kein Bestandsschutz oder Zielpackaginglimit.
Readonly Provider enthalten keine Persistenz; das verbietet nicht den gemeinsamen
produktiven SQLite-Anschluss. Zustands-/Adaptercode darf ersetzt werden.

## Ziel und Grenzen

- Eine gemeinsame GM-Arbeitsfläche zeigt Monsterkatalog, Encounter-Aufbau und
  den laufenden Kampf ohne Seitenwechsel beim Hinzufügen oder Nachschlagen.
- Monster- und Encounterdaten liegen als versionierte Vaultdaten vor. Karten
  referenzieren stabile Encounter- und Kreaturenkennungen; Statblocks werden
  nicht in jede `.dungeon`-Datei kopiert.
- SRD-5.1-Daten aus SaltMarcher dürfen mit ihrer CC-BY-4.0-Provenienz übernommen
  werden. Nutzerinhalte bleiben eine getrennte Quelle.
- Das Plugin unterstützt ausschließlich die D&D-2014-Regeln. Encounter verwenden
  immer die DMG-2014-Schwellen und Monsterzahlmultiplikatoren; es gibt keinen
  Regelmodus, keinen 2024-Rechner und keine Regelversionsauswahl.
- Katalog, Plan und Laufzeitkampf sind getrennte Wahrheiten. Ein gespeicherter
  Plan enthält Zusammenstellung und Notizen; Initiative, HP, Runde, Zustände,
  Würfelprotokoll und Undo gehören zum fortsetzbaren Laufzeitstand.
- Diese Migration ersetzt weder die vorhandenen Raum-Keys noch deren aktuelle
  einfache Encounter-Auswertung. Sie verbindet diese schrittweise über stabile
  IDs und behält vorhandenen Text bytegenau bei.

## Referenzen

SaltMarcher-Quellen:

- `docs/catalog/requirements/requirements-catalog.md`
- `docs/creatures/requirements/requirements-creatures-catalog.md`
- `docs/creatures/requirements/requirements-creatures-details.md`
- `docs/encounter/requirements/requirements-encounter.md`
- `docs/encounter/requirements/requirements-encounter-generation.md`
- `docs/campaign/requirements/requirements-campaign-management.md`
- `docs/encounter/requirements/requirements-encounter-state-tab.md`
- `src/core/creatures/catalog.ts`
- `src/core/creatures/srd-5.1.generated.json`
- `src/core/encounter/`
- `src/renderer/features/catalog/`
- `src/renderer/features/encounter/`

Offizielle Produktreferenzen für die Mindestabnahme:

- D&D Beyond Encounters (DMG 2014):
  <https://dndbeyond-support.wizards.com/hc/en-us/articles/46363685344148-What-is-happening-to-the-Encounters-tool>
- D&D Beyond Monsterkatalog: <https://www.dndbeyond.com/monsters>
- D&D Beyond Encounter-Ablauf:
  <https://www.dndbeyond.com/posts/1135-tutorial-how-to-build-encounters-and-run-them-on-d>

## Offene Punkte vor Fachfreigabe

1. SaltMarcher bringt einen vollständigen SRD-5.1-Katalog und die benötigte
   2014-Mathematik, aber nicht alle vergleichbaren D&D-Beyond-2014-Filter. Die
   zusätzlichen Filter sind eine echte Erweiterung.
2. Das aktuelle Plugin besitzt einfache Kreaturdefinitionen in Karteninhalten,
   aber noch keinen vaultweiten Monster- oder Encounter-Speicher. Migration und
   ID-Verknüpfung müssen vorhandene Definitionen unverändert lesbar lassen.
3. Homebrew-Schema, Importformat und Konfliktauflösung brauchen vor dem ersten
   Schreib-Import einen eigenen Vertrag. Read-only SRD und manuell angelegte
   Datensätze dürfen nicht dieselbe Quellenkennung behaupten.
4. Würfelausdrücke aus Statblock-Prosa benötigen einen begrenzten Parser mit
   sichtbarer Rohformel; Freitext darf nicht als Code ausgeführt werden.
5. Vollständige Maus-/Tastatur-, Obsidian-Neustart- und beschädigte-Daten-
   Abnahme bleibt auf echten Hosts erforderlich.

## Phasen

### CE-00 – Vertrag, Provenienz und Golden Master

- Architektur, Datenbesitz, IDs, Versionen und Migrationsgrenzen festlegen.
- SaltMarcher-Dateien und D&D-Beyond-Funktionsmatrix den Abnahmefällen zuordnen.
- SRD-Lizenz/Attribution und die DMG-2014-Tabellen pinnen.
- Ergebnis: geprüfter Plan und offene Abnahmefälle; keine Funktionsfreigabe.

### CE-01 – Read-only Monsterkatalog

- Versionierten SRD-5.1-Katalog mit Manifest und Attribution übernehmen.
- Validierung toleriert keine beschädigten Einträge und meldet Quelle/Version.
- Volltextsuche; kombinierbare Filter für CR, Typ, Subtyp, Größe, Habitat,
  Alignment, AC, HP, Bewegung, Sinne, Verwundbarkeit, Resistenz, Immunität,
  Zustandsimmunität und Quelle. Eine Regelversionsauswahl entfällt vollständig.
- Sortierung, Paging, Reset, aktive Filter und vollständiger Statblock behalten
  Suche, Auswahl und Scrollposition.

### CE-02 – Vollständiger SaltMarcher-Katalog

- Gemeinsamer, zustandserhaltender Bereichswähler für Monster, Items,
  gespeicherte Encounter, NPCs, Fraktionen, Orte und Encounter-Tabellen.
- Alle Bereiche teilen 200-ms-Suche, Enter-Sofortsuche, Chips, Reset,
  Tabellenkopf-Sortierung, Paging/Footer, Lade-/Leer-/Fehlerzustände,
  tastaturbedienbare Auswahl und read-only Inspector.
- Items erhalten einen echten Referenzkatalog; SaltMarchers Loot-Index ist kein
  Ersatz für Itemdetails, Quelle, Einstimmung, Gewicht und Beschreibung.
- NPCs, Fraktionen, Orte und Encounter-Tabellen verwenden revisionierte
  Records des gemeinsamen Stores. Zeilenauswahl bleibt nebenwirkungsfrei; nur
  ausdrückliche Aktionen übergeben Daten an Encounter, Szene oder Atlas.

### CE-03 – Encounter Builder und Planpersistenz

- Partyzeilen mit Level, Anzahl, Aktivzustand und frei benannten NPCs.
- Monster aus derselben Katalogansicht hinzufügen; gruppierte Menge und einzelne
  Exemplare bleiben semantisch verschieden.
- Live-Berechnung von Basis-XP, angepasstem XP und Schwierigkeit ausschließlich
  nach DMG 2014. Es gibt keinen auswählbaren Regelmodus.
- Plan anlegen, automatisch speichern, laden, duplizieren, neu starten, suchen,
  sortieren und löschen; Name, Kurzfassung, Beschreibung und Notizen erhalten.
- Generatorvorgaben bis zum Nutzerweg liefern: Einstellungen öffnen → geschütztes
  Systempreset kopieren → Rollen-/CR-Matrix, gültige Kombinationen, Mengenbereiche,
  Difficultygewichte und Mobschwelle bearbeiten → speichern → ausdrücklich einer
  Campaign zuweisen → Scene-/Sessiongenerierung konsumieren → frisch öffnen.
  Kopieren/Speichern weist nichts zu; Löschen eines Custompresets führt seine
  Campaigns auf den Systemfallback. Kein Regelversionswähler. Tastatur/Painting,
  Dirty-Wechsel, 200 %, stale Save mit erhaltenem Draft/Load-or-Copy und unbekannter
  Commandausgang über Receipt im selben Ergebnis prüfen. Installation besitzt
  Registry, Campaign nur Zuweisung; produktive Schreib-/Recoveryautorität mit
  Campaign/Data ([Campaign-Datenvertrag](ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md)) bestätigen, keine zweite Campaignregistry.
  Kampagnenkennung und gelesene Registry bilden einen gemeinsamen bestätigten
  Kontext. Ein fehlgeschlagener Kontextwechsel erhält die bisherige Auswahl und
  den offenen Vorgabenentwurf; er zeigt keine alte Zuweisung für die neue Campaign.
  Beim fehlgeschlagenen Öffnen bleibt die Quelle ausdrücklich nicht verfügbar,
  ohne frühere Formularwerte als gültige Vorgaben anzubieten. Speichern/Zuweisen
  bleiben getrennte Befehle mit unveränderten Revisionen und Receipts. Gezielte
  Store-/DOM- und native Fehler-/Retry-/Neustartproben prüfen diesen Übergang;
  vollständige Generator-, Leistungs- und Plattformabnahme bleiben eigenständig.
- Scene und Session konsumieren einen gemeinsamen Compositionselector und dieselbe
  kanonische Presetrevision/Confighash-Provenienz. Kandidaten vor Ranking gegen
  Rollen/Mengen/Kombinationen/Stock/Statblockkapazität prüfen; Domainranking geht vor
  seeded Entropie. Scene-„Auffüllen“ erhält vorhandene Mitglieder als additive Basis;
  fehlgeschlagene konkrete Materialisierung schwächt keinen gewählten CR-Block ab.
  Gleiche verfügbare Inputs ergeben gleiche abstrakte Blocks; erst der Encounterowner
  löst konkrete Creatures auf. Sourceartefakt/Gültigkeit, Scene-/Sessionparität und
  getrenntes <100-ms-p95-Selectorprofil nach Encounter Generation qualifizieren.
  Keine Übernahme der alten Electronmodal-/Schemaarchitektur durch diesen Lieferweg.

### CE-04 – Initiative und fortsetzbarer Kampf

- Automatische/manuelle Initiative, Vorteil/Nachteil, stabile Sortierung und
  A/B/C-Kennungen für einzelne gleiche Monster.
- Runde, aktueller Zug, Weiter, Rückgängig und freie Initiativeeinträge.
- Aktuelle/maximale/temporäre HP, Max-HP-Override, Schaden, Heilung, AC,
  Zustände, Zustandsimmunitäts-Hinweis und Bloodied/Dead-Ableitung.
- Jede Mutation wird atomar gespeichert; Neustart setzt denselben Stand fort.
- Effektives Preset/Revision/Hash und Mobschwelle beim Prepare festhalten. Null
  liefert individuelle Sources, die bestätigte Schwelle bündelt lebende Mengen.
  Explizite Sourceidentität/Partition speichern; Mobverstärkung bleibt Mob,
  vorhandene Individuals bleiben individuell. Erst ohne überlebende Source neu
  partitionieren. Schwellenwechsel, Verstärkung, Entfernen und Neustart erhalten
  Initiative-/HP-/Partitionwahrheit; keine Ableitung aus Namen oder Row-ID-Parsing.
  Quelle: Encounter Generation „Combat Consumption“, [Katalog-/Encountervertrag](ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md); [LiveScene-Vertrag](docs/plans/runtime/smr03-live-scene-contract.md), SMR-AC-06.

### CE-05 – Statblock-Aktionen und Live-Anpassung

- Angriff, Schaden, Check und Rettungswurf aus begrenzt erkannten Formeln.
- Würfelprotokoll mit Akteur, Aktion, Formel, Einzelwürfeln, Modifikator,
  Ergebnis und Zeit.
- Teilnehmer hinzufügen/entfernen, ohne übrigen Laufzeitstand zurückzusetzen.
- Reduzierte Spielersicht mit expliziter Sichtbarkeit verborgener Gegner.

### CE-06 – Dungeon-, Raum-Key- und Atlas-Verbindung

- Vorhandene Encounter-Namen/Links optional auf stabile Plan-IDs migrieren.
- Raum-Key-Kreaturen können ausdrücklich in einen Plan übernommen werden; bloßes
  Öffnen oder Auswählen verändert keinen Encounter.
- Encounter- und Kreaturenlinks fokussieren den zugehörigen Raum/Ort im
  gemeinsamen Atlas, ohne zweiten Editor- oder Kartenmodus.

### CE-07 – Gesamtqualifikation

- Alle Abnahmefälle auf frischem Obsidian-Prozess, Reload und beschädigten
  Fixtures prüfen; 900×650 und 1150×700 ohne horizontales Hauptscrollen.
- Die jeweils betroffenen Fach-/Hostfälle mit dem nutzbaren CE-Ergebnis prüfen. Fehlende Fach-/Hostabnahmen bleiben explizit offen.

## Mindestabnahme gegenüber D&D Beyond

1. `dragon` plus CR-, Größen-, Typ- und Quellenfilter liefert nur die
   Schnittmenge; Reset stellt den Katalog wieder her.
2. Jede Zeile zeigt Name, Quelle, Typ, Größe, CR, AC, HP und XP;
   der Statblock öffnet ohne Verlust des Katalogzustands.
3. Ein Golden-Master-Encounter wird reproduzierbar nach den gepinnten
   DMG-2014-Schwellen und Monsterzahlmultiplikatoren bewertet.
4. Party-, Aktiv- und Mengenänderungen aktualisieren die Bewertung unmittelbar.
5. Drei einzeln hinzugefügte Goblins besitzen drei Initiativen; eine Gruppe mit
   Menge drei besitzt eine gemeinsame Initiative und individuelle HP.
6. Initiativeänderung sortiert sofort und bleibt nach Neuöffnung erhalten.
7. Weiter rollt nach dem letzten Eintrag die Runde; Undo stellt Zug und Runde
   wieder her.
8. Schaden verbraucht temporäre HP zuerst; Heilung überschreitet maximale HP
   nicht und verändert temporäre HP nicht.
9. Runde, Zug, Initiative, HP, temporäre HP und Zustände überleben Neustart.
10. Live-Hinzufügen/-Entfernen erhält alle übrigen Teilnehmerzustände.
11. Würfelprotokolle enthalten sämtliche Eingaben und Einzelwürfel.
12. Zustände und Immunitätshinweise sind in Liste und Detail sichtbar.
13. Speichern, Duplizieren, Neustarten und Löschen haben getrennte Wirkung.
14. Maus und Tastatur erreichen alle Pflichtfunktionen; leerer Katalog,
    optionale Felder und beschädigte Einträge erzeugen keine ungefangenen Fehler.

## Bestehende Implementierung und Abnahmegrenzen

CE-01 besitzt komprimiertes Buildasset/Lazy Loader, Katalogview und Command-Fokus, Suche, 2014-Filter mit Chips/Reset, Sortierung/Paging, Auswahl/Statblock, Debounce/Stale-Schutz, responsive Controls und atomare Draftübernahme bei Hostwechsel. Concurrency- und Tastaturfokusfehler sind repariert; automatisierte echte Obsidianfälle sind belegt. Physische Eingabe, Screenreader, weitere Plattformen und vollständige Encounterfunktion fehlen. Exakte Quellen, Ergebnisse und Grenzen stehen in `acceptance.json.saltMarcherCatalogEncounter`.

## Monsterkatalog

### Vorhandene Basis

Der geprüfte Katalogkern enthält 334 SRD-5.1-Kreaturen mit Manifestbindung,
unabhängigem Artefakthash, kombinierten Filtern, Sortierung, Paging, Detailzugriff
und tiefer Immutabilität. Der derzeitige Obsidianadapter stellt ihn über einen
Lazy Loader und eine eigene Katalogansicht bereit. Die aktuelle Fachabnahme und
ihre Grenzen stehen in `acceptance.json.saltMarcherCatalogEncounter`.

### Verbindliche Entscheidungen

1. Katalog ist eine persistente GM-Arbeitsfläche: Query, Auswahl, Paging und
   Scrollposition bleiben bei Fokuswechsel erhalten. Ein Modal allein genügt
   diesem Nutzerweg nicht. Der alte Obsidian-ItemView/View-Type ist keine Ziel-API.
2. Quelle/Manifest/Inhaltshash/Lizenz und stabile Definition-IDs bleiben
   verbindlich. Geprüfte gebündelte Daten werden im Installationcatalog des
   gewählten Stores indexiert; readonly Provider liefern paginierte immutable
   DTOs. Keine komplette Statblockmaterialisierung bei Produktstart.
3. Renderer/Controls lesen weder Dateien noch SQLite. Parser/Queryalgorithmen
   dürfen nach Prüfung übernommen werden. Fehler sind identifiziert und
   wiederholbar; kein stiller Source- oder Regelversionswechsel.
4. Notice/Attribution ist im Produkt und Export direkt erreichbar und benennt
   alle gebundenen Quellen/Lizenzen, Normalisierung und Kopie. Das neue
   eigenständige Paket liefert diese Inhalte distributionssicher mit.
5. D&D 2014 bleibt einziges Coreprofil; keine 2024-/Multisystemarchitektur.

Die frühere main.js-/Base64-/DecompressionStream-/Drei-Plugin-Dateien-
Entscheidung wird ersetzt. Ihre Lauf-/Buildbelege im Abnahmeregister sind historische
Obsidianbefunde, kein Zielpackaginglimit. Neue Bundleartefakte erhalten
Manifest-/Hash-/Offline-/Installationsprüfung an der neuen Zielshell.

### Oberfläche und Zustandsbesitz

`CreatureCatalogView` besitzt pro geöffneter Ansicht:

- akzeptierte Query und noch nicht veröffentlichte Texteingabe,
- ausgewählte Kreaturen-ID,
- Seite, Sortierspalte und Richtung,
- Ergebnis- und Detailprojektion,
- Scrollposition von Ergebnisliste und Detailbereich,
- 200-ms-Debounce-Timer, Query-Generation und einen `AbortController`.

Die erste schmale Umsetzung verwendet drei Bereiche:

1. Eine kompakte Filterleiste mit Namenssuche, CR min/max, Typ, Größe,
   Habitat, Alignment, AC min/max, HP min/max sowie Freitextfeldern für
   Bewegung, Sinne, Verwundbarkeit, Resistenz, Immunität und
   Zustandsimmunität. Quelle ist sichtbar `SRD 5.1`; sie ist kein sinnloser
   Einzelauswahlfilter.
2. Eine semantische Ergebnistabelle mit sortierbaren Spalten Name, HG, RK, TP
   und XP. Typ, Größe und Quelle bleiben sichtbar. Tabellenfuß enthält Anzahl,
   Seite, Zurück/Weiter und eindeutigen Lade-/Leer-/Fehlerstatus.
3. Ein read-only Statblock-Inspector mit Name, Metazeile, RK/TP/Bewegung,
   Attributen, Rettungswürfen, Fertigkeiten, Sinnen, Sprachen,
   Verwundbarkeiten/Resistenzen/Immunitäten, Eigenschaften, Aktionen und
   legendären Aktionen. Er verändert weder Karte noch Encounter.

Alle aktiven Filter erscheinen als einzeln entfernbare Chips; `Zurücksetzen`
leert nur Filter und springt auf Seite eins. Sortierung bleibt erhalten. Ein
Nameklick, Doppelklick oder Enter auf einer ausgewählten Zeile öffnet Details.

### Tastatur und Barrierefreiheit

- Suchfeld und Filter besitzen sichtbare Bezeichnung oder `aria-label`.
- Tabellenkopf-Buttons veröffentlichen `aria-sort`.
- Ergebniszeilen sind per Tab erreichbar; Pfeil hoch/runter verschiebt die
  Auswahl, Enter öffnet Details.
- Status verwendet `role=status`, Fehler `role=alert`; Detailüberschriften
  behalten eine nachvollziehbare Hierarchie.
- Escape leert eine geöffnete Detailauswahl, aber nicht die Filter.
- Fokus wird bei einer Aktualisierung nicht versetzt. Eine weiterhin vorhandene
  Auswahl bleibt nach Query-/Sortieränderung über ihre stabile ID erhalten.

### Fokussierte Prüfungen

- Quellenhash, Manifest und Attribution prüfen; vor Öffnen keine vollständige
  Statblockmaterialisierung. Beschädigte Daten zeigen einen konkreten Fehler;
  nach Behebung lädt derselbe Retry den gültigen Katalog.
- Paralleles Öffnen erzeugt eine sichtbare Katalogansicht. Debounce, verspätete
  Queries, Schnittmengenfilter, Paging, Auswahl, Fokus, Scroll, Enter/Escape,
  `aria-sort`, Status und Lizenzzugang erfüllen den gemeinsamen Providervertrag.
- Normales Schließen und frischer Prozess erhalten bestätigten Ansichtszustand;
  bewusstes Schließen der Ansicht und neue Anlage beginnen mit gültigen Defaults.
  Filter, Tabelle, Inspector und Lizenz bleiben auch in schmalen Ansichten erreichbar.
- Den tatsächlichen Zielhost prüfen. Alte Obsidian-, Gzip-/Base64- und main.js-
  Belege übertragen weder ihren PASS noch ihre Packaginglimits auf den neuen Kern.

### Offene Abnahme

CE-AC-01, CE-AC-02 und CE-AC-14 benötigen weiterhin den vollständigen
Produktlifecycle und die fehlenden physischen, Screenreader- und Plattformproben.
CE-AC-03 bis CE-AC-13 sind durch den Monsterkatalog nicht geliefert.

## Monster-Hostprüfung

**Datierter Befund vom 09.10.2026:** Der automatisierte H01-Scope auf
`aa6d92d6cb1d8c8e06a0a61233ad837d25e40c05` ist geprüft. Drei getrennte echte
Obsidianprozesse belegten Öffnen über die Befehlspalette, genau eine sichtbare
Ansicht bei überlappender Öffnung, Filter/Chips/Sortierung/Paging/Details,
Tastatur-/Fokus-/Scrollzustand, frische Wiederaufnahme und gültige Defaults nach
bewusster neuer Anlage. Die Größen 900×650 und 1150×700 waren ohne horizontalen
Hauptüberlauf bedienbar; normale Prozessenden sind gebunden.

Der beschädigte-Payload-Fall injizierte einmal ungültige Gzip-Bytes vor dem alten
Produktdecoder. Ein sichtbarer Fehler und Retry in derselben Ansicht bestanden
nach Rücknahme der Injektion. Das ist ein kontrollierter Hostfehlerfall, kein
Nachweis eines manipulierten Releasebundles. Die dabei gefundenen Timer- und
Restoredefaultfehler wurden behoben und regressionsgeprüft.

Exakter Build, Receipts und Grenzen stehen ausschließlich unter
`acceptance.json.saltMarcherCatalogEncounter.ce01H01`. Der
[historische Ablauf und die alten Buildpakete](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/68eab342b656b56b2d03e5e7228ecf56d37373b5/ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md)
bleiben im Gitstand verfügbar. Physische Tastatur/Maus, Screenreader und weitere
Plattformen wurden nicht geprüft; H01 schließt weder volle CE-01-Fachfreigabe
noch Encounterfunktion oder den neuen Zielhost ab.

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
`ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md`, die dokumentierten
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

CE-02-I01 liefert Bereichsdefinitionen, Workspace-State, Providerprojektionen und die gemeinsame read-only Oberfläche. Codecs, Queryadapter und deren DOM-/Fokusgrenzen folgen der [Gesamtgrundlage](ARCHITECTURE.md). I02 bis I05 ergänzen die tatsächlichen Datenprovider; Encounter-/Combat-/Scene-/Atlasmutationen gehören zu ihren Fachabläufen.

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

## Itemquellen und Provider

#### Aktuelle Quellenlieferung

Der vollständige S01-Quellenkandidat steht in [PR85](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/85); aktuelle Integration und Itemproduktabnahme stehen im Abnahmeregister. Quellenprüfung vergleicht vollständige Heading-zu-Heading-XML-Blöcke samt Prosa, Tabellenreihenfolge und Seitenfortsetzung.

Armor/Arrow (A–Z 10–13, Seiten 208–209) umfasst Resistenz-d10, Fluchtext und Slaying-Regeln. Entfernt wird ausschließlich der exakte SRD-Footer mit belegter Seitennummer, niemals eine Bodyregion nach Y-Koordinate. Getrennte kursive Wort-/Interpunktionsläufe erhalten fehlenden Grenzleerraum; echte Leerzeichen bleiben erhalten. Poppler-XML-Fixtures, verschobene/hohe Koordinaten, Footer-/Body-Adversarien und der echte PDF-Integrationstest prüfen diese Grenzen; 25.03-/25.07-Belege bleiben getrennt.

W24 ergänzt die gesamte Bags-Gruppe (A–Z 14–17, Seiten 209–211): Beans,
Devouring, Holding und Tricks. Alle zwölf d100-Effekte einschließlich `00`
und der seitenübergreifenden Eierregel sowie alle drei farbgebundenen
d8-Kreaturentabellen mit jeweils acht Zeilen bleiben vollständig erhalten.
Tabellenlabels und Würfelergebnisse bleiben den jeweiligen Zellen zugeordnet;
die drei Farben sind keine zusätzlichen Detailheadings oder erfundenen
Variantenrecords/Merges. Beans-Gewichtsformel und Holding-Kapazität bleiben
als vollständiger Quellwortlaut erhalten, nicht als erfundene numerische
Umrechnung. Die optionalen strukturierten Kosten-/Gewichts-/Kapazitätsfelder
werden in diesem Quellenabschnitt nicht ergänzt.

Der Verifier verwendet dieselbe inhaltliche Footer-/Quellwhitespace-Policy wie
W23-N01 und prüft jeden vollständigen Heading-Block einschließlich Tabellen,
Seitenübergängen und der nächsten Überschrift. Eine unveränderte echte
Poppler-25.03-XML-Ausgabe der drei kompletten Seiten mit Hash-/Lizenzreceipt
liegt unter `tests/fixtures/items-srd51-bags-poppler-25.03.*`; sie macht die
prüfentscheidenden Rohdaten offline zugänglich, behauptet aber keinen neuen
PDF-/GUI-Lauf. Negative Goldens erhalten auch bei unverändertem
Kreaturen-Multiset die Farb-/Würfelzuordnung. W24 wurde unabhängig auf
`42a69b63a69fbf310f1ba4eb4b7128cee2e5c700` geprüft
([Review 5480292230](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/56#pullrequestreview-5480292230))
und regulär auf Shared `843562ac256eb293f1b8c95f10077a9a7a7c1a1b`
integriert; kein Full-S01-/Produkt-/Host-PASS.

W25 liefert den vollständigen verbleibenden B-Abschnitt, A–Z 18–32, Bead of
Force bis Broom of Flying, physische/gedruckte Seiten 211–213. Alle Header,
Prosa, Aufzählungen, bedingten Regeln, Recharge-Angaben und der
seitenübergreifende Berserker-Fluch bleiben erhalten. Belt of Giant Strength
hat fünf physische Tabellenzeilen mit fünf ordinalgebundenen Raritätschoices;
die Quelle nennt sechs Varianten, fasst Stone/frost aber in einer Zeile
zusammen. Diese Zeile bleibt kombiniert; die sechs Varianten und ihr
unterschiedliches Aussehen/gleicher Effekt bleiben im vollständigen Fließtext.
Keine erfundenen zusätzlichen Occurrences, Records oder Merges. Header
`Weapon (any axe)` ergänzt das geschlossene Draft-v1-Subcategory-Enum um
`weapon`; es wird nicht unbelegt als einfache/martiale Einzelwaffe klassifiziert.
Gewicht, Kapazität und temperaturabhängige Regeln bleiben Quellenwortlaut,
keine erfundenen Kosten oder Einheitenumrechnungen.

`tools/items-srd51-b-section.mjs` vergleicht die vollständigen Blöcke bis zur
Folgeüberschrift, einschließlich Tabellenzelleneigentum und Seitenwechsel.
Originale drei vollständige Poppler-25.03-XML-Seiten samt Hash-/Lizenzreceipt
liegen unter `tests/fixtures/items-srd51-b-section-poppler-25.03.*`.
Negative Goldens schützen Variant-IDs/Rarität/Strength-Zellen, Fluchende,
Aufzählungen, echte Minuszeichen, Recharge und Bedingungsgrenzen. W25 ist
unabhängig auf `8772d950301b899c22f8bc4588e35bd2a5fe6dde` als PASS geprüft
([Chronik-Review 5480446444](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/64#pullrequestreview-5480446444))
und regulär auf Shared `ebb480eaac0c11640b843b4fa4297f541951d4ad` integriert
([Integrationsbeleg](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/64#issuecomment-6101348349)).
Das schließt weder Full-S01 noch ein Produkt-/Hostgate.

W26 ergänzt den vollständigen kohärenten C-Abschnitt A–Z 33–47, Candle of
Invocation bis Cubic Gate, physische/gedruckte Seiten 213–215: alle Header,
Prosa, Aufzählungen, bedingten Regeln und Seitenfortsetzungen. Die neun
Candle-Alignmentzeilen, vier Carpet-Zeilen (Größe/Kapazität/Geschwindigkeit),
sechs Cube-Faces mit Charges/Effekt und fünf Spell-/Item-Charge-Loss-Zeilen
behalten Reihenfolge und Zelleigentum. Der vollständige Table-Wortlaut bleibt
auch an seiner Position zwischen den Prosaabsätzen erhalten. Crystal Ball
bleibt eine Occurrence mit vier quellgeordneten Raritätschoices: typischer
Ball very-rare; Mind Reading, Telepathy und True Seeing legendary. Keine
erfundenen Unterheadings, Records oder Merges; alle variantenspezifischen
Regeln und Scrying-/Konzentrations-/Rechargegrenzen bleiben vollständige Prosa.

`tools/items-srd51-c-section.mjs` vergleicht komplette Headingblöcke einschließlich Tabellenposition und Seitenwechsel. Die drei ursprünglichen Poppler-25.03-XML-Seiten mit Hash-/Lizenzreceipt liegen unter `tests/fixtures/items-srd51-c-section-poppler-25.03.*`. Negative Goldens prüfen Table-/Variant-IDs, Rarität, Würfelbereiche, Kapazität, Charge-Loss, Textbedingungen und Aufzählungen. Korpuscount-Tests folgen der tatsächlichen Inventarlänge; ihre Quellenorakel bleiben unverändert.

W27 ergänzt den vollständigen D-Abschnitt A–Z48–62, Dagger of Venom bis
Dwarven Thrower, physische/gedruckte Seiten215–220. Alle Header und Prosa,
einschließlich Dancing-Sword-Seitenfortsetzung, Fluch, Recharge und
bedingtem Dwarf-Attunement bleiben vollständig. Deck of Illusions behält
33 physische Tabellenzeilen (Jokers(2) ist eine Zeile), Deck of Many Things
alle22 Tabellenzeilen, die13-vs22-Fußnote und sämtliche22 Kartenwirkungen.
Der vollständige eingebettete Avatar-of-Death-Statblock bleibt in der
Quellreihenfolge unter Skull, ohne zusätzliche Item-Occurrence oder Änderung
des Monsterkorpus. Dragon Scale Mail bewahrt zehn Drachen-/Resistenzzellen
und ihre fünf physischen gepaarten Zeilen. Karten-/Drachentypen sind keine
erfundenen Raritätsvarianten oder Detailheadings; optional strukturierte
Kosten/Gewicht/Kampfwerte werden nicht aus Prosa erfunden.

`tools/items-srd51-d-section.mjs` prüft vollständige Headingblöcke bis zur
Folgeüberschrift. Originale sechs vollständige Poppler25.03-XML-Seiten samt
Hash-/Lizenzreceipt liegen unter `tests/fixtures/items-srd51-d-section-poppler-25.03.*`.
Goldens schützen Karten-/Suit-/Resistenzzuordnung trotz gleicher Wertemengen,
Fußnote, alle Kartenregeln, Statblock, Einschränkungen und Quellinterpunktion.
W27 ist unabhängig geprüft
([Review5480792943](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/70#pullrequestreview-5480792943))
und regulär auf Shared7ba2bf4 integriert
([Integrationsbeleg](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/70#issuecomment-6102297681)).
Schema, Attribution, Produktcode und alte Quellen-/Verifiergoldens bleiben unverändert.

Der E-Abschnitt A–Z 63–70 (Efficient Quiver bis Eyes of the Eagle, Seiten 220–221) prüft Efreeti-d100 einschließlich `91–00`, vier Gem→Elemental-Zuordnungen und vollständige Sicht-/Recharge-/Windbedingungen; Eyes of Charming behält seine Seitenfortsetzung. Tabellen erzeugen keine zusätzlichen Itemidentitäten oder Raritätsvarianten. Quellen: `tests/fixtures/items-srd51-e-section-poppler-25.03.*` und `tools/items-srd51-e-section.mjs`.

Vollständigkeitsziel: 459 Occurrences (219 Ausrüstung + 239 A–Z + Orb), mit ausdrücklich belegten Merges statt Namensgleichheit; der Potion-of-Healing-Merge ist bereits bekannt. Der tatsächlich gelieferte Korpus und offene Abschnitte stehen ausschließlich im Quellenartefakt und `acceptance.json.saltMarcherCatalogEncounter`. Das vollständige Quellen-/Schema-/Provenienzpaket benötigt Prüfung vor Produktartefakt, Provider und UI.

`SRD51_SOURCE_PDF=/pfad/SRD_CC_v5.1.pdf node --test tests/items-srd51-source.test.mjs` aktiviert den vollständigen PDF-Test. Ohne PDF ist er skipped; Offline-XML ersetzt bei Quellenänderung keinen erneuten echten PDF-Lauf.

### Ziel und Grenze

`Items` wird der erste echte Bereich nach `Monster` in der vorhandenen
siebenfachen Katalog-Shell. Er liefert einen lokalen, nur lesbaren
2014-Referenzkatalog für Ausrüstung und magische Gegenstände. Maßgeblich sind
die [gemeinsamen Providerverträge](#gemeinsame-providerverträge) und SaltMarchers
`docs/items/requirements/requirements-items-catalog.md` sowie
`docs/items/domain/domain-items.md` am gepinnten SaltMarcher-Commit
`9de85c1a26f526acbc1af332ac5962e185c0aab2`. SaltMarchers
SQLite-/HTTP-Importvertrag beschreibt das beobachtbare Verhalten, erzwingt aber
keine SQLite- oder Laufzeit-Importarchitektur für dieses Plugin. Der Loot-Index
ist keine Item-Detailquelle.

### Gepinnte Quelle und Freigabe vor Datenübernahme

Die normative Inhaltsquelle ist Wizards of the Coast, *System Reference
Document 5.1*, die 2014er Fassung unter
<https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf>. Der am
9. Oktober 2026 abgerufene PDF-Byte-Hash ist
`2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0`
(SHA-256; 3.158.713 Bytes, 403 PDF-Seiten). Seite 1 nennt CC BY 4.0 und den
verlangten Attributionstext. `CE-02-I02-S01` kopiert genau den auf PDF-Seite 1
als Attribution Statement ausgewiesenen Wortlaut unverändert in das kanonische
Asset `src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md`. S01 prüft den
Wortlaut und Asset-Hash gegen PDF-Seite 1; erst I01 prüft seine Präsenz im
Build und im sichtbaren Inspector. Hinweise zur
Itemprojektion stehen getrennt davon; keine weitere Wizards-Attribution wird
angehängt. Keine 2024-/SRD-5.2-Daten.

`CE-02-I02-S01` ist ein eigenes, vor jeder Produktumsetzung abgeschlossenes
Provenienz-/Schema-Paket. Es legt `src/features/catalog/data/items-srd51-inventory.json`
mit genau einer Zeile je Ausrüstungs-Tabellenzeile, eigenständigem Magic-Item-
Tabelleneintrag und alphabetischem Magic-Item-Detailabschnitt an. Jede Zeile
trägt Abschnitt/Feed, erste und letzte physische PDF-Seite, sichtbare SRD-Seite,
Quellenüberschrift bzw. Tabellenkennung, Zeilen-/Abschnittsordinal,
Variantenkennung und explizite Merge-Referenz oder `null`. Das Manifest enthält
Abschnittsgrenzen und erwartete Counts für Ausrüstungstabellen, Magic-Item-
Tabellen und A–Z-Details sowie eine Summe vor und nach expliziten Merges.
Ein zweiter Prüfer vergleicht alle PDF-Seiten an den Abschnittsgrenzen und die
vollständige Zeilen-/Überschriftenfolge gegen das Inventar; Stichproben allein
reichen nicht. Er dokumentiert PDF-Hash, Inventarhash, Count-Abgleich und
Ausnahmen auf einem exakten Commit als `CE-02-I02-S01-R01 PASS` oder
`CHANGES REQUIRED`. S01 erstellt vor diesem Review auch das vollständige
Quelltranskript, das versionierte Schema und den PDF→Transkript-Beleg. Ohne
PASS entstehen weder generiertes Produktartefakt noch Provider oder UI; I01
beginnt nicht.

Ein 5e-bits-Datensatz darf als Extraktionshilfe dienen,
aber nicht ungeprüft zur zweiten Wahrheit werden: jede übernommene Tatsache
muss im SRD 5.1 verortbar sein. Nicht belegte oder außerhalb der SRD liegende
Einträge werden abgewiesen. Die 5e-bits-MIT-Lizenz für Repository-Code ersetzt
keine Prüfung der Inhaltslizenz.

### Quellprojektion und Schema

Das in S01 erstellte Inventar ist die Identitätsgrundlage des Quelltranskripts. Eine
Erscheinung erhält die ID `srd51:<equipment|magic-item>:<abschnitt>:<ordinal>`;
Abschnitt und Ordinal stammen ausschließlich aus der festgehaltenen physischen
PDF-Reihenfolge. Anzeigenamen, Slugs, Unicode und Interpunktion erzeugen keine
Identität. Für gleichnamige Varianten gibt es je eigener Tabellenzeile oder
Überschrift eine eigene Erscheinung und eine explizite Variantenkennung.
Eine Merge-Liste weist Tabellenerscheinungen und A–Z-Details per ID genau
einem kanonischen Eintrag zu; niemals durch automatisch gleichen Namen. Die
kanonische ID ist die erste Erscheinung in PDF-Reihenfolge. Mehrdeutigkeit,
Kollision, unbelegter Merge oder abweichende Fakten stoppen den Generator.
Ein abweichender SRD-Quellenstand erfordert neues Manifest und eigenen Review.

Das Transkript speichert je Fakt die Inventar-ID und PDF-Seite. Mechanische
Textextraktion normalisiert Unicode nach NFC, Ligaturen zu Buchstaben,
geschützte Leerzeichen zu normalen Leerzeichen und PDF-Zeilenumbrüche zu
Leerzeichen; echte Wortbindestriche und Zeichensetzung bleiben erhalten.
Weiche Trennstriche an Zeilenenden dürfen nur bei nachgewiesenem Umbruch
entfallen. Jede andere Korrektur steht als explizite Vorher-/Nachher-Zeile mit
PDF-Beleg im Transkript. `S01` legt die kontrollierten Kategorie-/Unterkategorie-
Werte und die Zuordnung jeder Quellentabelle fest. Golden-Fälle prüfen
Gleichnamigkeit, Varianten, Tabellen-/Detailmerge, Ligatur, Trennstrich,
Interpunktion und bytegleiche Projektion.

S01 legt den verbindlichen Vertrag als
`src/features/catalog/data/items-srd51-schema-v1.json` (JSON Schema Draft
2020-12, `schemaVersion: 1`) und das Transkript als
`src/features/catalog/data/items-srd51-transcript.json` ab. Der unabhängige
S01-Review bindet die SHA-256-Hashes von PDF, Inventar, Schema, Transkript und
Attribution sowie die Schema-Validierung sämtlicher Einträge. Das Schema
verbietet zusätzliche Felder und schließt Kategorie, Unterkategorie, Raritätswerte,
Einstimmung und Einheiten als Enums. Seine Mindestform ist:

- `id` und `name`: nichtleere NFC-Strings; `category`: `equipment` oder
  `magic-item`; `subcategory`: optionaler Wert aus einem in S01 durch das
  vollständige Inventar festgelegten, geschlossenen Enum samt Zuordnung jeder
  Quellentabelle; `magic`: Boolean; `rarity`: optionales diskriminiertes Objekt:
  `{kind: "fixed", value}` oder `{kind: "varies", sourceText, choices}`.
  `value` und jedes `choices[].value` gehören zum Enum `common`, `uncommon`,
  `rare`, `very-rare`, `legendary`, `artifact`. Eine Choice ist
  `{variantId, label, value, occurrenceId}` mit nichtleeren Strings und
  Inventarbeleg; `choices` ist geordnet und darf leer sein, wenn die Quelle
  zwar „rarity varies“ nennt, aber keine eindeutige Variante→Rarität-Zuordnung
  liefert. `sourceText` bewahrt dann den vollständigen Quellenwert;
- `attunement`: genau `required`, `not-required` oder `unspecified`;
- `cost`: optionales Objekt `{sourceText, copperPieces?}` mit nichtleerem
  Quelltext und nichtnegativem Safe-Integer in Kupferstücken. Umrechnung ist
  nur für eindeutige Einzelwerte zulässig: `cp=1`, `sp=10`, `ep=50`, `gp=100`,
  `pp=1000`; Bereiche, Formeln und unbezifferte Kosten behalten allein
  `sourceText`;
- `weight`: optionales Objekt `{sourceText, pounds?}`; `pounds` ist eine
  kanonische positive Dezimalzeichenfolge ohne Exponent, nur bei eindeutigem
  Quellenwert in Pfund; andere Einheiten bleiben allein `sourceText`;
- `properties`: geordnete Liste aus `{name, description?, occurrenceId}`;
  `description`: geordnete Liste aus `{text, occurrenceId}`. Alle Strings sind
  nichtleer und `occurrenceId` verweist auf genau eine Inventarerscheinung;
- `damage`: optional `{diceText, typeText, versatileDiceText?}` und `armor`:
  optional `{armorClassText, dexterityRuleText?, strengthRequirementText?,
  stealthRuleText?}`. Diese Felder sind ausdrücklich nichtleere,
  quellengetreue Textwerte, keine numerischen Kampfwerte. Fehlt ein Pflichttext,
  bleibt der strukturierte Teil weg und der Wortlaut in `description`;
- `source`: `{document: "SRD 5.1", pdfUrl, pdfPages, printedPages,
  occurrenceIds}` mit der gepinnten URL, nichtleeren geordneten
  Integer-Seitenlisten und existierenden Inventar-IDs. Der Generator prüft
  Seiten, Abschnitte und faktbezogene Erscheinungen gegen das Inventar.

Optionale fehlende Quellenfelder werden ausgelassen, nicht durch `null` oder
Nullwerte ersetzt. Insbesondere werden für magische
Gegenstände keine Preise, Gewichte oder Einstimmungen aus anderen Quellen
erfunden. `attunement` unterscheidet `required`, `not-required` und
`unspecified`: Bei einem vollständig geprüften Magic-Item-Header setzt die
`requires attunement`-Klausel `required`, ihr belegtes Fehlen `not-required`.
Bei unvollständigem/mehrdeutigem Header und nichtmagischer Ausrüstung gilt
`unspecified`; das ist kein behauptetes Nein. `S01` prüft positive, negative
und unklare Header als Golden-Fälle. Geldwerte werden ohne Rundung als
ganzzahlige kleinste Einheit
normalisiert; nicht eindeutig umrechenbare Quellwerte bleiben reine Anzeige
und nehmen am numerischen Kostenfilter nicht teil. Sortierung behandelt fehlende
Werte deterministisch am Ende, unabhängig von der Richtung. Für Rarität gilt:
ein konkreter Filterwert trifft `fixed.value` oder eine belegte
`varies.choices[].value`; ein eigener Filterwert `varies` trifft alle
variablen Einträge. Die Sortierung ordnet feste Raritäten nach der genannten
Enum-Reihenfolge, dann `varies`, dann fehlende Werte; Richtung kehrt nur die
festen Raritätswerte um, fehlende bleiben am Ende. Der Inspector zeigt bei
`varies` den `sourceText` und jede belegte Choice; er macht keine einzelne
Rarität für den gesamten Eintrag geltend. Ein Variantenschlüssel ist
`<occurrenceId>#variant:<ordinal>` mit dem Ordinal der Variantenfolge im
gepinnten PDF, unabhängig von Label oder Slug. S01-Golden-Fälle decken
mindestens `rarity varies` und einen kombinierten `+1/+2/+3`-Header vollständig
von Inventar über Transkript und Schema bis zur Filter-/Inspector-Projektion
ab. Der Inspector
kennzeichnet fehlende Fakten, statt sie mit Nullwerten zu verwechseln.

### Reproduzierbarer Build und Fail-closed-Lader

Ein enger Generator unter `tools/` liest ausschließlich das reviewte Inventar,
Quelltranskript und Manifest mit PDF-URL/-SHA-256, Inventarhash,
Schema-Version, Lizenz und Attribution. Er benötigt keinen Netzwerkzugriff.
Ein separater Quellen-Verify-Lauf lädt die PDF in den QA-Cache, prüft ihren
Hash und vergleicht die vollständige Seiten-/Zeilen-/Überschriftenfolge mit
dem Inventar und den Transkriptbelegen. Er liefert den unabhängigen
PDF→Transkript-Vollständigkeitsbeleg. Der Offline-Generator validiert jede
Inventar-ID, jede Faktquelle, eindeutige Schlüssel, alle Merge-Regeln und
Counts, serialisiert in fester Ordnung und schreibt ein Artefakt samt SHA-256.
Wiederholung muss bytegleich sein. `npm run build` prüft das eingecheckte
Artefakt gegen Manifest und generierte Bytes, ohne die PDF erneut aus dem Netz
zu holen; der getrennte Quellen-Verify-Lauf ist Pflichtgate von S01 und jeder
Quelländerung. Quell-PDF und große Protokolle liegen im QA-Cache.

Der Runtime-Lader prüft Schema-Version, Manifest/Artefakt-Hash und Struktur vor
der ersten Veröffentlichung des gesamten Korpus. Die Daten werden erst nach
vollständiger Prüfung als ein unveränderlicher Snapshot sichtbar. Fehler geben
keine Teilmenge oder veraltete Detailantwort als aktuelle Wahrheit aus:

- fehlendes Asset bzw. noch kein vollständiger Import: `unavailable`;
- neuere/andere Schema-Version: `incompatible`;
- Hashabweichung, ungültiger Datensatz, Duplikat oder indizierter Datensatz
  ohne versprochenes Detail:
  `corrupt`;
- ungültige Filter-/Pagingwerte: `invalid`;
- Laufzeit-/Ladefehler: `error` mit isoliertem Retry.

Diese Fehler betreffen nur `items`. `creatures` und die fünf weiterhin
`unavailable`-Provider behalten ihren Zustand. Kein Katalogklick startet
Netzwerk, Import, Vaultwrite, Loot-, Inventory- oder Encounter-Mutation.

### Provider und sichtbares Verhalten

`I01` erweitert den vorhandenen Providervertrag ausdrücklich: Capability
behält `available|missing|unavailable`; Query erhält neben `ready|empty|
invalid|missing|unavailable|error` die Status `incompatible|corrupt`; Detail
erhält neben `ready|missing|unavailable|error` ebenfalls `incompatible|corrupt`.
Loader-Schemafehler gehen auf beide `incompatible`, Integritätsfehler auf
`corrupt`; ungültige Query auf `invalid`. Eine unbekannte oder inzwischen
entfernte Detail-ID ist `missing`, ein im geprüften Index gelisteter Eintrag
ohne Detail ist `corrupt`. Nur `error` und nach erneuter lokaler Validierung
`corrupt` bieten Retry; `incompatible` verlangt einen passenden Build und
`missing` eine neue Auswahl. Registry, Shellstatus, Itemansichten und Tests
erhalten diese Union gemeinsam; Monsterverhalten bleibt unverändert. Ein
fehlgeschlagener Refresh entwertet den aktuellen Item-Snapshot, sodass Retry
oder spätere Query keine alte Liste als aktuellen Erfolg ausgeben.

Der Itemprovider implementiert diesen CE-02-read-only-Vertrag mit
immutable Row-/Detail-DTOs, begrenzter Ergebnispage und `AbortSignal`.
Stabile IDs werden auch in Auswahl und Wiederherstellung genutzt. Query und
Detail verwenden denselben geprüften Snapshot. Generations-/Abortschutz der
Shell verhindert, dass verspätete Itemantworten nach Suche oder Bereichswechsel
einen anderen Bereich überschreiben.

Die Items-Oberfläche nutzt den gemeinsamen 200-ms-Draft-/Enter-Flush-,
Chip-/Reset-, Sortier-, Paging-, Tastatur- und Inspector-Pfad. Filter sind Name,
Kategorie, Unterkategorie, Rarität, Magiestatus, Einstimmung und Kostenbereich;
Sortierung ist Name, Kategorie, Rarität und Kosten, jeweils mit stabiler
ID-Nachordnung. Rarität und Kosten zeigen fehlende Werte offen an; der
Kostenbereich matcht nur tatsächlich bezifferte Kosten. Auswahl zeigt
Beschreibung, Eigenschaften, Kosten, Gewicht, Rarität, Einstimmung,
Schadens-/Rüstungsfakten soweit vorhanden, Quellenstellen und Attribution.
Es gibt explizite Loading-, Empty-, Invalid-, Unavailable-, Incompatible-,
Corrupt- und Error-/Retry-Ansichten, ohne verdeckte Produkt-Placeholder.

Die Workspace-Schemaversion steigt von `1` auf `2`. Die v1→v2-Migration
übernimmt `activeSection` und Monster sowie die fünf anderen Section-States
werttreu durch ihre bisherigen Restorer. Beim bisherigen Item-Placeholder
übernimmt sie `search`, `searchDraft`, `direction`, `page`, `selectedId` und
beide Scrollpositionen; `filters: []` wird zum leeren typisierten Itemfilter,
`sort: name` bleibt erhalten. Neue Item-Filter und Sortierfelder beginnen mit
Defaults. Nur beschädigte Itemwerte werden auf Itemdefaults normalisiert.
Unbekannte künftige Workspaceversionen bleiben wie bisher insgesamt
fail-closed. Der real typisierte Itemzustand hält eigenen Draft/angewandte
Suche, Filter, Sortierung, Seite, Auswahl und beide Scrollpositionen. Tests
prüfen v1→v2, beschädigtes Item bei intaktem Monster, unbekannte Zukunft,
Item→Monster→Item und frischen Prozess-Restore.

### Aktueller Desktopanschluss und nächste Abnahmen (16.10.2026)

Der vorstehende gemeinsame Provider-/Shellvertrag ist Zielplanung. Der Desktop
verwendet heute `app/items-ui.ts`, `storage/item-definitions.ts` und
`storage/srd-items.ts`; er besitzt noch keinen vollständigen CE-02-Itemsbereich.
Sein kombinierter Gegenstands-/Shoparbeitsbereich bietet lokale Referenzdetails,
getrennt aufgeklappte eigene Definitionen und ausdrückliche Vergabe-/Shopaktionen.
Das ist kein Beleg für den read-only SharedCatalogvertrag oder einen vollständigen
SRD-Korpus. Die vorhandenen Quellen-/Importbelege bleiben separat erforderlich.

Die Referenzliste und eine ausdrücklich übergebene Item-ID starten nach dem
bestehenden Entwurfsdrain unabhängig von Vorbereitung, Fortschritt und Live-Szene.
Eine wartende oder fehlgeschlagene Nebenabfrage blockiert keinen gesunden lokalen
Itemreader. Vergabe-/Shopkontext bleibt bis zu einem erfolgreichen Read gesperrt;
ein Fehler steht lokal mit ausdrücklichem Retry, alte Empfänger oder Shopdaten
erhalten keine neue Schreibautorität. Wiederholung erhält Suchtext und aktuelle
Referenz. Kampagnen-/Requestwechsel sowie widerrufene externe Übergaben entziehen
späten Antworten Autorität. Die bestehenden Commit-/Detailguards und kanonischen
Writer bleiben zuständig; keine Schemaänderung oder importierte Mutation.

Suchtext, Filter und Sortierung aktualisieren die vorhandene Itemliste nach
200ms Eingabepause. Neue Eingaben entziehen alten Queryantworten sofort ihre
Gültigkeit und leeren die alten Ergebnisaktionen. Submit startet unmittelbar;
Submit, Reset und Aktivierung verwerfen den alten Timer. Paging wird erst mit
einer erfolgreichen Trefferseite wieder freigegeben; nach Fehlern startet
Submit von Seite1. Die unabhängig gelesene Referenz und offene Definitionen
bleiben dabei erhalten. Store-/DOMgegenproben sowie ein nativer Leselauf mit
echtem SRD prüfen Tippen, Enter, Filter, verspätete Antworten, Seitenfehler und
Recovery. Quellen-, Versions-, Tabellen- und Encounterdaten bleiben unverändert.

Nächste Lieferungen verwenden diese vorhandenen Reader statt eines zweiten
Itembestands: Zuerst Items als read-only Bereich nach Monster anschließen und
Definitionen, Vergabe sowie Shops über ausdrückliche Übergaben erreichen.
Danach `ItemQuery`/Reader/Controls gemeinsam um Unterkategorie und Kostenbereich
sowie Kategorie-/Raritätssortierung ergänzen; unbekannte Werte bleiben unbekannt,
und vorhandene IDs, Ledger-/Shopreferenzen und historische Revisionen erhalten.
Korpus-/Schemafehler gegenüber fehlendem Import unterscheiden und ausschließlich
Items sperren. Migration betrifft bei späterem Workspaceanschluss den oben
beschriebenen Suchzustand; für diesen Entkopplungsschritt gibt es keine Migration.
Abnahmen: offline Quelle+Detail, alle Filter/Sort/Paging mit realem Korpus,
Item→Monster→Item samt Auswahl, Nebenquelle langsam/fehlerhaft plus Retry,
unveränderte Encounter-/Ledger-/Shoptruth sowie native Tastatur/Fokus und200%.

`desktop-item-selection.test.mjs` prüft mit echtem Store und kontrollierten DOMreads
alle drei wartenden Nebenquellen, Result-/Transportfehler, Retry, alte Aktivierung
und widerrufene Detailübergabe. Shopwechsel-/Rewardtests sichern die angrenzenden
Aktionen. Diese lokalen Belege ersetzen weder die vollständige Korpus-/Quellen-
noch SharedCatalog-, Plattform- oder Produktabnahme.

### Lieferbestand und Prüfanforderungen

`CE-02-I02-S01` besitzt Inventar, Identitäts-/Merge-Ledger, vollständiges
Quelltranskript, `items-srd51-schema-v1.json`, Kategoriezuordnung, kanonische
Attribution, PDF→Transkript-Quellen-Verify und Golden-Fälle, aber noch kein
generiertes Produktartefakt, keinen Provider und keine UI. Ein unabhängiger
Prüfer muss S01 auf einem exakten Commit mit vollständigem Count-, Schema- und
Hashbeleg freigeben.

`CE-02-I02-I01` besitzt erst danach neue Itemdaten-, Generator-, Manifest-,
Attributions-,
Provider- und Item-View-Dateien unter `src/features/catalog/` und `tools/`,
gezielte Item-Deskriptor-/State-Ergänzungen in der bestehenden Katalog-Shell,
passende Tests und nur nötige Katalog-CSS. Monsterdaten, die fünf anderen
Provider, Encounter-/World-Planner-Owner, Atlas, Dungeon und Vaulttexte bleiben
außerhalb dieses Pakets. Ein verändertes Bundlebudget wird nur anhand gemessener
Buildgröße, Lazy-Load und echtem Hostverhalten entschieden.

Quellenübernahme und Produktaktivierung benötigen reproduzierbare Daten-/Provider-/DOMprüfungen, Typprüfung und Build. Pflichtfälle sind: Source-Hash und
Attribution; Korpusvollständigkeit und bytegleiche Regeneration; doppelte
Schlüssel und widersprüchliche Feldquellen; fehlende optionale Werte;
deterministische Filter/Sortierung/Paging; Auswahl und Inspector; sämtliche
Fehlerzustände und Retry; Abort-/Stale-Antwort; Bereichs-/Neustartzustand;
kein Netzwerk oder Ownerwrite beim Browsing. Der I02-Review bindet sauberen
Quell-SHA, bytegleiche installierte `main.js`/`manifest.json`/`styles.css` und
einen echten isolierten Obsidian-Hostlauf. Sichtbar geprüft werden bei
900×650 und 1150×700 Itemfilter, Chips/Reset, Sortierung, Paging, Auswahl,
Inspector, Attribution und fehlende optionale Felder. Ein Bereichswechsel
während einer ausstehenden Query darf Item/Monster nicht überschreiben;
beide Zustände müssen unabhängig durch Wechsel und frischen Prozess erhalten
bleiben. Der Prozess endet normal. Corrupt/Incompatible/Error/Retry werden
zusätzlich mit deterministischen Fixture-/Harness-Gates geprüft. Automatisierte
Hostbelege werden nicht als physische Tastatur-/Maus-, Screenreader- oder
Plattformabnahme ausgegeben. CE-02-H01 wiederholt die gemeinsame Prüfung nach
allen sieben Providern.

Eine Itemfreigabe schließt weder die fünf anderen Provider noch CE-02, CE-01-
Physikeingabe, Screenreader oder weitere Plattformen. Diese Gates bleiben
ausdrücklich offen.

## Laufzeit: gemeinsame Auswahl vorhandener Szenengruppen

Die [gebundene Encounter-Anforderung](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/encounter/requirements/requirements-encounter.md)
ist für den Laufzeitweg maßgeblich. Die Begegnungsvorbereitung zeigt die aktive,
der fokussierten Szene zugewiesene Party und die vorhandenen Gruppen am Szenenort
oder übernommenen Besuch. Häkchen berechnen unmittelbar Gegnerzahl, Basis-XP,
Monsterzahlmultiplikator, angepasste XP, vier Party-Schwellen und die semantische
Schwierigkeit. Fehlende Level bleiben unbekannt. Bewertung und Auswahl schreiben
weder Gruppen noch Kampfstand. Leere oder nicht verfügbare Gruppen bleiben mit
Grund gesperrt; ohne zugewiesene Party oder Gegner gibt es keine Übernahme.

„Auswahl in Initiative übernehmen“ übergibt alle ausgewählten Gruppen gemeinsam
an den vorhandenen Combat-Writer. Fokus-/Roster-/Szenenmitgliedschaft, Party-XP
und vollständige Gruppen-/NPC-Basis werden vor Mutation geprüft. Fremde oder
veraltete Auswahlen erzeugen keinen Teilkampf. Die vorhandenen Weltfiguren werden
mit ihren aktuellen HP und Zuständen verknüpft; die bestehende Presetregel
bestimmt Mob-/Individualpartitionen. Gruppen-IDs, Revisionen und Namen bleiben
als Herkunft im bestehenden Kampf-Record erhalten. Es entsteht keine neue Gruppe,
Vorlage, parallele Roster oder Tabelle. Die bisherigen Receipts schützen Replay.
Die frühere leere Anlageform wird in diesem primären Laufzeitweg nicht mehr
angeboten; gespeicherte Altstände bleiben lesbar.

Gezielte Store-/DOMfälle prüfen zwei Gruppen, inaktive PCs außerhalb der Basis,
sofortige Bewertung ohne Schreibwirkung, stale Gruppen/XP, fremde und leere
Auswahl, Replay und Fresh. Der native Electron-Ablauf wählt beide Gruppen,
übernimmt sie, trägt Initiative ein, beginnt den Kampf, wechselt den Zug und
verursacht Schaden. Der Welt-NPC besitzt danach dieselben HP; nach regulärem
Neustart bleiben Quellen, Teilnehmer, Runde und Zug erhalten. XP, Rastbudgets,
Partyzuordnung und Szenenuhr werden durch diesen Ablauf nicht verändert.

Dieser Anschluss erledigt nicht die gesamte Encounter-Abnahme: Der globale
Encounter/Reise-Wähler, die vollständige Umstellung bisheriger Direktwege aus
Vorlage/Katalog/Generator und sofortiger Abgleich sämtlicher Gruppenstruktur-
änderungen bleiben offen. Die bestehende Health-/Membership-Reconciliation und
Verstärkung werden weiterverwendet; ihre Grenzen werden dadurch nicht erweitert.
Native Belege dieses Ablaufs ersetzen keine OS-, Accessibility- oder vollständige
ursprüngliche Runtime-Abnahme.
