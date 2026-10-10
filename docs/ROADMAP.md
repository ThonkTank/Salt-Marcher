# Produktroadmap und nächste Schritte

Planungsstand: 10. Oktober 2026; ergänzt um Diagnose D01 und veröffentlichte Reparatur R01. Diese Orientierung bündelt die bestehenden Produkt- und Ownerentscheidungen. Live-Status: Aufgaben und aktueller Kandidat in [#12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12); ein unten genannter Commit ist ein Belegstand, nicht automatisch der neueste Branchhead.

## Was jetzt zuerst passiert

| Reihenfolge | Konkretes Ergebnis | Aufgabe / bestehende Arbeit | Eingang und Zuständigkeit |
| --- | --- | --- | --- |
| 1 | Veröffentlichte Capture-Reparatur nativ A→B→A prüfen und das Gate schließen | [#38](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/38), bestehender [PR #13](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/13) | Hex; Campaign B aus PR #37 ist bereits geliefert und konsumiert |
| 2 | Einen integrierten Kandidaten unabhängig prüfen und Promotion/Nichtpromotion ausdrücklich entscheiden | [#39](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/39) | Nach #38 und den übrigen PR-13-Eingängen; bestehender Steward und unabhängige Fach-/Atlas-QA-Reviewer |
| 3 | Orte und Keys auf Shared sichtbar anlegen, auswählen, verschieben/ändern und frisch wieder öffnen | [#40](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/40), bestehendes `HEX-03-I01b-marker` | Nach integrierter Hostentscheidung; Hex; bereits beschlossen in PVC-ATLAS-LOCATION-004 |
| Begleitender Eingang | Konkreten P02-Save/Reopen-Minimalpfad und P04-Complete-Import mit realen Implementierungsownern verbinden | [#41](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/41) | Campaign/Data und Plattformkoordination #10/#11; offene Adapterrollen ausdrücklich übernehmen |
| Danach | Alle E2E-01-Eingänge in einem vollständigen Nutzerablauf gemeinsam abnehmen | [#12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12), [Meilenstein E2E-01](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/milestone/1) | Gatekatalog, gemeinsame SHA, versionierte Fixtures, echter Host und unabhängiger Review |

Der dokumentierte A→B→A-Lauf auf `cd4a06d620a8a454aa5a82e9bc27a040cda3a374` scheiterte bereits vor Keyeingabe und Kampagnenwechsel. [Der direkte native Befund](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6098973186) wird durch die [D01-Diagnose am sichtbaren Hausbutton](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6099063871) ergänzt: Nebenläufiges Terrain-Nachladen verändert die History während Capture wartet. Hex hat [R01 im bestehenden Kandidaten veröffentlicht](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6099309213); der nächste Lauf ist die neu koordinierte native A→B→A-Probe. Der frühere native FAILED-Beleg bleibt erhalten; Quell-/Modelltests schließen das Hostgate nicht. Es braucht keine weitere Campaign-B-Bestellung und keinen parallelen Atlas-Kandidaten.

[Sichtbarer Location-/Key-Nutzen](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6098878157) ist das nächste konkrete Produktziel nach dieser Integration. Katalog-Quellarbeit bleibt notwendig, aber Quelltranskription allein ist noch kein nutzbarer Itemprovider; Quellen-, Provider- und UI-Abnahme bleiben in #9 getrennt sichtbar.

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

`status:ready` bezeichnet frei übernehmbare, ausführbare Arbeit; `status:active` eine bereits übernommene Aufgabe. `priority:now` bezeichnet den aktuellen Engpass, `priority:next` die folgende abhängige Arbeit. `status:blocked` nennt seinen Eingang im Text; nach dessen Lieferung konkret entfernen. `kind:task` braucht ein begrenztes Ergebnis und eine überprüfbare Abnahme. Bereichsindizes (`kind:coordination`) bleiben übergreifend und erhalten deshalb keinen irreführenden Einzelmeilenstein. Prozessakten (`kind:process`) werden nicht als Produktfeature priorisiert.

Ein Aufgabenabschluss liefert ein Ergebnis mit Beleg und einem nächsten Empfänger. Nur bei neuem Ergebnis, geändertem Blocker oder Reviewbedarf einen neuen Status veröffentlichen. Keine deltafreien Meldeschleifen. Bereits vorhandene PRs reviewen und ihre Abhängigkeiten klären; dieses Aufräumen schließt oder merged keine unbewertete fremde Arbeit.

Für den Einstieg unabhängig vom GUI-Engpass: [Trap-Quell-/Paketabgleich #46](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/46). Die [Fixture-B-Anleitung #42](CONTRIBUTOR-FIXTURE-B.md) ist über PR #45 abgeschlossen; weitere Wege und ein geprüfter Modelltest stehen im [Agenteneinstieg](../CONTRIBUTING.md#agenteneinstieg).
