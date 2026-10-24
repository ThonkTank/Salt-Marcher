# Produktroadmap und fachliche Abhängigkeiten

Der beauftragte [Atlasumbau](development/atlas-rendering.md) folgt gezielten Reads → räumlicher Präzision/Index → Detailstufen/Frame → Fachanschlüssen → Medien/Jobs → Verbrauchern → qualifizierter Ablösung. Bestehende Fachfähigkeiten werden übernommen; der volle Produktumfang bleibt erhalten. Vorläufige Technik und Alternativen stehen ausschließlich im [Beobachtungsregister B01–B11](../ARCHITECTURE.md#atlas).

Diese Datei führt die fachliche Lieferfolge. Der [Atlasstand](../ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) unterscheidet integrierte Funktionen, Kandidaten und offene Lücken.

## Technischer Übergang

Die [Grundlage](../ARCHITECTURE.md) und [Plattformentscheidung](../ROADMAP-SALTMARCHER-PLATFORM-ADR.md)
vom 11.10.2026 wählen einen kleinen neuen Kern/Store/Shell mit selektiver
begründeter Wiederverwendung. Die folgenden #40/#41/#80- und Fachbelege sind
Ist-/Anforderungsreferenzen; ihre damaligen internen APIs/Journale sind keine
Vorgabe. Der gemeinsame Einstieg steht hier, die Atlaspakete im Atlasplan. Alle SMR-00–11-/AC-01–18-
Lieferziele bleiben bindend; Gatefolge beschreibt Abnahme, nicht ein globales
Wartegebot für unabhängige Funktionen.

| Schritt | Konkreter Anschluss und Ende des Schritts |
| --- | --- |
| 1 – Schutzfixture | Tatsächlich genutzte `.dungeon` v3/v4, Atlas-/City-/Locationformate, externe Markdownlinks und Assets auflisten. Kopierte Inputbytes/Hashes und exakte Prosa-/ID-/Metrikorakel; kein Eingriff in den Nutzerordner. |
| 2 – Kleine Shell | `desktop/main.ts` / `desktop/preload.ts` als geplante getrennte Hostgrenze, `src/app/` für den neuen kleinsten Application-/UIkern. Sandboxed GMrenderer ohne native APIs; erster Linux-/Windows-/macOS-Buildsmoke. Bestehender Pluginbuild bleibt Übergang, keine neue permanente Parallelproduktlinie. |
| 3 – Autoritativer Store | `src/app/storage/` für SQLitewriter/Queries/Migration, zunächst Campaign-, Scope-, Room-/Geometrie-/Textrecords und Commitreceipt. Reale Campaignaktivierung, revisionsgebundene eine Änderung + inverser Command, Kill/Reopen und konsistenter Backup. Keine Memory-Speicherung als fertiger Produktanschluss. |
| 4 – Geprüfte Übernahme | Expliziter Formatadapter importiert eine geschützte Kopie, vergleicht Identitäten/Wortlaut/Links/Einheiten. Bekannte reine Geometrie nur nach passend bestandener Probe verwenden; fehlende physische Semantik anzeigen, nicht raten. |
| 5 – Erster kompletter GM-Weg | Suche/Auswahl → sichtbare Kontur und Key bearbeiten → ein Command → Undo/Redo → ehrlicher Autosavestatus → Close/Neustart. A→B→A, IME, stale Callback, Speicherfehler und Tastatur/200 % direkt prüfen. |
| 6 – Fachpakete | Erst danach Atlas Work 2/3/4 und unabhängige World-/Plan-/Katalogwege an denselben Kern anschließen. Scene/Clock/Ledger vor den davon abhängigen Reise-/Umwelt-/Autonomiefolgen. P03/P04 und breite Fault-/Lastmatrix mit ihren konkreten Verbrauchern vervollständigen. |

## Kritischer Pfad für E2E-01

Der Zielkern muss Kampagne → Atlas → Stadt/Dungeon/Key → automatische Speicherung → Neustart sowie vollständigen unabhängigen Import tatsächlich verbinden. Die gemeinsame Abnahme benötigt P01/P02 und P04 am selben Produktstand. Vorhandene Beiträge sind Verhaltens- und Datenreferenzen; ihre internen Dateijournale sind keine Vorgabe.

Die konkreten fachlichen Restlücken stehen in [#80](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80) und [#41](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/41); der [Atlasstand](../ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) unterscheidet integrierte Fähigkeiten und Kandidaten. Die [Atlaspakete](../ROADMAP-HEX-ATLAS.md#lieferpakete-und-codeanschlüsse) führen ihren Ausbau.

## Lieferfolge des Gesamtprodukts

| Gate | Nutzerablauf | Voraussetzungen der gemeinsamen Abnahme |
| --- | --- | --- |
| [E2E-01](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/milestone/1) | Kampagne, gemeinsamer Atlas, Stadt/Dungeon/Key, Save und Restart | Aktueller Lieferfokus; P02-Minimalpfad und verbindliche P04-Importvariante sind harte Eingänge |
| [E2E-02](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/milestone/2) | Preparation → Party/LiveSession → Encounter/Combat/Loot | Nach integriertem E2E-01-PASS; keine automatische Session in E2E-01 |
| [E2E-03](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/milestone/3) | Reise → Clock/Calendar → Wetter/Shops/Musik | Nach integriertem E2E-02-PASS; bestätigte Zeit- und Consumerverträge erforderlich |
| [E2E-04](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/milestone/4) | Portabilität, Recovery, sichere Spielerprojektion, OS/A11y | Nach integriertem E2E-03-PASS; beschlossene Zielhost-/Storegrenze direkt qualifizieren |
| Gesamtqualifikation | Vollständiger SaltMarcher-Umfang, Migration, Performance, Originalparität und reale GM-Bedienung | Zusätzlich zu allen vier Gates; vollständige Bereichsanforderungen bleiben bindend |

Die gemeinsamen Abnahmen E2E-01 bis E2E-04 bauen in dieser Reihenfolge aufeinander auf. Fehlende Eingänge sperren die davon abhängige Produktwirkung. Die Reihenfolge beschreibt Abnahmevoraussetzungen, keine globale Reihenfolge für die Implementierung einzelner Funktionen.

<a id="parallele-umsetzung-und-zusammenführung"></a>

## Fachliche Lieferabhängigkeiten

Die folgenden Lieferketten übersetzen den bestätigten Umfang in Nutzerergebnisse. Sie beschreiben fachliche Abhängigkeiten. Konkrete Produktbefunde und Kandidaten stehen im jeweiligen Produktissue/PR.

| Fachbereich | Zusammenhängendes Ergebnis und nächste Verwendung | Voraussetzungen und Fachquellen |
| --- | --- | --- |
| Kampagne, Atlas und Datenlebenszyklus | Ort/Key bearbeiten und frisch öffnen; vollständigen unabhängigen Import anschließen; automatische Speicherung und Wiederaufnahme danach am realen Bearbeitungsweg liefern | #40 und #41 verbinden bereits vorhandene Fach-/Hostbeiträge. Fehlender Publish-/Formatvertrag blockiert den betreffenden Schreibweg. Breite Recovery/Trash/Restore folgen im selben Datenlebenszyklus; Campaign-/Clock-Vertrag und [Plattform-ADR](../ROADMAP-SALTMARCHER-PLATFORM-ADR.md). |
| World-Inhalte und manuelle Vorbereitung | [World-Inhalte/Notizen #68](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/68) verwalten und wiederfinden; unabhängig davon [manuelle Session-Timeline #69](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69) bearbeiten und wieder öffnen; Locationprojektion verbindet beide Lieferungen, immutable Preparation führt später ins Live-Spiel | CampaignId/Context und eigener revisionierter Schreib-/Speichervertrag. Manuelle Timeline funktioniert auch ohne Ort, Party, Encounter, Loot oder Generator. World-Notizen benötigen keinen vollständigen Itemkorpus. Bestehende Atlas-Ortsidentität erhalten; Campaign/Clock, SMR-02/06. |
| Katalog und Spielabend | Vollständigen Quellenkorpus konsumieren → Itemkatalog nutzbar machen; der bestehende Party-/Scene-Kern führt zum gespeicherten Live-Spiel; bestätigte Katalog-/Party-/Scene-Eingänge verbinden Encounter, Combat und Loot | Full-S01/S01-R01 vor Itemproduktartefakt/Provider/UI bleibt bindend (#58; [Katalog-/Encountervertrag](../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md)). Der [LiveScene-Vertrag](plans/runtime/smr03-live-scene-contract.md) aus #60 bleibt maßgeblich; Projektionen sind ein Eingang. Planung und Runtime bleiben getrennt; zusammengeführte Abnahme E2E-02. |
| Integrierte Dungeons und Städte im Hex-Atlas | Benötigte Hex-/Orts-/City-/Dungeonwirkungen im gewählten Kern liefern und HEX-04/05 samt gemeinsamer Speicherung qualifizieren; CITY-01–04 bis Stadtanlage/Generator/Haus-Dungeon und geschützter Regeneration vervollständigen. Mehrstufige Weltgestaltung und vollständige Kartenwerkzeuge ergänzen; CITY-05–09, HEX-22 und erweiterte Dungeonfähigkeiten bis Endqualifikation liefern. [Stand und Ergebnisetappen](../ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) | Eine Kamera, Meter-/lokale Transformationen, stabile Bindungen, gemeinsame History und Mehrowner-Save/Recovery. [SMR-04-Lieferweg](../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-04--gemeinsamer-atlas-und-karten), Hex-/Stadtatlas und [Dungeonanforderungen](plans/dungeon/smr04-spatial-coverage.md); #44. Sparsames 3D-Volumemodell nach beschlossenem Vertrag → Room-Lifecycle → Paths/Passages; Tagesabläufe konsumieren den gemeinsamen Zeitport. Originalinventare bleiben offene Eingänge. |
| Reise und gemeinsame Weltzeit | Kalender bearbeiten und Eventrelevanz pro Scene sehen; Gruppenreise bis Checkpoint/Unterbrechung, Spurverfolgung und kausalem Undo → gemeinsame Worldfolgen genau einmal → bestätigte Knowledge-/Perceptionfakten für Player/Autonomy konsumieren | Kalenderregeln benötigen keinen fertigen Reiseablauf. Autoritative Scene-Zeit braucht den bestätigten Scene-/Owner-/Publishvertrag, Reise zusätzlich Positionsprojektionen; Campaign/Clock/SMR-07. Rejoin/Zeitkonflikte bleiben GM-Entscheidungen, kein Rückrollen fremder Worldwahrheit. |
| Wetter und Klima | Kartenfallback/regionale Klimazonen bearbeiten → kontinuierliches regionales Wetter samt bewegten GM-Phänomenen → aktuelle Scene-Effekte und bleibende Meldung → Reise, Perception, sichere Anzeige und Ambience konsumieren diese Fakten | Ort/Terrain/Klima und Scene-Zeit; fachlich bestätigte Modell-/Auflösungs-/Kontinuitätsgrenzen fehlen vor Wetterqualifikation. Kein Sessionplan/Generator erforderlich. [SMR-08](../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-08--shops-wetter-und-musik), SRC-T05/L04, TN-25; Campaign/Clock, AC-11/E2E-03. |
| Lokale Musik und Ambience | Songs/Metadaten verwalten → manuellen Player samt Queue/Loop/Fade bis echter Wiedergabe und Reopen liefern → optional fokussierte Scene für Autoplay konsumieren → Umwelt-/Wetterlayer mischen, manuell hinzufügen/unterdrücken | Bibliothek und manuelle Steuerung benötigen keine Reise-, Wetter- oder Generatorfunktion. Produktiver Audio-/Speicherport und Rechte brauchen Bestätigung; Scene-Automatik erst mit Fokus-/Kontextprojektion, Umweltlayer mit Wetter-/Zeitinput. [SMR-08](../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-08--shops-wetter-und-musik), Musik-Vertragskandidat, Campaign-/Clock-Vertrag und [Plattform-ADR](../ROADMAP-SALTMARCHER-PLATFORM-ADR.md), AC-12/E2E-03. |
| Shops und Weltreaktion | NPC-/Ortshop bis Stock-/Charakterledger-Handel liefern → gemeinsamen Kalender für Restock konsumieren; Opt-in-Autonomy anschließend bis atomaren erklärbaren Steps verfolgen | Item-/Ledger-/Owner- und Publishgrenze für Handel; bestätigte Zeit für Restock. Autonomy braucht World/Actors, Raum und Scene-/Zeitfakten; keine autonome Party-/Erzählentscheidung. Katalog-/Encountervertrag und [Campaign-Datenvertrag](../ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md), SMR-08/09, AC-10/13. |
| Zielhost, sichere Anzeige und Erweiterung | Beschlossene Electron-/SQLitegrenze mit P01–P04/C01 implementieren und prüfen; Distribution/OS früh, PlayerProjection und widerrufbare Extensions vollständig qualifizieren | Vorhandene Produkt-/Risikonachweise wiederverwenden (ADR-Plattformvertrag). Die Zielhostgrenze ist beschlossen; bestehender befristeter Adapter und hostneutrale Arbeit bleiben möglich. Playerausgabe bleibt bis zur separaten sicheren Projektion deaktiviert; gemeinsame Abnahme E2E-04 plus eigene Extensionabnahme. |

**Abhängigkeiten:** Der produktive Publish-/Formatanschluss verbindet Import, World und manuelle Planung. Quellenkorpus, Party/Scene und Kartenwerkzeuge behalten ihre fachlichen Schnittstellen. Kalender, Musik und Klima benötigen für produktive Wirkung ihre bestätigten Zeit-, Audio- und Speicheranschlüsse.

**Zusammenführung:** Die Verbindung einzelner Funktionen benötigt den jeweiligen konkreten Port, nicht den Abschluss des ganzen Quellbereichs. Import/Atlas verbinden sich in E2E-01, Vorbereitung/Runtime/Encounter in E2E-02, Reise/Zeit/Worldverbraucher in E2E-03 und Plattform/Recovery/Anzeige in E2E-04. Nur diese gemeinsamen Gateabnahmen bleiben nacheinander. Zusätzliche Fachfunktionen behalten ihre vollständigen eigenen Abnahmen.

Tastatur, 200 %, Lokalisierbarkeit, passende Feature-Tutorials, ehrlicher pending/durable-Zustand und relevante Latenz-/Lastgrenzen werden mit dem betroffenen Nutzerablauf umgesetzt und geprüft. SMR-11/E2E-04 bündeln die verbleibende Gesamtqualifikation; sie sind kein Aufschub der Featurequalität. Für neue schreibende Funktionen genügt nicht ein In-Memory- oder DOM-Beleg: produktive Aktivierung benötigt den tatsächlich bestätigten Owner-/Publish-/Recoveryanschluss.

## Zusätzliche Lieferergebnisse außerhalb der vier Gate-Kurzfassungen

Der [Quellenabgleich](SCOPE.md) führt den gesamten erfassten Umfang. Diese Funktionen brauchen zusätzlich konkrete Fachpakete und direkte Abnahmen:

Die vier E2E-Gates ersetzen keine Fachabnahme. Der vollständige Abschluss verlangt alle SMR-00–11 und SMR-AC-01–18 aus der [SaltMarcher-Lieferplanung](../ROADMAP-SALTMARCHER-REPLACEMENT.md#lieferphasen). Die detaillierte Themen-, Quellen- und Abnahmezuordnung steht ausschließlich in [SCOPE](SCOPE.md) und dem Quellenregister.

Automatische Speicherung, vollständige Wiederaufnahme, Datenlebenszyklus und Import sind querschnittliche Anforderungen. Ein manueller Save/Reopen-Beleg ersetzt sie nicht. Jeder Fachbereich liefert seine nötigen Fähigkeiten und Nachweise; die fachlichen Abhängigkeiten oben bestimmen, welche Funktionen sich bereits verbinden lassen.

## Welche Quelle gilt?

1. Der vollständige Lieferumfang folgt [SaltMarcher-Ablösung](../ROADMAP-SALTMARCHER-REPLACEMENT.md) und den dort gebundenen fachlichen Quellen. Architekturentscheidungen bleiben in [ARCHITECTURE.md](../ARCHITECTURE.md).
2. Die vier Gatebedeutungen stehen im [gemeinsamen Abnahmekatalog](../ROADMAP-E2E-GATES-CANDIDATE.md). Die ursprüngliche Fassung bleibt als [historischer Quellenbeleg](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/6bfb1f393722cd469dc4fd5f15d8dea12a154f6b/ROADMAP-E2E-GATES-CANDIDATE.md) gebunden (Blob `435daf96695664e2c54e09d2e583c120dbfd9d24`, Merge `6bfb1f393722cd469dc4fd5f15d8dea12a154f6b`).
3. Aktueller Produktstatus steht in der Atlasübersicht und den konkreten Produktissues/PRs. Historische Entscheidungen behalten ihren direkten Beleg und Commit.
4. `acceptance.json` führt die fachlichen Anforderungen und direkten Nachweise. Ältere Einträge sind kein Gesamtproduktstatus.
