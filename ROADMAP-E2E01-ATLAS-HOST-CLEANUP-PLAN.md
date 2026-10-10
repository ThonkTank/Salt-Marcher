# RUNTIME-I01c-CLEAN-P01: Abschluss der sichtbaren Atlasmontage

Eigener begrenzter Aufräumplan vom 10. Oktober 2026 für
[E2E-01, Nutzerzeile 13](ROADMAP-E2E-GATES-CANDIDATE.md#e2e-01--kampagne-und-gemeinsamer-raum--saverestart).
Der vorhandene unabhängige Stadtchat hat im
[CITY-HOST-R02](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/13#issuecomment-6096213544)
den einzigen Pflichtbefund `CITY-HOST-R01-01` geschlossen; neue Befunde gibt es
nicht. Geprüft ist Kandidat `4c35a7d6482bc5583e10bf9155ce65e55e438889`,
Produkt-/Testquelle `2bc2d0ea13285eecf6863d4ef5802ebb66a81805`.
Stadts unabhängige Typprüfung, 605 Tests, sauberer Build, unveränderte originale
Gegenproben und ein zusätzlicher Wechseltest bestanden. Dieser Nachweis gilt
für die Hostmontage und ihre konkrete Lebensdauerreparatur; eine erfolgreiche
Campaign-/Atlas-Speicherung und ein echter Neustart sind noch offen.

## Erhaltung und Umfang

**Die Löschliste ist leer.** Es gibt keinen weiteren Produktbefund und kein
neues Formatierungs- oder Refactoringpaket. Die beiden eigenen Hostläufe
enthalten weiterhin benötigte Montage-, Konflikt-, Journal- und Reparaturbelege.
Alle **58 Dateien mit 40.985.197 Bytes** werden einschließlich fehlgeschlagener
Läufe, Wiederholungen, Gegenproben und ihrer erzeugten Bundles aufbewahrt:

- `/home/aaron/.cache/dungeon-native-qa/hex-03/runtime-visible-host-i01c-20261010`
- `/home/aaron/.cache/dungeon-native-qa/hex-03/runtime-visible-host-n01c-20261010`

Das vollständige Inventar mit SHA-256 steht in
`/home/aaron/.cache/dungeon-native-qa/hex-03/runtime-visible-host-cleanup-20261010/p01/retained-evidence-inventory.json`.
Daneben liegen die geschützten **561 getrackten Dateibindungen** und der direkt
gelesene, gegen seine 16 Belegdateien geprüfte R02-Receipt. Alle **32 nativen
Fixturedateien** bleiben unverändert. Neue Dateien des Aufräumpakets liegen
außerhalb dieser eingefrorenen Belegverzeichnisse.

Produktquellen, Tests, Werkzeuge, Buildtripel und der Runtimeplan bleiben
unverändert. Der ursprüngliche schmutzige Checkout, fremde Checkpointwurzeln,
Stadts Reviewkopien, geliehene Abhängigkeiten, der Nutzervault und `sources/`
werden nicht bearbeitet. Der historische native `currentRun` auf `88babcd`
bleibt wörtlich erhalten; R02 ist kein neuer nativer Nachweis.

## Getrennte Arbeitsläufe

| Lauf | Konkretes Ergebnis und Prüfung |
| --- | --- |
| **CLEAN-P01, dieser Lauf** | Tatsächlichen R02 samt Hashbindung übernehmen; diese Erhaltungsmenge und leere Löschliste festlegen. JSON, Verweise, geschützte Blobs und erlaubten Diff prüfen, regulär veröffentlichen. |
| **CLEAN-I01, nächster eigener Lauf** | Aktuellen Repo-Stand integrieren und die 58 Belege sowie geschützte Produkt-/Fixtureblobs erneut mit dem eingefrorenen Inventar vergleichen. Nur einen externen Erhaltungsbeleg und eigene Abschlussmetadaten schreiben; nichts löschen und keine Produktänderung durchführen. Bei Drift die konkrete Datei benennen. |
| **CLEAN-R01, danach** | Der bestehende unabhängige Stadtchat prüft genau den veröffentlichten I01-Abschluss, erlaubten Diff, Quellen- und Belegerhaltung. Keine Wiederholung des bestandenen Produktreviews; nur neue Pflichtbefunde führen zur Nachbesserung. |

Eigene Repoänderungen betreffen ausschließlich diesen Plan,
`checkpoint.hexAtlasExecution` und den eigenen Abnahmeeintrag
`E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`. Eingehende qualifizierte Änderungen
werden gesondert normal integriert und passend geprüft. Für unveränderte
Produktblobs werden die bestandenen Kernprüfungen nicht wegen Metadaten wiederholt.
Stadts eigenes Reviewer-Aufräumen bleibt sein gesonderter Arbeitslauf.

## Anschließender produktiver Schritt

Danach wird ausschließlich der konkret übergebene **PR32-Eingang
`0a62015cf82de1c179a040c65bf3d78b85cabeb4`** gemäß
[Chroniks qualifiziertem Handoff](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/13#issuecomment-6096143004)
im bestehenden PR13-Atlas konsumiert. Seine tatsächlichen Review-/Cleanup-
Receipts und Fixtureversion werden beim Konsum gebunden; keine neue allgemeine
Owner- oder Planrunde wird eröffnet.

Hex verbindet den Campaign-Participant mit derselben bestehenden
AtlasRepository-/FileTransaction-/Recovery-Strecke: vollständige sieben native
Before-/After-Guards und exakten World-Draftpfad co-validieren, Manifest und native
Änderungen in einer Journalclosure sichern, Prepared-/Committed-Recovery sowie
Save → neuer Provider/Repository → frischer Mount gegen die Ownerfixtures prüfen.
Campaign/Data editiert diese Hex-Anschlüsse nicht parallel. Für die anschließende
echte Obsidian-Probe wird der einzige lokale GUI-Slot erneut ausdrücklich
koordiniert. Ein Canvas, eine Kamera und History bleiben verbindlich.

Dieses Aufräumen liefert keine neue GUI-, Neustart-, physische, Originalparitäts-,
Großkarten-, Installations-, P02/P04-/Complete-Import- oder Gesamt-E2E-Abnahme.
E2E-02–04 werden nicht vorgezogen.
