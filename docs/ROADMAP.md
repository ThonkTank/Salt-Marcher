# Produktroadmap und nächste Schritte

Planungsstand: 10. Oktober 2026, 15:15 UTC. Diese Orientierung bündelt die bestehenden Produkt- und Ownerentscheidungen. Live-Status: Aufgaben und aktueller Kandidat in [#12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12); ein unten genannter Commit ist ein Belegstand, nicht automatisch der neueste Branchhead.

## Was jetzt zuerst passiert

| Reihenfolge | Konkretes Ergebnis | Aufgabe / bestehende Arbeit | Eingang und Zuständigkeit |
| --- | --- | --- | --- |
| 1 | Fehler „Native Atlas-Erfassung ist veraltet“ erklären und das native A→B→A-Gate schließen | [#38](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/38), bestehender [PR #13](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/13) | Hex; Campaign B aus PR #37 ist bereits geliefert und konsumiert |
| 2 | Einen integrierten Kandidaten unabhängig prüfen und Promotion/Nichtpromotion ausdrücklich entscheiden | [#39](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/39) | Nach #38 und den übrigen PR-13-Eingängen; bestehender Steward und unabhängige Fach-/Atlas-QA-Reviewer |
| 3 | Orte und Keys auf Shared sichtbar anlegen, auswählen, verschieben/ändern und frisch wieder öffnen | [#40](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/40), bestehendes `HEX-03-I01b-marker` | Nach integrierter Hostentscheidung; Hex; bereits beschlossen in PVC-ATLAS-LOCATION-004 |
| Begleitender Eingang | Konkreten P02-Save/Reopen-Minimalpfad und P04-Complete-Import mit realen Implementierungsownern verbinden | [#41](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/41) | Campaign/Data und Plattformkoordination #10/#11; offene Adapterrollen ausdrücklich übernehmen |
| Danach | Alle E2E-01-Eingänge in einem vollständigen Nutzerablauf gemeinsam abnehmen | [#12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12), [Meilenstein E2E-01](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/milestone/1) | Gatekatalog, gemeinsame SHA, versionierte Fixtures, echter Host und unabhängiger Review |

Der dokumentierte A→B→A-Lauf auf `cd4a06d620a8a454aa5a82e9bc27a040cda3a374` scheiterte bereits vor Keyeingabe und Kampagnenwechsel. [Der direkte Befund](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6098973186) unterscheidet eine mögliche initiale Hydrierung von einer noch unbewiesenen Ursache. Grüne 644 Tests schließen diesen Hostfehler nicht. Es braucht keine weitere Campaign-B-Bestellung und keinen parallelen Atlas-Kandidaten.

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

## Welche Quelle gilt?

1. Der vollständige Lieferumfang folgt [SaltMarcher-Ablösung](../ROADMAP-SALTMARCHER-REPLACEMENT.md) und den dort gebundenen fachlichen Quellen. Architekturentscheidungen bleiben in [ARCHITECTURE.md](../ARCHITECTURE.md).
2. Die vier Gatebedeutungen folgen dem [ratifizierten Katalog](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/6bfb1f393722cd469dc4fd5f15d8dea12a154f6b/ROADMAP-E2E-GATES-CANDIDATE.md), Blob `435daf96695664e2c54e09d2e583c120dbfd9d24`, übernommen mit Merge `6bfb1f393722cd469dc4fd5f15d8dea12a154f6b`; [Ratifikation](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6090732894). Der erhaltene Dateiname und die Einleitung nennen noch „Kandidat“; daraus folgt kein erneuter Ratifikationsbedarf. Eine geänderte Gatefassung benötigt eine neue ausdrückliche Bindung.
3. Aktueller Aufgabenstatus steht im konkreten Aufgabenissue/PR; bereichsübergreifende Annahmen und Entscheidungen in #12. Ältere Issue-Haupttexte und Planstände können überholt sein. Bei Widerspruch den genauen Commit und direkten Beleg prüfen, nicht die günstigste Statusmeldung wählen.
4. `checkpoint.json` führt bereichseigene Ausführungsstände; `acceptance.json` führt direkte Anforderungen/Nachweise. Ihre älteren Top-Level-Felder beschreiben teils den Dungeon-Lieferweg und sind kein Gesamtproduktstatus. Fremde Wurzeln werden nicht pauschal überschrieben.

## Backlog pflegen

`priority:now` bezeichnet den aktuellen Engpass, `priority:next` die folgende abhängige Arbeit. `status:blocked` nennt seinen Eingang im Text; nach dessen Lieferung konkret entfernen. `kind:task` braucht ein begrenztes Ergebnis und eine überprüfbare Abnahme. Bereichsindizes (`kind:coordination`) bleiben übergreifend und erhalten deshalb keinen irreführenden Einzelmeilenstein. Prozessakten (`kind:process`) werden nicht als Produktfeature priorisiert.

Ein Aufgabenabschluss liefert ein Ergebnis mit Beleg und einem nächsten Empfänger. Nur bei neuem Ergebnis, geändertem Blocker oder Reviewbedarf einen neuen Status veröffentlichen. Keine deltafreien Meldeschleifen. Bereits vorhandene PRs reviewen und ihre Abhängigkeiten klären; dieses Aufräumen schließt oder merged keine unbewertete fremde Arbeit.

Für den Einstieg unabhängig vom GUI-Engpass: [Fixture-Anleitung #42](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/42). Weitere Wege stehen in [CONTRIBUTING.md](../CONTRIBUTING.md).
