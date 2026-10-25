# SaltMarcher-Katalog- und Encounter-Migration

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: catalog
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Abschnitte: [Monsterkatalog](catalog-encounters-2.md#monsterkatalog) · [Monster-Hostprüfung](catalog-encounters-2.md#monster-hostprüfung) · [Gemeinsame Providerverträge](catalog-encounters-3.md#gemeinsame-providerverträge) · [Itemquellen und Provider](catalog-encounters-4.md#itemquellen-und-provider)

Stand: 10. Oktober 2026. Dieser Plan überführt die Katalog- und Encounter-
Funktionen aus `ThonkTank/Salt-Marcher` in das Obsidian-Plugin. SaltMarcher ist
die Implementierungs- und Verhaltensquelle; die vergleichbaren aktuellen
D&D-Beyond-Abläufe bilden die Mindestabnahme. Der bestehende Dungeon-, Hex- und
Stadtstand bleibt erhalten.

## Technischer Anschluss vom 11.10.2026

[ARCHITECTURE](../../project/architecture/overview.md) ersetzt alte Host-/Persistenzvorschriften:
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
- `src/legacy/obsidian/renderer/features/catalog/`
- `src/legacy/obsidian/renderer/features/encounter/`

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
  Campaign/Data ([Campaign-Datenvertrag](../../campaign/contract/archive.md)) bestätigen, keine zweite Campaignregistry.
  Kampagnenkennung und gelesene Registry bilden einen gemeinsamen bestätigten
  Kontext. Beim Wechsel bleibt bis zum erfolgreichen Read die bisherige Kombination
  sichtbar; der angeforderte Wechsel ist als ladend markiert. Ein fehlgeschlagener
  Kontextwechsel erhält die bisherige Auswahl und
  den offenen Vorgabenentwurf; er zeigt keine alte Zuweisung für die neue Campaign.
  Beim Öffnen beginnen Kopfwerte und Formular dagegen ohne früheren Quellstand:
  zuerst ladend, bei Readfehler ausdrücklich nicht verfügbar. Frühere Formularwerte
  werden nicht als gültige Vorgaben angeboten. Speichern/Zuweisen
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
  Quelle: Encounter Generation „Combat Consumption“, [Katalog-/Encountervertrag](catalog-encounters.md); [LiveScene-Vertrag](../../runtime/contract/smr03-live-scene-contract.md), SMR-AC-06.

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


Weitere Fachabschnitte: [Teil 2](catalog-encounters-2.md) · [Teil 3](catalog-encounters-3.md) · [Teil 4](catalog-encounters-4.md) · [Teil 5](catalog-encounters-5.md)
