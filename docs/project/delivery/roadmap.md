# Produktroadmap und fachliche Abhängigkeiten

Status: Current; offene Ziele sind als solche beschrieben.
Owner: project
Last Reviewed: 2026-10-28 (beleggebundene Übergabe und begrenzte Terrainlieferung; keine neue Qualifikation)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Diese Datei verbindet den vorhandenen Produktstand mit der nächsten Lieferung. Fachliche Details bleiben in den verlinkten Fachplänen; Anforderungen und datierte Nachweise bleiben in `acceptance.json`. Historische Issues und frühere Prototypen sind Herkunftsbelege, keine aktuelle Aufgabenliste.

## Technischer Übergang

Der Übergang zu Electron/TypeScript/SQLite ist implementiert. `desktop/main.ts` komponiert den Host; `desktop/preload.ts` vermittelt ausdrücklich freigegebene Fähigkeiten an den eingeschränkten Renderer in `src/app/`. Der kanonische `CampaignStore` läuft im Node-Worker, Main besitzt native Fähigkeiten und Lebenszyklus. Obsidian ist eine historische Referenz, kein Lieferziel. Die [Hostarchitektur](../architecture/desktop-host.md) und der [Storevertrag](../architecture/canonical-store-worker.md) beschreiben die aktuellen Anschlüsse.

Der [aktuelle Atlasplan](../../atlas/architecture/unified-spatial-atlas.md#aktueller-arbeitsstand) gilt für den gemeinsamen Darstellungspfad. Die frühere verbindliche M0–M8-Folge und die Pflicht zu Rust/WASM sind aufgehoben. Vorhandene Testbestände brauchen keine Kompatibilitätsmigration; vollständige fachliche Fähigkeiten, eingeschränkte Rendererrechte und Liefergates bleiben bindend. Datenlinie und Archivkennungen folgen dem [Cutoververtrag](workbench-migration.md).

## Vorhandene Umsetzung und nächste Anschlüsse

Stand dieser Übergabe: 28.10.2026; das Datum ist keine neue Qualifikation.
Die Aussagen gelten unabhängig voneinander: **implementiert** benennt vorhandenen
Code; **automatisiert geprüft** einen tatsächlich ausgeführten Test oder CI-Lauf;
**nativ geprüft** einen Bedienlauf mit Host, Renderer und Quellbindung;
**ausgeliefert** ein überprüftes Paket beziehungsweise eine veröffentlichte Version;
**Ownerabnahme** eine ausdrücklich erteilte Abnahme. Ein Testdateilink allein
belegt keinen PASS. **Nicht belegt** bezeichnet fehlende oder unzugängliche
Evidenz, **fehlgeschlagen** einen ausgeführten erfolglosen Versuch. Historische
Erfolge gelten nur für ihre damalige Revision und Bedingungen.

| Nutzerergebnis | Implementierter Umfang | Nachgewiesener Umfang | Offener Abschluss |
| --- | --- | --- | --- |
| Desktop öffnen und bestätigte Arbeit erhalten (SMR-00/01) | Eingeschränkter Renderer über `desktop/preload.ts`, native Fähigkeiten in `desktop/main.ts`, kanonischer SQLite-Store in `desktop/store-worker.ts`; [Hostbesitzer](../architecture/desktop-host.md) und [Storevertrag](../architecture/canonical-store-worker.md). | Der [lokale E2E-01-Lauf](../verification/end-to-end.md#datierter-lokaler-e2e-01-nachweis) vom 28.10. auf `1e7512f74…` plus Dirtyänderungen belegt bestätigten Autosave, Close/Fresh, absichtlichen Prozessabbruch und Receiptklärung. Der [Workervergleich vom 24.10.](../architecture/canonical-store-worker.md#lokaler-vorher-nachher-vergleich-am-24102026) misst Mainreaktion, keine Terrainlatenz. | P01–P04/C01 am Lieferstand, breite Fault-/Recovery- und OS-Qualifikation; [SMR-AC-01/02 im Register](../../../acceptance.json) bleiben historische offene Abnahmen, kein Auftrag zum erneuten Shellaufbau. |
| Kampagne exportieren, vollständig importieren und unabhängig weiterarbeiten (SMR-01, E2E-01/04) | [Transferbedienung](../../campaign/contract/archive.md#visible-transfer-entry-and-independent-continuation), Manifest-/Medienprüfung und lokaler ID-Remap über `desktop/campaign-files.ts`, `desktop/campaign-accept.ts` und `src/app/storage/campaign-data.ts`. | Derselbe [gemeinsame E2E-01-Beleg](../verification/end-to-end.md#datierter-lokaler-e2e-01-nachweis) prüft Complete-Archiv, echte PNGbytes, 199 lokale Identitäten über 168 Tabellen, Referenzclosure, unveränderte Quelle und unabhängige Bearbeitung/Fresh. | Diese technische P04-Variante ist lokal und im [integrierten CI-Katalog](../verification/end-to-end.md#integrierter-technischer-e2e-01-nachweis) bestanden; Zielgeräte-/Paketabschluss bleiben offen. Salvage, Trash, Backup/Restore und Zweithost gehören zur breiteren [E2E-04-Abnahme](../verification/end-to-end.md#e2e-04--portabilität-recovery-und-sichere-anzeige), SMR-AC-15 und [Transferfacharbeit](../../campaign/contract/archive.md#acceptance-reihenfolge). |
| Welt, Terrain/Wasser, Stadt und Räume im gemeinsamen Atlas bearbeiten (SMR-04, E2E-01) | [Gemeinsamer metrischer Renderer und Besitzer](../../atlas/architecture/rendering.md), Anheben, Senken, Aufrauen, Glätten, direkte Hügel-/Berg-/Schluchtpinsel, Meeresspiegel und [einzeln geplante Flüsse](../../atlas/contract/terrain-routes.md#begrenzter-flussabschluss); gemeinsame Kamera, History und Storegrenze. | E2E-01 belegt Gelände-Eigenschaften, Hausgeometrie und Raum-Key in einer History; das ist kein Höhenpinsel-Gesamtbeleg. [Terrainbelege und Grenzen](../verification/end-to-end.md#terrain-wasserbelege-und-zielgerät) trennen lokale Funktionsproben, historische Bilder und fehlende Zielgerätequalifikation. | [TW-G1–6](../../atlas/requirements/terrain-relief.md#ziele-und-abnahme-dieser-etappe) samt Flussteilabschluss: vollständige Parameter-/Abbruch-/Feinhöhenwirkung, Kamera, Formen/LOD und Leistung am vereinbarten Gerät, dann Paket/CI. Vollständiger Atlas-/Stadt-/Dungeonumfang und SMR-AC-05 bleiben eigene Abschlüsse; Ownerabnahme separat. |
| Spielabend vorbereiten, fortsetzen und Kampf abrechnen (E2E-02) | [Eröffnung, gespeicherter Rückblick und Wiederaufnahme](../../runtime/contract/session-opening-and-resume.md) in `src/app/runtime/live.ts`; [Kampfentwürfe und Nachbereitung](../../runtime/contract/combat-recovery.md) mit eigener Runtime-/Receiptgrenze. | Die [datierte lokale Spielabendprobe](../verification/end-to-end.md#wiederverwendete-fachbelege) auf `1cb69e33…` plus Dirtyänderungen belegt bei 100 % vier normale Starts/Exits, erhaltene Rückblickbytes und stabile Plan-/Besuchsidentitäten. Der [Kampfbeleg vom 13.10.](../../runtime/contract/combat-recovery.md#offene-lieferung-und-beleggrenzen) gilt nur für Build 0.29.0. | Preparation → Initialize → Encounter/Combat/Loot mit gemeinsamem ID-/Receipt-Trace und unveränderter Vorbereitung am selben Stand qualifizieren; [E2E-02-Orakel](../verification/end-to-end.md#e2e-02--vorbereitung--live-spiel--abschluss), SMR-AC-04/06/07 und offene Fachwirkungen bleiben maßgeblich. |
| Reisen und Weltzeit nachvollziehbar fortschreiben (E2E-03) | [Checkpoint, Unterbrechung, Fresh und kausale Rücknahme/Wiederholung](../../atlas/contract/hex-travel-3.md#checkpoint-und-wiederaufnahme-auf-der-aktuellen-atlasfläche) in `src/app/storage/travel-history.ts`; [Agenda und ausdrückliche Zeitänderung](../../runtime/contract/campaign-agenda.md). | Die [datierte Reiseprobe](../verification/end-to-end.md#wiederverwendete-fachbelege) auf `1cb69e33…` plus Dirtyänderungen belegt zwei Hexabschnitte, Pause/Fresh, Ankunft, Rücknahme/Wiederholung, Pixel- und kanonische Gegenproben mit vier normalen Starts/Exits. | Verbundenen Reise-/Zeit-/Wetter-/Shop-/Musikablauf einschließlich Retry/Restart nach [E2E-03](../verification/end-to-end.md#e2e-03--reise--kalenderclock--weltreaktion) qualifizieren. Routengrenzen, weitere Zeitfolgen und Agendaentwürfe bleiben bei ihren Fachbesitzern offen; SMR-AC-08–12/13 sind dadurch nicht geschlossen. |
| Spieler sicher anzeigen und die Anwendung installieren/aktualisieren (SMR-10/11, E2E-04) | [Passive visuelle Projektion und Hostfilter](../../runtime/contract/player-projection.md), getrenntes Playerfenster sowie [Linuxpakete und signierte Updates](github-updates.md); `desktop/player-host.ts`, `desktop/player-window.ts` und `desktop/update-service.ts`. | Der [historische Dialog-/Handoutlauf](../../runtime/contract/player-projection.md#große-karten-und-lokaler-nachweis) auf `ea0d616c` vom 14.10. bestand; erneuter Cue-Lauf hing, aktueller Ortsart-/Privacy-Lauf ist offen. [SMR-LINUX-UPDATE-01](../../../acceptance.json) hält 25 gezielte Tests und eine Zwei-Paket-Installations-/Restartprobe fest, nennt aber keinen exakten Quell-/Paketstand. | Vollständige Privacy-/Recovery-/OS-/Accessibility-/Extensionqualifikation nach [E2E-04](../verification/end-to-end.md#e2e-04--portabilität-recovery-und-sichere-anzeige), SMR-AC-14–18. Der historische Linuxnachweis ist keine aktuelle Paketfreigabe oder Ownerabnahme. |

**Gemeinsamer E2E-01-Stand:** Der vollständige technische Pflichtkatalog ist
[lokal sowie auf Candidate und integriertem Main](../verification/end-to-end.md#integrierter-technischer-e2e-01-nachweis)
bestanden: Candidate `43a0cd501…`, Main `5c679da32…` aus PR #1431 mit gleichem
Tree und erfolgreichem eigenem Exact-SHA-Lauf. Die 22 technischen Fälle sind
CI-qualifiziert; nativer Zielgerätlauf, Paketqualifikation und ausdrückliche
Ownerabnahme bleiben offen. Die aktuellen Dokumentationsänderungen sind nicht
Teil dieser CI-Commits; E2E-02–04 haben keinen gemeinsamen Gesamtbeleg.

Das [Abnahmeregister](../../../acceptance.json) enthält auch `saltMarcherReplacement`
vom 09.10.2026, frühere ADR-P01/P02-No-Gos und Obsidian-P04-Beiträge. Diese
historischen Aussagen bleiben erhalten. Aktuelle Fachpläne besitzen Verhalten,
Code und Restarbeit; die Prüfdokumentation besitzt ausgeführte Szenarien,
Ergebnisse und Grenzen; Acceptance besitzt Anforderungen und Belegbindungen.
Das Quellenregister behält unverändert deren Herkunft.

## Nächste begrenzte Lieferung: Terrain und Meer

Der bestätigte [Terrain-/Meerumfang](../../atlas/requirements/terrain-relief.md#aktueller-lieferfokus-terrain-und-wasser)
ist die nächste Lieferung. Er umfasst Grundpinsel samt Parameterwirkung und
genau einmal übernommenen Zügen, Abbruch, Undo/Redo und Neustart (TW-G1),
Mauskamera und Welt-bis-Raum-Zoom (TW-G2), direkt gemalte Hügel, Berge und
Schluchten (TW-G3), kontinuierliche lesbare Darstellung (TW-G4), gemessene
Reaktionsfähigkeit auf dem vereinbarten Zielgerät (TW-G5) und die tatsächliche
Qualifikation/Auslieferung (TW-G6). Die [kleinen Ergebnisabschnitte](../../atlas/requirements/terrain-relief.md#begrenzte-ergebnisabschnitte)
konkretisieren diese Lieferung; ein Grundpinsel-Teilabschluss ist weder
Gesamtterrain- noch E2E-01-Abnahme. Spezialformen und visuelle Qualität bleiben
Bestandteile des bestätigten Terrainumfangs.

**Eigener Teilabschluss des bestätigten erweiterten Terrain-/Wasserumfangs:** der [Flusszyklus](../../atlas/contract/terrain-routes.md#begrenzter-flussabschluss)
mit Pflichtpunkten und begrenztem Bettabtrag. Die Trennung der Prüfumfänge
verschiebt diesen bestätigten Ausbau nicht in eine spätere Lieferung. Ein
TW-G1–6-Abschluss allein schließt den erweiterten Wasserumfang nicht ab. Bereits vorhandene Umsetzung und
lokale Zyklus-2-Belege bleiben erhalten; sie ziehen keinen vollständigen
Fluss-/Wonderdraft-PASS vor. Automatische Flussnetze, Erosion und neue Seen
werden damit nicht aufgenommen. Bestehende Gewässer und andere Karteninhalte
bleiben bei Terrainänderungen nach ihren Schutzverträgen erhalten.

**Späterer Gesamtumfang:** übrige Kartenwerkzeuge, Stadt-/Dungeonfunktionen und
Actor Autonomy bleiben vollständig gebunden. Offene Bewohnermerkmale,
Beziehungs-/Fraktionswirkungen, Stadtgeneratoroptionen, Dungeon-Graph-/Template-
und Runtimefragen sowie Autonomyentscheidungen verhindern den Abschluss der
Terrainlieferung nicht. Sie werden [vor dem jeweiligen späteren Ausbau](../requirements/scope.md#offene-originalwirkungen-und-klärung-vor-der-lieferung)
geklärt. Fehler an gemeinsam genutzter Kamera, History, Speicherung oder am
Erhalt vorhandener Inhalte sind dagegen auch hier Liefermängel.

## Kritischer Pfad für E2E-01

Der nächste gemeinsame E2E-Abschluss verbindet die vorhandenen Anschlüsse;
er ist von der begrenzten Terrainlieferung oben zu unterscheiden.
Den erreichten lokalen Szenarienstand und offene Integrationsnachweise führt
der [E2E-Prüfstand](../verification/end-to-end.md); die folgende Liste beschreibt
die verbindliche Wirkung, nicht eine zweite Ergebnisliste. Dafür gilt der [vollständige E2E-01-Szenarienkatalog](../verification/end-to-end.md#e2e-01--kampagne-und-gemeinsamer-raum--saverestart):

1. Kampagne ohne LiveSession öffnen; Atlas, Stadt/Gebäude, Dungeon und Key auf derselben Arbeitsfläche bearbeiten. Fehlende fachliche Wirkung an ihrem konkreten Atlas-/Storeanschluss ergänzen.
2. Gemeinsame Undo/Redo-Folge, Autosave ohne manuellen Save, A→B→A-Kontextwechsel und frischen Prozess an diesem Ablauf nachweisen. IDs, Geometrie, Abschnittsreihenfolge, Markdownbytes und Referenzen müssen erhalten bleiben; offene Schreibbestätigungen dürfen nicht als dauerhaft gesichert erscheinen.
3. Eine echte Complete-Import-Variante mit Manifest, Checksums, Medien und vollständiger Remap-Closure unabhängig weiterbearbeiten und frisch öffnen. Quelle und Import bleiben unabhängig; normale Wiederaufnahme erhält IDs.
4. P01/P02 und die erforderliche P04-Importvariante mit diesen Fachbeiträgen auf derselben integrierten SHA zusammenführen. Fixture-/Buildhashes, tatsächliche Host-/Prozessbelege und verbleibende Lücken nennen. Erst der vollständige gemeinsame Nachweis erlaubt den Gateabschluss; Ownerabnahme bleibt gesondert.

Der vollständige technische Pflichtlauf dieser Verbindung ist lokal sowie auf Candidate und integriertem Main bestanden; offen bleiben **Zielgeräte-, Paket- und Ownerqualifikation** mit möglichen konkreten Restimplementierungen. Der oben verlinkte datierte Prüfstand benennt die abgeschlossene und die offenen Stufen. Die [Atlas-Prüfwege](../../atlas/architecture/rendering.md#prüfwege-und-offene-qualifikation), der [Transfervertrag](../../campaign/contract/archive.md) und die [Editorgrenzen](../architecture/editor-lifecycle.md) sind die Arbeitseinstiege. Weitere unabhängige Fachfunktionen dürfen parallel entstehen.

## Lieferfolge des Gesamtprodukts

| Gate | Nutzerablauf | Voraussetzungen der gemeinsamen Abnahme |
| --- | --- | --- |
| [E2E-01](../verification/end-to-end.md#e2e-01--kampagne-und-gemeinsamer-raum--saverestart) | Kampagne, gemeinsamer Atlas, Stadt/Dungeon/Key, Save und Restart | Nächste gemeinsame Gateabnahme; P02-Minimalpfad und verbindliche P04-Importvariante sind harte Eingänge; kein Abschlusskriterium der begrenzten Terrainlieferung |
| [E2E-02](../verification/end-to-end.md#e2e-02--vorbereitung--live-spiel--abschluss) | Preparation → Party/LiveSession → Encounter/Combat/Loot | Nach integriertem E2E-01-PASS; keine automatische Session in E2E-01 |
| [E2E-03](../verification/end-to-end.md#e2e-03--reise--kalenderclock--weltreaktion) | Reise → Clock/Calendar → Wetter/Shops/Musik | Nach integriertem E2E-02-PASS; bestätigte Zeit- und Consumerverträge erforderlich |
| [E2E-04](../verification/end-to-end.md#e2e-04--portabilität-recovery-und-sichere-anzeige) | Portabilität, Recovery, sichere Spielerprojektion, OS/A11y | Nach integriertem E2E-03-PASS; beschlossene Zielhost-/Storegrenze direkt qualifizieren |
| Gesamtqualifikation | Vollständiger SaltMarcher-Umfang, Migration, Performance, Originalparität und reale GM-Bedienung | Zusätzlich zu allen vier Gates; vollständige Bereichsanforderungen bleiben bindend |

Die gemeinsamen Abnahmen E2E-01 bis E2E-04 bauen in dieser Reihenfolge aufeinander auf. Fehlende Eingänge sperren die davon abhängige Produktwirkung. Die Reihenfolge beschreibt Abnahmevoraussetzungen, keine globale Reihenfolge für die Implementierung einzelner Funktionen.

<a id="parallele-umsetzung-und-zusammenführung"></a>

## Fachliche Lieferabhängigkeiten

Die folgenden Lieferketten übersetzen den bestätigten Umfang in Nutzerergebnisse. Sie beschreiben fachliche Abhängigkeiten. Vorhandene Anschlüsse und nächste Qualifikation stehen oben; die verlinkten lokalen Fachpläne führen die Details. Issue-/PR-Links in dieser Tabelle sind historische Herkunftsbelege.

| Fachbereich | Zusammenhängendes Ergebnis und nächste Verwendung | Voraussetzungen und Fachquellen |
| --- | --- | --- |
| Kampagne, Atlas und Datenlebenszyklus | Vorhandene Ort-/Keybearbeitung, unabhängigen Import, automatische Speicherung und Wiederaufnahme im gemeinsamen E2E-01-Ablauf qualifizieren | [Transfervertrag](../../campaign/contract/archive.md) und [Store-Worker](../architecture/canonical-store-worker.md) verbinden vorhandene Fach-/Hostbeiträge. Ungeklärte Schreibbestätigung blockiert den betreffenden Folgeauftrag. Breite Recovery/Trash/Restore folgen im selben Datenlebenszyklus; Campaign-/Clock-Vertrag und [Plattform-ADR](../architecture/platform-decision.md). |
| World-Inhalte und manuelle Vorbereitung | [World-Inhalte/Notizen #68](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/68) verwalten und wiederfinden; unabhängig davon [manuelle Session-Timeline #69](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69) bearbeiten und wieder öffnen; Locationprojektion verbindet beide Lieferungen, immutable Preparation führt später ins Live-Spiel | CampaignId/Context und eigener revisionierter Schreib-/Speichervertrag. Manuelle Timeline funktioniert auch ohne Ort, Party, Encounter, Loot oder Generator. World-Notizen benötigen keinen vollständigen Itemkorpus. Bestehende Atlas-Ortsidentität erhalten; Campaign/Clock, SMR-02/06. |
| Katalog und Spielabend | Vollständigen Quellenkorpus konsumieren → Itemkatalog nutzbar machen; der bestehende Party-/Scene-Kern führt zum gespeicherten Live-Spiel; bestätigte Katalog-/Party-/Scene-Eingänge verbinden Encounter, Combat und Loot | Full-S01/S01-R01 vor Itemproduktartefakt/Provider/UI bleibt bindend (#58; [Katalog-/Encountervertrag](../../catalog/requirements/catalog-encounters.md)). Der [LiveScene-Vertrag](../../runtime/contract/smr03-live-scene-contract.md) aus #60 bleibt maßgeblich; Projektionen sind ein Eingang. Planung und Runtime bleiben getrennt; zusammengeführte Abnahme E2E-02. |
| Integrierte Dungeons und Städte im Hex-Atlas | Benötigte Hex-/Orts-/City-/Dungeonwirkungen im gewählten Kern liefern und HEX-04/05 samt gemeinsamer Speicherung qualifizieren; CITY-01–04 bis Stadtanlage/Generator/Haus-Dungeon und geschützter Regeneration vervollständigen. Mehrstufige Weltgestaltung und vollständige Kartenwerkzeuge ergänzen; CITY-05–09, HEX-22 und erweiterte Dungeonfähigkeiten bis Endqualifikation liefern. [Stand und Ergebnisetappen](../../atlas/requirements/atlas.md#atlas-auf-einen-blick) | Eine Kamera, Meter-/lokale Transformationen, stabile Bindungen, gemeinsame History und Mehrowner-Save/Recovery. [SMR-04-Lieferweg](../requirements/product-scope.md#smr-04--gemeinsamer-atlas-und-karten), Hex-/Stadtatlas und [Dungeonanforderungen](../../dungeon/requirements/smr04-spatial-coverage.md); #44. Sparsames 3D-Volumemodell nach beschlossenem Vertrag → Room-Lifecycle → Paths/Passages; Tagesabläufe konsumieren den gemeinsamen Zeitport. Originalinventare bleiben offene Eingänge. |
| Reise und gemeinsame Weltzeit | Kalender bearbeiten und Eventrelevanz pro Scene sehen; Gruppenreise bis Checkpoint/Unterbrechung, Spurverfolgung und kausalem Undo → gemeinsame Worldfolgen genau einmal → bestätigte Knowledge-/Perceptionfakten für Player/Autonomy konsumieren | Kalenderregeln benötigen keinen fertigen Reiseablauf. Autoritative Scene-Zeit braucht den bestätigten Scene-/Owner-/Publishvertrag, Reise zusätzlich Positionsprojektionen; Campaign/Clock/SMR-07. Rejoin/Zeitkonflikte bleiben GM-Entscheidungen, kein Rückrollen fremder Worldwahrheit. |
| Wetter und Klima | Kartenfallback/regionale Klimazonen bearbeiten → kontinuierliches regionales Wetter samt bewegten GM-Phänomenen → aktuelle Scene-Effekte und bleibende Meldung → Reise, Perception, sichere Anzeige und Ambience konsumieren diese Fakten | Ort/Terrain/Klima und Scene-Zeit; fachlich bestätigte Modell-/Auflösungs-/Kontinuitätsgrenzen fehlen vor Wetterqualifikation. Kein Sessionplan/Generator erforderlich. [SMR-08](../requirements/product-scope-2.md#smr-08--shops-wetter-und-musik), SRC-T05/L04, TN-25; Campaign/Clock, AC-11/E2E-03. |
| Lokale Musik und Ambience | Songs/Metadaten verwalten → manuellen Player samt Queue/Loop/Fade bis echter Wiedergabe und Reopen liefern → optional fokussierte Scene für Autoplay konsumieren → Umwelt-/Wetterlayer mischen, manuell hinzufügen/unterdrücken | Bibliothek und manuelle Steuerung benötigen keine Reise-, Wetter- oder Generatorfunktion. Vorhandene [Audio-/Speicheranschlüsse](../../runtime/contract/music-recovery.md) mit tatsächlicher Wiedergabe und ihren Fehlergrenzen qualifizieren; Scene-Automatik erst mit Fokus-/Kontextprojektion, Umweltlayer mit Wetter-/Zeitinput. [SMR-08](../requirements/product-scope-2.md#smr-08--shops-wetter-und-musik), Musik-Vertragskandidat, Campaign-/Clock-Vertrag und [Plattform-ADR](../architecture/platform-decision.md), AC-12/E2E-03. |
| Shops und Weltreaktion | NPC-/Ortshop bis Stock-/Charakterledger-Handel liefern → gemeinsamen Kalender für Restock konsumieren; Opt-in-Autonomy anschließend bis atomaren erklärbaren Steps verfolgen | Item-/Ledger-/Owner- und Publishgrenze für Handel; bestätigte Zeit für Restock. Autonomy braucht World/Actors, Raum und Scene-/Zeitfakten; keine autonome Party-/Erzählentscheidung. Katalog-/Encountervertrag und [Campaign-Datenvertrag](../../campaign/contract/archive.md), SMR-08/09, AC-10/13. |
| Zielhost, sichere Anzeige und Erweiterung | Vorhandene Electron-/SQLitegrenze mit P01–P04/C01 qualifizieren; Distribution/OS, passive Spielerprojektion und widerrufbare Extensions vollständig prüfen | Vorhandene Produkt-/Risikonachweise wiederverwenden (ADR-Plattformvertrag). Die Zielhostgrenze und die [separate visuelle Spielerprojektion](../../runtime/contract/player-projection.md) sind implementiert; deren begrenzte Nachweise ersetzen keine vollständige Privacy-/OS-Abnahme; gemeinsame Abnahme E2E-04 plus eigene Extensionabnahme. |

**Abhängigkeiten:** Der produktive Publish-/Formatanschluss verbindet Import, World und manuelle Planung. Quellenkorpus, Party/Scene und Kartenwerkzeuge behalten ihre fachlichen Schnittstellen. Kalender, Musik und Klima benötigen für produktive Wirkung ihre bestätigten Zeit-, Audio- und Speicheranschlüsse.

**Zusammenführung:** Die Verbindung einzelner Funktionen benötigt den jeweiligen konkreten Port, nicht den Abschluss des ganzen Quellbereichs. Import/Atlas verbinden sich in E2E-01, Vorbereitung/Runtime/Encounter in E2E-02, Reise/Zeit/Worldverbraucher in E2E-03 und Plattform/Recovery/Anzeige in E2E-04. Nur diese gemeinsamen Gateabnahmen bleiben nacheinander. Zusätzliche Fachfunktionen behalten ihre vollständigen eigenen Abnahmen.

Tastatur, 100 %, Lokalisierbarkeit, passende Feature-Tutorials, ehrlicher pending/durable-Zustand und relevante Latenz-/Lastgrenzen werden mit dem betroffenen Nutzerablauf umgesetzt und geprüft. SMR-11/E2E-04 bündeln die verbleibende Gesamtqualifikation; sie sind kein Aufschub der Featurequalität. Für neue schreibende Funktionen genügt nicht ein In-Memory- oder DOM-Beleg: produktive Aktivierung benötigt den tatsächlich bestätigten Owner-/Publish-/Recoveryanschluss.

## Zusätzliche Lieferergebnisse außerhalb der vier Gate-Kurzfassungen

Der [Quellenabgleich](../requirements/scope.md) führt den gesamten erfassten Umfang. Diese Funktionen brauchen zusätzlich konkrete Fachpakete und direkte Abnahmen:

Die vier E2E-Gates ersetzen keine Fachabnahme. Der vollständige Abschluss verlangt alle SMR-00–11 und SMR-AC-01–18 aus der [SaltMarcher-Lieferplanung](../requirements/product-scope.md#lieferphasen). Die detaillierte Themen-, Quellen- und Abnahmezuordnung steht ausschließlich in [SCOPE](../requirements/scope.md) und dem Quellenregister.

Automatische Speicherung, vollständige Wiederaufnahme, Datenlebenszyklus und Import sind querschnittliche Anforderungen. Ein manueller Save/Reopen-Beleg ersetzt sie nicht. Jeder Fachbereich liefert seine nötigen Fähigkeiten und Nachweise; die fachlichen Abhängigkeiten oben bestimmen, welche Funktionen sich bereits verbinden lassen.

## Welche Quelle gilt?

1. Der vollständige Lieferumfang folgt [SaltMarcher-Ablösung](../requirements/product-scope.md) und den dort gebundenen fachlichen Quellen. Architekturentscheidungen bleiben in [ARCHITECTURE.md](../architecture/overview.md).
2. Die vier Gatebedeutungen stehen im [gemeinsamen Abnahmekatalog](../verification/end-to-end.md). Die ursprüngliche Fassung bleibt als [historischer Quellenbeleg](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/6bfb1f393722cd469dc4fd5f15d8dea12a154f6b/ROADMAP-E2E-GATES-CANDIDATE.md) gebunden (Blob `435daf96695664e2c54e09d2e583c120dbfd9d24`, Merge `6bfb1f393722cd469dc4fd5f15d8dea12a154f6b`).
3. Der aktuelle Übergabeeinstieg steht in dieser Roadmap; die verlinkten lokalen Fachpläne besitzen die konkreten Anschlüsse und offenen Lieferungen. Historische Entscheidungen behalten ihren direkten Beleg und Commit.
4. `acceptance.json` führt die fachlichen Anforderungen und direkten Nachweise. Ältere Einträge sind kein Gesamtproduktstatus.
