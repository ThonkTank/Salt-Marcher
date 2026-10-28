# Encounter-Vorlagen, Tabellen und Generierung

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Quellen: [Katalog-/Encountervertrag](../../catalog/requirements/catalog-encounters.md),
[Original Encounter Generation](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/encounter/requirements/requirements-encounter-generation.md)
und die gepinnte `requirements-encountertable.md`. Lesen/Filtern:
[Katalogsuchvertrag](catalog-browsing.md#aktueller-suchvertrag); Kampfstart und
Liveübergabe: [Kampf-Recovery](combat-recovery.md).

## Code und Prüfwege

| Anliegen | Besitzer / vorhandene Prüfung |
| --- | --- |
| Vorlagen und Planungsparty | [catalog-ui.ts](../../../src/app/catalog/catalog-ui.ts), [generation-ui.ts](../../../src/app/campaign/generation-ui.ts); [Generierungskontext (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/campaign/desktop-generation-context.test.mjs) |
| Tabellen, Loot, Presets und Weltquellen | [generation-ui.ts](../../../src/app/campaign/generation-ui.ts), [world-source-ui.ts](../../../src/app/campaign/world-source-ui.ts), [storage/generation.ts](../../../src/app/storage/generation.ts); [Gewichte/Save (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/campaign/desktop-table-weights.test.mjs), [Scope](../../../tests/catalog/desktop-table-scope.test.mjs), [Weltquellen-UI (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/campaign/desktop-world-source-ui.test.mjs) |
| Bestehende Vorlage auffüllen | [GenerationRequest/Run](../../../src/app/campaign/generation-contracts.ts), [Selector](../../../src/app/campaign/generation/selector.ts) und bestehender Vorlagenwriter; [Füll-/Transferfälle](../../../tests/catalog/desktop-generation-fill.test.mjs) |
| Verknüpfte Beute reproduzieren und buchen | `lootItems` in [storage/generation.ts](../../../src/app/storage/generation.ts) berechnet Sessionvorschau und gebuchten Wurf; [Seeds, Gruppierung und Receipts](../../../tests/campaign/desktop-generation-loot.test.mjs) |
| Generierung bis zum Folgeabend durchspielen | [Native Bedienprobe](../../../tools/test-desktop-generation-preparation.mjs): gemischte Level, thematische Tabelle, verknüpfte Beute, angepasste Vorlage, Appneustart, veränderte aktuelle Party, Kampfabschluss und erneutes Öffnen; Vorbereitung, Quellenredaktion, Wiederöffnen aus der Vorschauhistorie und aktueller Gruppenstand beim Kampf |

Vorhandene Store-/DOM- und native Einzelläufe qualifizieren ihre geprüften Fälle,
keine vollständige Encounter-, 100 %-, Plattform- oder unbekannte-Write-Abnahme.
Kontrollierter Nachreadfehler, abgewiesener SQLitewrite, verlorene Antwort und
vollständiger Appneustart bleiben verschiedene Belege.

## Gebundene Katalogquellen und historische Verwendung

Die wiederverwendbare `encounter_plan`-Definition und ihr Receipt speichern
`StoredEncounterPlan`: `sources` enthält ausschließlich `CatalogReference`
mit `sourceId`, `sourceVersion`, `sourceHash`, `entryId` und `entryType`.
Geplante Gegenstände stehen mit eigener lokaler Zeilenkennung, Menge und
derselben Referenz in `items`. Creature- und Itemkörper gehören nicht in diese
Definition. Die aufgelöste `EncounterPlan`-Ansicht liefert `sources` und
`resolvedItems` getrennt; der Writer übernimmt diese Anzeigekörper nicht.

Der Kreaturanschluss bindet den vorhandenen SRD-5.1-Katalog einschließlich
XP-Korrekturen und Reaktionsergänzungen an seinen effektiven SHA-256.
Gegenstandsquellen benutzen die bereits vorhandenen unveränderlichen
`item_definition_version`-Stände. Hier besitzt jede Definition eine stabile
Quellenidentität unter `srd-5.1-items/<globale ID>` beziehungsweise
`authored-items/<globale ID>`, ihre Revision und den SHA-256 des kanonischen
Definitionsstands. Das führt keinen weiteren Gesamtkorpus ein.

`storage/catalog-references.ts` löst diese Bindungen am kanonischen Speicher auf.
Fehlende und unbekannte Quellen, ein nicht installierter Versions-/Hashstand,
eine beschädigte oder nicht verfügbare Quelle und ein fehlender beziehungsweise
falscher Eintragstyp bleiben unterscheidbare Fehler. Kein Name ersetzt eine
fehlende Bindung. Neue Autorenentwürfe können beim ersten Save vom kanonischen
Katalog gebunden werden; bestehende Definitionen müssen ihre Bindungen mitsenden.

Raum-Keyverweise tragen dieselbe Referenz. Der Keywriter prüft sie und lokale
Encounter-/Notiz-/Orts-/Planbindungen vor Veröffentlichung. Die Keyanzeige liest
Katalognamen über den vorhandenen eingeschränkten Preloadanschluss; ein Fehler
ersetzt dort den früheren Katalognamen. Eine betroffene Übernahme scheitert ohne
Teil-Key, History- oder Receiptänderung. Andere Quellen und Atlasarbeit bleiben
unabhängig nutzbar.

Bewertung, Auffüllbasis, Gruppenanlage und Kampfvorbereitung lesen die Vorlage
über diesen Anschluss. Generierungsergebnisse, vorbereitete Gruppen und
Kampfausgänge behalten dagegen ihre tatsächlich verwendeten eingefrorenen
Fakten. Eine spätere Definitionsänderung berechnet sie nicht neu. Bestehende
explizite historische Item-Aliase bleiben Speicherzuordnungen; sie werden nicht
über Namen oder eine Suche nach ähnlichen Definitionen ersetzt.

Transferdeklarationen und generierte Speicherformen besitzen dieselben Felder.
Globale Quellen-/Eintragsbindungen bleiben erhalten, lokale Plan-, Itemzeilen-,
Raum-, Block- und Abschnittskennungen werden umgeschrieben. Die gemeinsame
E2E-01-Fixture und `tests/campaign/desktop-e2e01-fixture.test.mjs` prüfen
Creature-/Itemauflösung, Fresh, unveränderte historische Itemverwendung nach
Definitionsänderung, Complete-Import und Neustart sowie Complete-Import aus
einem vorher eingefrorenen Quelleninventar, fehlende
Zuordnungen und fremde lokale Verweise. `tests/catalog/desktop-catalog-xp.test.mjs`
prüft eingefrorene Gruppenfakten bei aktuellem gebundenem Katalog und ihren
unveränderten Erhalt über Complete-Import und Neustart. Diese
technischen Belege ersetzen keine Ownerabnahme.

## Gespeicherte Vorbereitung aus einer früheren Vorschau öffnen

Die erste Übernahme bleibt ein revisionierter Writer: `acceptGeneration` prüft
Füllbasis, NPCs, Weltquellen, Tabellen, wirksames Preset und Katalog, bevor genau
eine neue Vorlage entsteht. Die bestätigte Zuordnung gehört zu
`generation_acceptance`; der unveränderte Run bleibt die Herkunft.

Nach der Übernahme ist die Vorlage eigenständig bearbeitbar. „Gespeicherte
Vorlage öffnen“ liest deshalb über den vorhandenen `encounterPlan`-Port ihren
aktuellen Stand. Geänderte Generatorfilter, Planungseingaben oder Quellen sperren
weiterhin neue Übernahmen, aber nicht diesen Read. Antwort-ID, Workspace und
offene Vorschau bleiben gebunden; ein Lesefehler steht am Generator und kann
read-only erneut gelesen werden. Kann der bestehende Autorenentwurf vor dem
Wechsel nicht gespeichert werden, bleibt er offen; der Generator meldet die
Blockade statt fälschlich eine geöffnete Vorlage zu bestätigen.
Der offene Autorenentwurf wird vor dem Read gespeichert. Entstehen während des
Reads neue Eingaben derselben Vorlage, speichert die Übergabe sie ebenfalls und
behält die neuere bestätigte Revision statt die ältere Leseantwort anzuzeigen.
Auch der gemeinsame Übernahmepfad löst eine
bestehende Zuordnung vor aktuellen Quellenprüfungen auf. Originalreceipts bleiben
unverändert und geben bei exakt demselben Auftrag ihren ursprünglichen Stand
zurück; bewusstes Öffnen liest spätere Autorenänderungen.

Davor führte der Öffnen-Button erneut den Writer aus und scheiterte etwa nach
Redaktion einer Encounter-Tabelle oder Füllbasis, obwohl die gespeicherte Vorlage
unverändert verfügbar war. Kein neues Format, keine Migration oder zweite
Schreibgrenze ist nötig. Store-/DOM-Gegenfälle prüfen aktuelle Prosa, archivierte
Tabelle, geänderte Füllbasis, unveränderte Run-/Receiptbytes, unübernommene
Geschwistervorschläge, Lesefehler/Retry, blockierten Autorenwechsel, Antwortidentität und Campaignwechsel.
Ein vollständiger Storeablauf öffnet die Vorbereitung, führt sie mit zwei
aktuellen statt den drei geplanten Figuren unterschiedlicher Level durch und liest nach Fresh das
abgeschlossene Ergebnis samt unveränderter Vorbereitung.

Die native Probe redigiert nach dem ersten App-Exit die Quelltabelle und öffnet
die frühere Vorbereitung über die Vorschauhistorie vor dem Kampf. Sie setzt nun
wirklichen Browserzoom auf 1. Ein Geräteskalierungsfaktor allein ist kein
Nachweis des Anwendungszooms. Alte Erfolgsdateien
werden vor dem Lauf entfernt; Prozessausgänge und Runtimehashes bleiben eigene
Belege. Ein fehlgeschlagener nativer Lauf schließt weder Bedienung noch 100 % ab.

## Planungsparty zwischen Vorlage und Generator bearbeiten

„Aktuelle Party übernehmen“ ersetzt ausdrücklich den Planungssnapshot und lässt
den Partyeditor sichtbar. „Zur Planungsparty“ öffnet ihn vor dem Fokus auf das
erste Feld; bei leerer Party führt der Fokus zur Zeilenanlage. Ohne geöffnete
Vorlage öffnet der Rücksprung die Vorlagenliste und fokussiert deren Anlage.
Das Ziel wird sichtbar gescrollt; der Generator bleibt nach Partyübernahme
zugänglich. Das ändert weder Scenemitgliedschaft noch den unabhängigen
Planungssnapshot beim Kampfstart.

## Begegnungstabellen: bestätigter Save und nachgelagerte Anzeige

Die Generationtransaktion ist der Writer; Auswahl bleibt read-only, bestehender
Scope erhalten. Neue und geänderte Begegnungsgewichte folgen dem ursprünglichen Ganzzahlbereich
1..10. Dialog und Store-Worker verwenden dieselbe Regel; unveränderte Altgewichte
bleiben pro Kreatur und Tabellenrevision exakt erhalten. Lesen, Vorschläge und
Archive unterstützen diese Altgewichte weiter, ohne Migration oder Rundung.
Beutegewichte bleiben unabhängig davon exakte Dezimalzahlen.

`executeGeneration` bestätigt Tabellen-/Loot-/Presetresultat im Receipt. Dieses
Resultat gilt sofort: ein nachfolgender `generationSources`-Fehler macht daraus
keinen fehlgeschlagenen Save. Der Manager schließt nach bestätigtem Write;
Übersicht und nächster Edit verwenden die neue Revision. „Änderung bestätigt“
mit explizitem Aktualisieren bleibt auch im Tabellenbereich bis zum erfolgreichen
Refresh sichtbar. Freie Weltquellenprosa, Factionentwürfe und Revisionschecks bleiben
erhalten; kein alter Save wird wiederholt. Ein abgewiesener Write lässt dagegen
den Entwurf offen. Ein langsamer Nachread blockiert derzeit noch den UIauftrag;
das ist keine Klärung eines unbekannten Schreibausgangs.

Fraktions-/Ortsquelleneditoren teilen Escape/Abbrechen und `generation-discard`.
Dirtyprüfung vergleicht rohe Controls samt Checkboxen: auch `02` statt `2` ist
Eingabe. Weiterbearbeiten erhält Inputs/Basis, Verwerfen schließt ohne Write.
Während `source-save` bleiben Editor und Rohwerte auch bei Escape erhalten,
Doppelsubmit ist gesperrt. Erst bestätigter Save schließt seinen Editor;
Campaignreset entwertet alte Save-/Discardcallbacks. Keine neue Entwurfspersistenz
oder zweite Schreibgrenze. Fraktionshaupttabellen gehören nur in deren Selector;
Ortscheckboxen zeigen nur ortseigene Tabellen.

## Verschachtelte Tabellenanlage aus einer Fraktion

„Neue Haupttabelle anlegen“ öffnet denselben Tabellenmanager über dem montierten
Fraktionsentwurf. Nur das oberste Modal ist interaktiv. Neuanlage startet im
Campaignscope, Installation ist ausdrücklich wählbar. Cancel/Discard kehrt ohne
Änderung und mit Fokus zum Auslöser zurück. Bestätigter Save gibt genau seinen
Receiptrecord auch bei defektem Nachread zurück; Contextreset entwertet die Auswahl.

Nur Haupttabellenwahl und abhängige Bestände ändern sich: gemeinsame Kreaturen
behalten Limits einschließlich Rohtext, entfernte verlieren Limits, neue bleiben
unbegrenzt. Haltung und andere offene Felder bleiben erhalten. Die neue Tabelle
ist bereits eigenständig bestätigt; erst „Quellen speichern“ bindet sie mit der
ursprünglichen Fraktionsrevision. Fraktionsdiscard oder abgewiesene Fraktionsbasis
löscht die Tabelle nicht und ändert ihren Scope nicht. Kein impliziter
Fraktionswrite oder kopierter Tabellenbestand.

## Bestehende Encounter-Vorlage auffüllen

„Aktuelle Vorlage auffüllen“ verwendet eine gespeicherte Vorlage mit Planungsparty
als feste additive Basis. Die Quelle bleibt unverändert. `GenerationRequest.fillPlan`
bindet ID/Revision, `GenerationRun.fixedRoster` den historischen Gesamtstand.
Vorschau und Übernahme trennen feste Basis, beibehaltene Gegner und Ergänzung;
Eintrags-IDs sind unabhängig, Mobwahl/NPCs und Originalnotizen bleiben vor der
zusätzlichen Herkunftsangabe erhalten. Übernahme nutzt den vorhandenen Vorlagenwriter.

Der bestehende pure Selector bewertet Gesamt-XP, Monsterzahl, Statblocks und
Initiativeplätze aus Basis plus Ergänzung. Harte Komposition und Monsterfilter
betreffen nur Ergänzungen. Ausreichende Basis erzwingt keinen Zusatz; ohne passende
Ergänzung darf das Ergebnis außerhalb des Zielbands bleiben, mit sichtbarer
Abweichung. Endliche Bestände zählen vorhandene Gegner desselben Kreaturtyps mit,
werden beim Vorschlag aber nicht verbraucht. Benannte Basisfiguren sind aus
zusätzlichen NPC-Kandidaten ausgeschlossen; ausdrückliche doppelte Verpflichtung
führt zur Korrekturmeldung. Preset-, Tabellen-, Katalog-, NPC- und Weltquellenprüfungen
bleiben zuständig. Quelle, Partymitgliedschaft, HP und Scenezeit ändern sich nicht.

Vor Erzeugen den Vorlagenentwurf abschließen und bestätigte Revision binden.
Änderungen an Name, Notizen, Einträgen oder Ausgangsvorlage entwerten die Vorschau
für neue Übernahmen. Eine später geänderte Basis sperrt die erste Übernahme; der
alte Snapshot bleibt lesbar. [Bereits gespeicherte Vorlagen öffnen](encounter-planning.md#gespeicherte-vorbereitung-aus-einer-früheren-vorschau-öffnen)
liest unabhängig von der geänderten Füllbasis den aktuellen Autorenstand.
Alte Previewformate ohne Füllbasis bleiben gültig. Restart, Backup und
unabhängiger Transfer erhalten Vorschauen; der bestehende Walker remappt lokale
Vorlagen-/Eintrags-/NPC-IDs, erhält Kreaturkatalogdaten und freie Prosa.
Keine Schemaänderung oder zweiter Selector.

## Offene Lieferungen

- Unbekannten Ausgang mit `generation_receipt`, ursprünglichem Command/Fingerprint
  und bestehender Commit-/Recoverygrenze klären. Bestätigt, unbekannt und
  fehlgeschlagener Nachread sind getrennt; keinen Ersatzcommand erfinden.
  Verlorene Antwort, Close/Escape, Restart und spätere Registryänderung gemeinsam prüfen.
- Verschachtelte Anlage bei 100 %, vollständiger Tastaturbedienung und Appneustart
  nach getrenntem Table-/Factionwrite qualifizieren, einschließlich unbekanntem
  Ausgang eines Saves. Beide Bestände separat wiederfinden; weitere inline
  Konsumenten verwenden denselben Manager.
- Endgültiges Delete von reversiblem `table-trash` trennen. `world_source`-Ortslinks,
  Factionhaupttabelle und Bestandslimits in einer Transaktion behandeln; Installation
  betrifft alle Campaigns. Restore erfindet keine früher entfernten Bindungen.
  Stale Revision, Fehler bei späterer Faction und unveränderte Prosa/Receipts prüfen.
- Gewichte vor neuem Schreiben verbindlich entscheiden und Altgewichte ausdrücklich
  migrieren/erhalten. No-table-Fallback von gewählter leerer Tabelle trennen;
  Kreaturfilter und XPceiling schneiden, Lootkonflikte nur warnen. Biom-/Poolregeln:
  [Kataloglieferungen](catalog-browsing.md#offene-lieferungen).
- Direktes Auffüllen persistenter Scenegruppen und vollständige Kapazitätsallokation
  bei ungleichen endlichen Statblockbeständen bleiben offen. p95-, 100 %-, Golden-,
  Plattform- und vollständige Scene-/Session-Parität eigenständig abnehmen.
  Der übrige Originalumfang bleibt verbindlich.
