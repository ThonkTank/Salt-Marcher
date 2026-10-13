# Gruppen erkennen, trennen und wieder zusammenführen

## Ausgangsproblem und Vergleich

Drei Figuren beginnen gemeinsam in der Wachstube. Aran und Sela werden im echten Desktop jeweils ohne zusätzlichen Gruppennamen abgespalten. Die Fokusauswahl kennt ihre Namen, aber im Zusammenführen-Dialog heißen die beiden Ziele nur „Gruppe 5e8277af“ und „Gruppe 941978ba“. Die Quelle heißt „Aktuelle Gruppe“. Die GM muss technische Kennungen mit verdeckten Gruppen-/Rosterlisten abgleichen, bevor sie ein sicheres Ziel wählen kann ([Daten](2026-10-13-split-knowledge-before.json), [Bild](2026-10-13-split-knowledge-before.png)). Beide Codefragmente wechseln je neuer Campaign und sind keine sinnvoll merkbaren Gruppennamen.

Eine einfache [Markdownnotiz](2026-10-13-split-knowledge-paper.md) führt Nera, Aran und Sela direkt unter ihren Namen. Sie benötigt für die Zuordnung keine Kennungssuche. Diese Gegenprobe ist tatsächliche Dateiarbeit; kein menschlich gemessener Editor-/Papierzeitvergleich. [Foundrys Combat Tracker](https://foundryvtt.com/article/combat/#combatants) dokumentiert ebenfalls sichtbare Teilnehmernamen und mehrere unabhängig geführte Encounter. Das ist eine passende Orientierungsreferenz, kein praktisch bedienter Foundry-Split und keine bewiesene Gesamtparität.

## Änderung

Der Zusammenführen-Dialog verwendet nun dieselbe Beschreibung wie die Fokusauswahl: optionaler eigener Titel, Hauptgruppenrolle, aktive Figuren und aktuelle Gruppenzeit. Die Quelle bekommt dieselben Informationen. Rosterzuordnungen zeigen ebenfalls verständliche Gruppen statt gekürzter IDs. Die Änderung betrifft ausschließlich die Anzeige; eigene Titel, Sceneidentitäten und Mitgliedschaften werden nicht umgeschrieben.

## Praktische Prüfung

- Ausgangsproblem nativ reproduziert und vor der Änderung gespeichert. App normal mit Exit 0 geschlossen; die anschließende Kennungsprüfung scheiterte absichtlich.
- Danach erneut drei Gruppen ohne Namen erzeugt. Quelle Aran, Ziele Nera und Sela unmittelbar im Dialog erkennbar ([Daten](2026-10-13-split-knowledge-after.json), [Bild](2026-10-13-split-knowledge-after.png)).
- Bereits vor der Änderung vorhandene Ortsübernahme bestätigt: Die Splits bleiben ohne erneutes Platzieren in der Wachstube.
- Nera entdeckt den Bronzeschlüssel allein. Beim Fokuswechsel zu Aran verschwindet er aus dem getrennten Spielerfenster. Nach normalem Close, echtem Neustart und nativem Zusammenführen mit Nera erscheint die gemeinsame Wissensunion wieder. Aran erhält dabei keinen erfundenen persönlichen Entdeckungsdatensatz.
- Frischer Core bestätigt zwei verbleibende Gruppen, unveränderte eigene leere Titel und geschützte Legacyprosa. Keine Pageerrors; beide Appstarts und beide Closewege erfolgreich.
- Desktop-Build/Typecheck und 153 betroffene Store-/DOM-/Playerregressionen bestanden. Alle schweren Jobs liefen über `codex-dungeon-job qa`, ein Testworker. Der eigene GM-/Spieler-/Treiberprozessbaum blieb im QAservice; nativer Peak 715,1 MiB, kein Swap. Alle eigenen Nativeprozesse beendet.

Reproduktion unter dem gemeinsamen Budget:

```sh
/home/aaron/.local/bin/codex-dungeon-job qa -- node tools/build-desktop.mjs
/home/aaron/.local/bin/codex-dungeon-job qa -- node tools/test-desktop-split-knowledge.mjs
```

Linux mit `xdg-dbus-proxy` und isolierter fiktiver Campaign. Der private DBusproxy verhindert ausschließlich im Prüfprozess Chromiums Scopewechsel; Portaldialoge werden hier nicht qualifiziert. Weitere Betriebssysteme, menschliche Zeitvergleiche, unabhängige Zeit-/Reise-/Kampfkombinationen und die Gesamtqualifikation bleiben offen.
