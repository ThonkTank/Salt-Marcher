# Provider und sichtbares Verhalten

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: catalog
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

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

Der Auswahlreader `sceneEncounterSelection` liefert Party, Gruppen und ihre
unveränderten Command-Basiskennungen aus einer gemeinsamen SQLite-Lesetransaktion.
Die frühere Kette aus Live-, vollständigem Progress-, Vorbereitungs- und einzelnen
Gruppenreads entfällt. Fortschritt wird nur für die zugeordneten aktiven Figuren
gelesen. Auswahlfakten enthalten Kreatur-ID/XP und relevante NPC-Werte; vollständige
Statblocks und verfasste Gruppen-/NPC-Texte bleiben in ihren bestehenden Lesern.
Die bisherige Live-Strukturprüfung und die Validierung benötigter Gruppenquellen
bleiben erhalten; dies ist keine vollständige Optimierung ihrer internen Reads.

`scenePreparedGroupIds` bestimmt die identischen Gruppenbindungen für Vorbereitung,
Auswahl und Combat-Writer. Auswahl, Übernahme und Verstärkung benötigen deshalb
keine Beutesammlung oder Vorschau des nächsten Besuchs. Ein Fehler in benötigtem
Partyfortschritt sperrt weiterhin sichtbar. Einzelne unlesbare Gruppen bleiben
mit ID und Fehler als nicht verfügbare Einträge sichtbar, erhalten aber keine
auswählbaren Teilnehmer oder Command-Basis. Gesunde Gruppen können weiter in die
Initiative übernommen werden. Ein Lesefehler ist kein bestätigter Leerstand. Fehler in
unabhängiger Beute oder inaktivem Fortschritt werden durch deren eigene Leser
weiter gemeldet, blockieren aber diese Gruppenauswahl nicht. Kein Speicherschema,
Autorencommand oder Receiptformat ändert sich. Fokus, Mitgliedschaft und Ort binden
Antworten an den sichtbaren Kontext; verspätete Antworten und Fehler dürfen keine
Initiative aus einem veralteten Stand freigeben.

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

Die Live-Session-Originalquelle verlangt außerdem den direkten gemeinsamen
Gruppeneditor und den abschließenden Scene-Desktop. Die heutige orts-/besuchsgebundene
Gruppenauswahl samt separatem Gruppenbereich erfüllt diese Lieferungen noch nicht.
Der gezielte native Readercheck `tools/test-desktop-scene-selection-read.mjs` prüft
Lesefehler, erneutes Lesen, gemeinsame Übernahme und Initiative-Wiederaufnahme nach
Neustart bei 100/200 Prozent; er ersetzt weder jene Lieferungen noch eine
Großgruppen-/Speicherqualifikation.
