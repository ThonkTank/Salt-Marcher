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

Vorbereitende Vertrags-/Quellenarbeit kann erforderliche Eingänge liefern. Die **nummerierten Integrationsgates beginnen nacheinander**, jeweils nach integriertem PASS des Vorgängers; das ist keine Anweisung, alle übrige Facharbeit zu stoppen. Es gibt keine erfundenen Fertigstellungstermine oder Gesamtprozente.

## Zusätzliche Lieferergebnisse außerhalb der vier Gate-Kurzfassungen

Der [Quellenabgleich](SCOPE.md) führt den gesamten erfassten Umfang. Diese Funktionen brauchen zusätzlich konkrete Fachpakete und direkte Abnahmen:

| Fachfolge | Eigenes Ergebnis | Abhängigkeit / bestehender Arbeitsort |
| --- | --- | --- |
| SMR-02 | World Planner, vollständiger Katalog/Referenzgraph und Notizsuche | Campaign-/Identitätsgrundlage; #9/#10; vorhandene CE-Arbeit |
| SMR-04 | Volle Dungeon-/Hex-/Stadtfunktion einschließlich 3D-/Graph-/Template-/Beschreibungsbedarf und FTG-Lebensdaten | Vorhandene Atlas-/Paritäts-/CITY-Folgen weiterführen; fehlende Detailzuordnung #44 in #7/#8/#12 |
| SMR-06 | Manuelle Sessionplanung und reproduzierbare Vorschlags-/Reward-Generierung, ohne angenommene World-Inhalte zu verlieren | Campaign, Quellen/Party, Encounter/Loot und Ortsreferenzen; #9/#10; positive Übergabe in E2E-02 |
| SMR-09 | Opt-in-Autonomy mit Bedürfnissen/Jobs/Reservierungen und begrenzten nicht-partybezogenen Konflikten | SMR-02/03/04/07; Zeit-/World-/Actor-Owner klären in #10/#12; eigene AC-13-Abnahme |
| SMR-10 | Installierbare, widerrufbar befähigte Extensions und austauschbare Capabilitybereiche | Daten-/Rechte-/Hostgrenzen, unabhängige Fail/Remove/Replace/Restore-Nachweise; #11; eigene AC-16-Abnahme |
| SMR-11 | Vollständige Tutorials je Version, OS-Auslieferung, Accessibility/Lokalisierung und messbare Gesamtqualität | Jedes exponierte Feature, unterstützte OS-/Display-/Lastprofile; #11/#12; AC-17/18 und Bereichsbudgets |

Automatische Speicherung und vollständige Wiederaufnahme sind bereits querschnittliche SMR-01-Bedarfe. Ein manueller Save/Reopen-Beleg ersetzt diese Normalbetriebsanforderung nicht. Die zusätzlichen Ergebnisse ändern die bereits ratifizierte Gate-Reihenfolge nicht; Gesamtfreigabe verlangt sämtliche Fach- und Querschnittsabnahmen.

## Welche Quelle gilt?

1. Der vollständige Lieferumfang folgt [SaltMarcher-Ablösung](../ROADMAP-SALTMARCHER-REPLACEMENT.md) und den dort gebundenen fachlichen Quellen. Architekturentscheidungen bleiben in [ARCHITECTURE.md](../ARCHITECTURE.md).
2. Die vier Gatebedeutungen folgen dem [ratifizierten Katalog](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/6bfb1f393722cd469dc4fd5f15d8dea12a154f6b/ROADMAP-E2E-GATES-CANDIDATE.md), Blob `435daf96695664e2c54e09d2e583c120dbfd9d24`, übernommen mit Merge `6bfb1f393722cd469dc4fd5f15d8dea12a154f6b`; [Ratifikation](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6090732894). Der erhaltene Dateiname und die Einleitung nennen noch „Kandidat“; daraus folgt kein erneuter Ratifikationsbedarf. Eine geänderte Gatefassung benötigt eine neue ausdrückliche Bindung.
3. Aktueller Aufgabenstatus steht im konkreten Aufgabenissue/PR; bereichsübergreifende Annahmen und Entscheidungen in #12. Ältere Issue-Haupttexte und Planstände können überholt sein. Bei Widerspruch den genauen Commit und direkten Beleg prüfen, nicht die günstigste Statusmeldung wählen.
4. `checkpoint.json` führt bereichseigene Ausführungsstände; `acceptance.json` führt direkte Anforderungen/Nachweise. Ihre älteren Top-Level-Felder beschreiben teils den Dungeon-Lieferweg und sind kein Gesamtproduktstatus. Fremde Wurzeln werden nicht pauschal überschrieben.

## Backlog pflegen

`status:ready` bezeichnet frei übernehmbare, ausführbare Arbeit; `status:active` eine bereits übernommene Aufgabe. `priority:now` bezeichnet den konkreten Engpass zum nächsten integrierten Nutzerablauf, `priority:next` die folgende abhängige Arbeit. `status:blocked` nennt seinen Eingang im Text; nach dessen Lieferung konkret entfernen. `kind:task` braucht ein begrenztes Ergebnis und eine überprüfbare Abnahme. Bereichsindizes (`kind:coordination`) bleiben übergreifend und erhalten deshalb keinen irreführenden Einzelmeilenstein. Prozessakten (`kind:process`) werden nicht als Produktfeature priorisiert.

Ein Aufgabenabschluss liefert ein zusammenhängendes Nutzerergebnis oder einen gelösten Eingang für ein benanntes Umsetzungspaket, mit Beleg und nächstem Empfänger. Vor weiterer Planarbeit vorhandene Produkt-PRs fertigstellen; Schritte und Aufräumen im selben Paket bündeln. [Paketgrenzen und Prüfaufwand](WORKFLOW.md). Nur bei neuem Ergebnis, geändertem Blocker oder Reviewbedarf einen neuen Status veröffentlichen. Keine deltafreien Meldeschleifen. Bereits vorhandene PRs reviewen und ihre Abhängigkeiten klären; dieses Aufräumen schließt oder merged keine unbewertete fremde Arbeit.

Für den Einstieg unabhängig vom GUI-Engpass: [aktuell frei übernehmbare Aufgaben](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3Aready%22). Die [Fixture-B-Anleitung #42](CONTRIBUTOR-FIXTURE-B.md) ist über PR #45 abgeschlossen; weitere Wege und ein geprüfter Modelltest stehen im [Agenteneinstieg](../CONTRIBUTING.md#agenteneinstieg).

Bei Status-/Abhängigkeitswechsel aktualisiert der Paketowner sein Issue; bei geänderter Lieferkette zieht der Integrationsowner diese Roadmap nach. Ablage, Ablösung und automatische Prüfungen folgen dem [Repository-Pflegevertrag](REPOSITORY.md).
