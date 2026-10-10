# CITY-UI-I01 – Aufräumplan

## Planung

Unabhängiger Komponentenreview auf `5e72857` bestanden (PR29/6095156261). Keine Codekorrektur nötig. Die tatsächliche Hostmontage und Bedienabnahme bleiben offen.

Entfernen: ausschließlich 15 eigene generierte Dateien (46469066 Bytes) unter `.build`, `main.js.map` und das temporäre QA-DOM-Bundle. Den eigenen `node_modules`-Symlink nur entknüpfen; Zielverzeichnis und dessen Inhalte erhalten. `.git` des Kandidaten bleibt bestehen.

Erhalten: alle Quellen, Fixtures, Pläne, Logs, Original-/Reviewerbelege und `main.js`, `styles.css`, `manifest.json`. Das Buildinventar ist vorab im QA-Verzeichnis gesichert. Das genaue Löschinventar und Schutzhashes stehen in `/home/aaron/.cache/dungeon-native-qa/city-plans/city-ui-i01-20261010/cleanup/plan.json`. Fremde Arbeitswurzeln werden nicht verändert.

## Umsetzung

Inventarhashes vor jedem Löschen prüfen, nur gelistete Dateien entfernen; danach leere eigene Buildverzeichnisse entfernen und den geprüften Symlink entknüpfen. Ergebnis in `cleanup/implementation.json` festhalten.

## Unabhängige Kontrolle der Aufräumwirkung

Separater Reviewlauf: alle Schutzhashes, erhaltenes Dependency-Ziel, `.git`, tatsächliche Löschliste und fremde JSON-Spannen prüfen. Keine erneute Produkttestsuite für unveränderte Quellen. Danach qualifizierte Exact-SHA-Übergabe an Hex zur vorhandenen Hostmontage und Test-Runneranbindung.

Umsetzung abgeschlossen: 15 inventarisierte Dateien (46.469.066 Bytes) entfernt, eigener Symlink entknüpft; Dependency-Ziel erhalten. Quellen und Auslieferungsdateien unverändert. Hashgebundener Beleg: `/home/aaron/.cache/dungeon-native-qa/city-plans/city-ui-i01-20261010/cleanup/implementation.json`.

Separater Aufräumreview PASS: 555 Schutzhashes stimmen, genau 15 Dateien fehlen, Dependency-Ziel und `.git` erhalten; fremde JSON-Spannen entsprechen dem integrierten Hex-Upstream. Komponentenquellen unverändert zum unabhängigen Hex-R01. Beleg: `/home/aaron/.cache/dungeon-native-qa/city-plans/city-ui-i01-20261010/cleanup/review.json`. Hostmontage/Save/Reopen/physische Bedienung bleiben offen.
