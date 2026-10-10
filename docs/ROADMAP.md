# Produktroadmap und nächste Schritte

Diese Datei führt die dauerhafte Lieferfolge. Aktueller Lauf, Übernahme und Gateentscheidung: [#12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12), konkretes Aufgabenissue und aktueller PR samt neuesten relevanten Kommentaren. Native Wiederholungs- und Reparaturläufe werden hier nicht als zweite Live-Statusliste geführt.

## Kritischer Pfad für E2E-01

1. Bestehendes Atlas-/Kampagnenwechselpaket [#38](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/38) / [PR #13](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/13): direkte Code- und Hostbelege an die unabhängige integrierte Entscheidung binden. Ein einzelner erfolgreicher Wiederholungslauf schließt das Produktgate nicht.
2. [#39](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/39): integrierten Kandidaten unabhängig prüfen und Promotion/Nichtpromotion ausdrücklich entscheiden. Bestehende Eingänge und Owner erhalten; kein Doppel-Kandidat.
3. [#40](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/40): sichtbarer Location-/Key-Ablauf auf Shared, einschließlich Änderung und frischem Wiederöffnen; nach integrierter Hostentscheidung, gemäß PVC-ATLAS-LOCATION-004.
4. Vollständiges E2E-01: alle Eingänge auf gemeinsamer SHA, mit versionierten Fixtures, echtem Host und unabhängigem Review abnehmen. [#41](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/41) verbindet P02-Save/Reopen und P04-Complete-Import mit realen Adapterownern.

Diese Links bezeichnen die bestehende Lieferkette, keine dauerhaft freien Aufgaben. Abgeschlossene Schritte bleiben Belege; den aktuellen offenen Schritt in #12 prüfen. Katalogarbeit bleibt ein eigener Eingang: Quellen-, Provider- und UI-Abnahme in #9 unterscheiden.

## Lieferfolge des Gesamtprodukts

| Gate | Nutzerablauf | Beginn / Abschluss |
| --- | --- | --- |
| [E2E-01](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/milestone/1) | Kampagne, gemeinsamer Atlas, Stadt/Dungeon/Key, Save und Restart | Aktueller Lieferfokus; P02-Minimalpfad und verbindliche P04-Importvariante sind harte Eingänge |
| [E2E-02](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/milestone/2) | Preparation → Party/LiveSession → Encounter/Combat/Loot | Nach integriertem E2E-01-PASS; keine automatische Session in E2E-01 |
| [E2E-03](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/milestone/3) | Reise → Clock/Calendar → Wetter/Shops/Musik | Nach integriertem E2E-02-PASS; offene Implementierungsowner zuerst bestätigen |
| [E2E-04](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/milestone/4) | Portabilität, Recovery, sichere Spielerprojektion, OS/A11y | Nach integriertem E2E-03-PASS; Zielhost durch Plattformbeweise entscheiden |
| Gesamtqualifikation | Vollständiger SaltMarcher-Umfang, Migration, Performance, Originalparität und reale GM-Bedienung | Zusätzlich zu allen vier Gates; vollständige Bereichsanforderungen bleiben bindend |

Die **nummerierten Integrationsgates beginnen nacheinander**, jeweils nach integriertem PASS des Vorgängers. Ihre Reihenfolge bestimmt die gemeinsame Abnahme. Unabhängige Produktimplementierung läuft bereits parallel, sobald ihre konkreten Eingänge und ihr Scope geklärt sind; das gilt auch für spätere Gateverbraucher. Fehlende Eingänge sperren die davon abhängige Wirkung. Es gibt keine erfundenen Fertigstellungstermine oder Gesamtprozente.

## Parallele Umsetzung und Zusammenführung

Die folgenden Lieferketten übersetzen den bestätigten Umfang in Nutzerergebnisse. Sie bestimmen Abhängigkeiten, keine zusätzlichen Phasenissues oder dauerhaften Claims. Aktueller Besitz, freie Beiträge und genaue Blocker stehen ausschließlich am verlinkten Aufgaben-/Fachort; die bestehende Aufgabenpflege hält `npm run next` daran angeschlossen.

| Parallel bearbeitbare Lieferkette | Zusammenhängendes Ergebnis und nächste Verwendung | Tatsächliche Voraussetzungen / Arbeitsort |
| --- | --- | --- |
| Kampagne, Atlas und Datenlebenszyklus | Ort/Key bearbeiten und frisch öffnen; vollständigen unabhängigen Import anschließen; automatische Speicherung und Wiederaufnahme danach am realen Bearbeitungsweg liefern | #40 und #41 verbinden bereits vorhandene Fach-/Hostbeiträge. Fehlender Publish-/Formatvertrag blockiert den betreffenden Schreibweg, nicht unabhängige Fachimplementierung. Breite Recovery/Trash/Restore folgen im selben Datenlebenszyklus; #10/#11. |
| World-Inhalte und manuelle Vorbereitung | [World-Inhalte/Notizen #68](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/68) verwalten und wiederfinden; unabhängig davon [manuelle Session-Timeline #69](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69) bearbeiten und wieder öffnen; Locationprojektion verbindet beide Lieferungen, immutable Preparation führt später ins Live-Spiel | CampaignId/Context und eigener revisionierter Schreib-/Speichervertrag. Manuelle Timeline funktioniert auch ohne Ort, Party, Encounter, Loot oder Generator. World-Notizen benötigen keinen vollständigen Itemkorpus. Bestehende Atlas-Ortsidentität erhalten; #10, SMR-02/06. |
| Katalog und Spielabend | Vollständigen Quellenkorpus konsumieren → Itemkatalog nutzbar machen; parallel den bestehenden Party-/Scene-Kern bis zum gespeicherten Live-Spiel verfolgen; bestätigte Katalog-/Party-/Scene-Eingänge verbinden Encounter, Combat und Loot | Full-S01/S01-R01 vor Itemproduktartefakt/Provider/UI bleibt bindend (#58/#9). #60/#6 behält bestehenden Chronik-Besitz; Projektionen sind ein Eingang. Planung und Runtime bleiben getrennt; zusammengeführte Abnahme E2E-02. |
| Karten- und Stadtfunktion | Bestehende Hex-/Dungeon-/City-Werkzeuge weiterführen; zusätzliche 3D-Volumes → Room-Reassoziation → Paths/Passages sowie World-Lebensdaten bis zum bearbeitbaren Nutzerablauf liefern | Gemeinsame History-/Save-/Sourcegrenzen und Fachbesitz erhalten (#7/#8/#44). Vollständige Originalinventur bleibt Pflicht. Ein fehlender Volumevertrag sperrt dessen Paths, nicht jede andere Kartenfunktion. CITY-Tagesabläufe benötigen den gemeinsamen Zeitport. |
| Reise, Zeit und Weltreaktion | Scene-/Kartenprojektionen konsumieren → Reise und autoritative Zeit verbinden → Restock, Wetter, automatische Musikcues und schließlich Opt-in-Autonomy anschließen | Scene/Position und genau-einmalige Zeit-/Publish-Wirkung für produktive Reise; bestätigte Clock für zeitabhängige Consumer. Manuelle Musikbibliothek/Player kann unabhängig von Reiseautomatik geliefert werden. Offene Fachowner/Ports bleiben in #10; gemeinsame Abnahme E2E-03. |
| Zielhost, sichere Anzeige und Erweiterung | P01–P04-Beweise zu einer Hostentscheidung führen; danach Distribution/OS, PlayerProjection und widerrufbare Extensions vollständig qualifizieren | Vorhandene Produkt-/Risikonachweise wiederverwenden (#11). Neue dauerhafte Hostkopplung braucht die Plattformentscheidung; bestehender befristeter Adapter und hostneutrale Arbeit bleiben möglich. Playerausgabe bleibt bis zur separaten sicheren Projektion deaktiviert; gemeinsame Abnahme E2E-04 plus eigene Extensionabnahme. |

**Nächste Zusammenführung:** Kampagne/Atlas und Import liefern den gemeinsamen E2E-01-Eingang. World-Inhalte, manuelle Planung, Katalog und Party/Scene können währenddessen umgesetzt werden; sie verbinden sich danach im E2E-02-Spielabend. Reise/Zeit konsumiert dessen Scene-/Kartenfähigkeiten für E2E-03. Plattform-/Recovery-/Anzeigequalifikation läuft mit ihren verfügbaren Eingängen und schließt E2E-04. Zusätzliche Karten-, World-, Generierungs-, Autonomy- und Extensionfunktionen behalten ihre Fachabnahmen bis zur vollständigen Gesamtqualifikation.

Tastatur, 200 %, Lokalisierbarkeit, passende Feature-Tutorials, ehrlicher pending/durable-Zustand und relevante Latenz-/Lastgrenzen werden mit dem betroffenen Nutzerablauf umgesetzt und geprüft. SMR-11/E2E-04 bündeln die verbleibende Gesamtqualifikation; sie sind kein Aufschub der Featurequalität. Für neue schreibende Funktionen genügt nicht ein In-Memory- oder DOM-Beleg: produktive Aktivierung benötigt den tatsächlich bestätigten Owner-/Publish-/Recoveryanschluss.

## Zusätzliche Lieferergebnisse außerhalb der vier Gate-Kurzfassungen

Der [Quellenabgleich](SCOPE.md) führt den gesamten erfassten Umfang. Diese Funktionen brauchen zusätzlich konkrete Fachpakete und direkte Abnahmen:

| Fachfolge | Eigenes Ergebnis | Abhängigkeit / bestehender Arbeitsort |
| --- | --- | --- |
| SMR-02 | World Planner, vollständiger Katalog/Referenzgraph und Notizsuche | Campaign-/Identitätsgrundlage; #9/#10; vorhandene CE-Arbeit |
| SMR-04 | Volle Dungeon-/Hex-/Stadtfunktion einschließlich 3D-/Graph-/Template-/Beschreibungsbedarf und FTG-Lebensdaten | Vorhandene Atlas-/Paritäts-/CITY-Folgen weiterführen; fehlende Detailzuordnung #44 in #7/#8/#12 |
| SMR-06 | Manuelle Sessionplanung und reproduzierbare Vorschlags-/Reward-Generierung, ohne angenommene World-Inhalte zu verlieren | Manuelle Timeline: Campaign und eigener Schreibvertrag, Ort optional. Generierung zusätzlich: bestätigte Quellen/Party/Encounter/Loot/World-Eingänge; #9/#10; positive Übergabe in E2E-02 |
| SMR-09 | Opt-in-Autonomy mit Bedürfnissen/Jobs/Reservierungen und begrenzten nicht-partybezogenen Konflikten | SMR-02/03/04/07; Zeit-/World-/Actor-Owner klären in #10/#12; eigene AC-13-Abnahme |
| SMR-10 | Installierbare, widerrufbar befähigte Extensions und austauschbare Capabilitybereiche | Daten-/Rechte-/Hostgrenzen, unabhängige Fail/Remove/Replace/Restore-Nachweise; #11; eigene AC-16-Abnahme |
| SMR-11 | Vollständige Tutorials je Version, OS-Auslieferung, Accessibility/Lokalisierung und messbare Gesamtqualität | Jedes exponierte Feature, unterstützte OS-/Display-/Lastprofile; #11/#12; AC-17/18 und Bereichsbudgets |

Automatische Speicherung und vollständige Wiederaufnahme sind bereits querschnittliche SMR-01-Bedarfe. Ein manueller Save/Reopen-Beleg ersetzt diese Normalbetriebsanforderung nicht. Die zusätzlichen Ergebnisse ändern die bereits ratifizierte Gate-Reihenfolge nicht; Gesamtfreigabe verlangt sämtliche Fach- und Querschnittsabnahmen.

## Welche Quelle gilt?

1. Der vollständige Lieferumfang folgt [SaltMarcher-Ablösung](../ROADMAP-SALTMARCHER-REPLACEMENT.md) und den dort gebundenen fachlichen Quellen. Architekturentscheidungen bleiben in [ARCHITECTURE.md](../ARCHITECTURE.md).
2. Die vier Gatebedeutungen folgen dem [ratifizierten Katalog](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/6bfb1f393722cd469dc4fd5f15d8dea12a154f6b/ROADMAP-E2E-GATES-CANDIDATE.md), Blob `435daf96695664e2c54e09d2e583c120dbfd9d24`, übernommen mit Merge `6bfb1f393722cd469dc4fd5f15d8dea12a154f6b`; [Ratifikation](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6090732894). Der erhaltene Dateiname und die Einleitung nennen noch „Kandidat“; daraus folgt kein erneuter Ratifikationsbedarf. Eine geänderte Gatefassung benötigt eine neue ausdrückliche Bindung.
3. Aktueller Aufgabenstatus steht im konkreten Aufgabenissue/PR; bereichsübergreifende Annahmen und Entscheidungen in #12. Ältere Issue-Haupttexte und Planstände können überholt sein. Bei Widerspruch den genauen Commit und direkten Beleg prüfen, nicht die günstigste Statusmeldung wählen.
4. `checkpoint.json` führt bereichseigene Ausführungsstände; `acceptance.json` führt direkte Anforderungen/Nachweise. Ihre älteren Top-Level-Felder beschreiben teils den Dungeon-Lieferweg und sind kein Gesamtproduktstatus. Fremde Wurzeln werden nicht pauschal überschrieben.

## Arbeit aufnehmen und nachführen

`npm run next` zeigt den aktuellen Produktengpass und freie Aufgaben. [CONTRIBUTING](../CONTRIBUTING.md#agenteneinstieg) führt zur Übernahme; [WORKFLOW](WORKFLOW.md) bestimmt Paketgrenzen und Prüfung, [REPOSITORY](REPOSITORY.md#selbstorganisation-ohne-zentrale-zuweisung) Besitz, Labels und Übergabe. Bei geändertem Lieferpfad zieht der Integrationsowner diese Roadmap nach; konkrete Laufstände bleiben im Aufgabenissue.
