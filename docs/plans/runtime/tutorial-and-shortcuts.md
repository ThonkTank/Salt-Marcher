# Tutorials und Tastaturkontext

Stand: 14.10.2026. Ergänzt [Gesamtumfang](../../SCOPE.md) und
[Lieferfolge](../../ROADMAP.md). Program Capabilities L775–789/L813–819,
Revision `9de85c1a26f526acbc1af332ac5962e185c0aab2`, SHA-256
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`:
Tastaturbedienung, skalierbare/lokalisierbare Oberfläche, Tutorials für jede
Fähigkeit und automatischer Start bei Erstinstallation/Update mit Skip.
Campaignprosa bleibt unabhängig von der UI-Sprache.

## Aktueller Ablauf und Grenze

`store.ts.tutorial` hält Runs je tatsächlicher Appversion. Der geprüfte Reader
überschreibt keine korrupten Originals. Finished/Skipped bleiben terminal,
auch nach verspätetem Shown. Eine neue Lessonrevision archiviert den ursprünglichen Run samt Originalbytes
unter seiner Run-ID und beginnt auch bei gleicher Appversion einen neuen
optionalen Lauf; frühere Abschlüsse bleiben erhalten.

Hilfe/Dismiss werden vor der Statusquery gebunden. Der Modal fokussiert seine
Überschrift und gibt Fokus an den Opener zurück; verzögerte oder ausgefallene
Statuswrites halten Dismiss nicht auf. Die Appinitialisierung wartet nicht auf
Tutorialreads. Fehlender Status ist kein bestätigter gespeicherter Abschluss.

`workspace-shortcuts.ts` begrenzt Atlas-Undo/Redo und Partyshortcut: kein
verdeckter Workspace-Undo bei Modal/Popover, in Select/Text/Richtext oder auf
einer anderen Arbeitsfläche. Native Eingabe-Undo bleibt bei ihrem Inputowner.
Die Hilfe beschreibt Karten-/Artanzeige ohne Text-/Mechanikkanal; alte Buttons
und Optionen werden entfernt, nicht durch zusätzliche Lektionen überdeckt.

[desktop-workspace-shortcuts.test.mjs](../../../tests/desktop-workspace-shortcuts.test.mjs)
prüft diese kontrollierten Kontextgrenzen. Vorhandene Tutorial-/Storeprüfungen
belegen Versionsruns, terminale Zustände und erhaltene Korruption. Das schließt
weder native Tastatur-/IME-/Screenreaderwirkung noch Feature- oder Localeabnahme.

Die ausführbare Tutorialzuordnung bindet Hauptarbeitsbereiche und ausgewählte
statische Kopfzeilenaktionen aus `index.html` an vorhandene Lektionen, darunter
Monstergruppen und Schätze. Weitere Einstiege decken Sessiongenerierung,
Kampfabschluss/Rewards, HP/Zustände, XP/Rastbudget, persönliche Beute, Live-Momente,
Regelpanel/Proben, Spieleranzeige/Freigaben, Hex-/Reisewerkzeuge, Stadtplanung,
Weltbeziehungen und erweiterte Dungeonwerkzeuge
ab. Die Zuordnung steht im Code; dynamische Controls wie Journal und Schnellsuche
brauchen zusätzliche Zuordnungsprüfungen. Eine zugeordnete Lektion belegt noch
keine verständliche Erklärung jeder Unterfähigkeit oder native Bedienbarkeit.

## Nächste konkrete Prüfungen

1. Nativ bestätigten Roomedit, Hilfe/Modal, Strg/Meta+Z und Alt+P prüfen: History
   bleibt geschützt; nach Dismiss funktionieren Workspace-Undo/Redo wieder.
   Party/Daypopover, Select/Richtext, Escape, Fokus und 200 % gesondert bedienen.
2. Lektionen gegen tatsächlich sichtbare Aktionen und SCOPE prüfen: Anlegen,
   Datenwirkung, Fehler und Wiederaufnahme je Nutzerweg. Neue Sessionmappe,
   NPC-Suche, Ortsfreigabe und Quellenstatus korrekt erklären; Installation, Rechteannahme, Widerruf und schreibfreie Reparatur von
   Extensions erklären; noch fehlenden Inhaltseditor nicht als verfügbar darstellen.
3. Tutorial und gemeinsame Status-/Actionlabels zuerst in einen kleinen
   UI-Textkatalog führen; deutsche Basis und eine zusätzliche Sprache mit
   Textexpansion, Zahlen/Datum, Pending und Sprachwechsel prüfen. Prosa, IDs,
   Markdownlinks, Paketbytes und History bleiben unverändert.
4. Native Versionsänderung, alter terminaler Run, korrupter Record, hängender
   initialer Read und Help vor Antwort prüfen. Linux/Windows/macOS, Kontrast,
   Nicht-Farbsignale und Laptoplayout benötigen ihre betroffenen Abnahmen.

Die Einstiege für Gegenstände und Shops erklären Definitionen, Bestand und
Handel; Schatzverwaltung und gemeinsame Verteilung bleiben eigene Lektionen.
Native Bedienung dieser neuen Lektionen ist weiterhin separat zu prüfen.
