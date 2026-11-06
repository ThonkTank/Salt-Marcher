# Tutorials und Tastaturkontext

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 15.10.2026. Ergänzt [Gesamtumfang](../../project/requirements/scope.md) und
[Lieferfolge](../../project/delivery/roadmap.md). Program Capabilities L775–789/L813–819,
Revision `9de85c1a26f526acbc1af332ac5962e185c0aab2`, SHA-256
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`:
Tastaturbedienung, skalierbare/lokalisierbare Oberfläche, Tutorials für jede
Fähigkeit und automatischer Start bei Erstinstallation/Update mit Skip.
Campaignprosa bleibt unabhängig von der UI-Sprache.

## Aktueller Ablauf und Grenze

`store.ts.tutorial` hält Runs je tatsächlicher Appversion. Der geprüfte Reader
überschreibt keine korrupten Originals. Finished/Skipped bleiben terminal,
auch nach verspätetem Shown. Aktualisierter Hilfetext startet bei derselben
installierten Appversion keinen neuen Lauf: Run-ID, Abschluss und Überspringen
bleiben erhalten. Die aktuelle Hilfe ist weiterhin manuell erreichbar. Erst eine
neue Appversion erhält ihren eigenen einmaligen Lauf.

Hilfe/Dismiss werden vor der Statusquery gebunden. Der Modal fokussiert seine
Überschrift und gibt Fokus an den Opener zurück; verzögerte oder ausgefallene
Statuswrites halten Dismiss nicht auf. Die Appinitialisierung wartet nicht auf
Tutorialreads. Fehlender Status ist kein bestätigter gespeicherter Abschluss.

`workspace-shortcuts.ts` begrenzt Atlas-Undo/Redo und Partyshortcut: kein
verdeckter Workspace-Undo bei Modal/Popover, in Select/Text/Richtext oder auf
einer anderen Arbeitsfläche. Native Eingabe-Undo bleibt bei ihrem Inputowner.
Die Hilfe beschreibt Karten-/Artanzeige ohne Text-/Mechanikkanal; alte Buttons
und Optionen werden entfernt, nicht durch zusätzliche Lektionen überdeckt.

[desktop-workspace-shortcuts.test.mjs](../../../tests/workspace/desktop-workspace-shortcuts.test.mjs)
prüft diese kontrollierten Kontextgrenzen. Vorhandene Tutorial-/Storeprüfungen
belegen Versionsruns, terminale Zustände und erhaltene Korruption. Das schließt
weder native Tastatur-/IME-/Screenreaderwirkung noch Feature- oder Localeabnahme.

Die ausführbare Tutorialzuordnung bindet Hauptarbeitsbereiche und ausgewählte
statische Kopfzeilenaktionen aus `index.html` an vorhandene Lektionen, darunter
Monstergruppen und Schätze. Weitere Einstiege decken Sessiongenerierung,
Kampfabschluss/Rewards, HP/Zustände, XP/Rastbudget, persönliche Beute, Live-Momente,
Regelpanel/Proben, Spieleranzeige/Freigaben, Hex-/Reisewerkzeuge, Stadtplanung,
Weltbeziehungen und erweiterte Dungeonwerkzeuge
ab. NSC-Profile, Monstergruppen und Verhalten haben eigene Lektionen für Suche,
Weltidentität, Entwurf/Verwerfen und die Vorbereitung ohne Kampfstart.
Zusammenhänge erklärt Navigation und den Sprung in den vorhandenen Quelleneditor.
Ausdrücklich reziproke Beziehungen verlangen zwei Labels, ändern beide World-Notizen
atomar und besitzen eine eigene Paar-History. Rückgängig/Wiederholen invertiert nur
diese Kanten; eine spätere Änderung an einer beteiligten Notiz sperrt den Schritt.
Die Paar-History ist weder Atlas- noch City-History.
Elternteil/Kind, Geschwister und Partner werden ausdrücklich als Paar typisiert.
Die Familienansicht filtert nur diese Metadaten; freie Beziehungsnamen bleiben
unverändert in der Gesamtansicht und werden nicht semantisch interpretiert.
Textverweise erklären Anzeigenamen, Quellnavigation und die Suche nach verknüpften Begriffen.
Die Stadtlektionen unterscheiden den offenen Zeichenzug, die ausdrücklich
übernommene Bebauungsvorschau und die geschützte Einzelbearbeitung samt Ausgabe.
Die Innenraumhülle enthält noch keine modellierten Räume oder Tagespläne;
Bewohner bleiben als World-NPC-Verweise am Gebäude gebunden.
Volumen, Trigger/Fallenlaufzustand, Dungeon-Inhalte, Graphentwurf, Key-Ausgabe
und gerichtete Passagen haben eigene Ablauflektionen mit Vorschau, Bestätigung
und ihren jeweiligen Grenzen.
F1 öffnet dieselbe Hilfe mit der Lektion des fokussierten Bedienelements oder
seines nächsten zugeordneten Containers zuerst. Ohne solche Zuordnung gilt der
Arbeitsbereich. Suche und Schließen verändern keine Fachentwürfe; Schließen gibt
den Fokus an das ursprüngliche Bedienelement zurück, auch über einem anderen Dialog.
Der Hilfe-Button bleibt der allgemeine Einstieg zum Arbeitsbereich.
`tools/test-desktop-context-help.mjs` führt diesen Weg mit unfertiger Notiz,
Themensuche, verschachteltem Einstellungsdialog und Neustart aus; die Probe
verwendet tatsächlichen Browserzoom bei 100 Prozent. Sie ersetzt keine
vollständige Tutorial-, Sprach- oder Screenreaderabnahme.

Die Zuordnung steht im Code; dynamische Controls wie Journal und Schnellsuche
brauchen zusätzliche Zuordnungsprüfungen. Eine zugeordnete Lektion belegt noch
keine verständliche Erklärung jeder Unterfähigkeit oder native Bedienbarkeit.

## Nächste konkrete Prüfungen

1. Nativ bestätigten Roomedit, Hilfe/Modal, Strg/Meta+Z und Alt+P prüfen: History
   bleibt geschützt; nach Dismiss funktionieren Workspace-Undo/Redo wieder.
   Party/Daypopover, Select/Richtext, Escape, Fokus und 100 % gesondert bedienen.
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

Die Musiklektionen erfassen Datei-/Transferfehler, manuelle Wiedergabe,
Automatikfreigabe und Soundboard; deren native Bedienung bleibt zu prüfen.

Weltquellen und Spielabendvorbereitung haben eigene Lektionen; Kalenderereignisse
verwenden durchgehend die Agenda statt des entfernten zweiten Ereigniseditorformulars.

Party-, Archiv-, Gruppen-, Zeit-, Szenentisch-, Kampf- und Verfolgungseinstiege
sind konkreten Lektionen zugeordnet; Live-Recovery und der Szenentisch werden
eigens erklärt. Die Testfixture konstruiert auch die dynamische Welt- und NSC-Oberfläche.

Katalogsuche, Kreatur-/Begegnungsfilter und manuelle Encounterplanung haben
konkrete Lektionen; die Zuordnung bleibt im bestehenden Tutorialcode.

Die konsolidierte Lehrrevision `desktop-tutorial-city-family-projection-v83` enthält die integrierten
Beziehungs-, Stadt- und Übergabelektionen. Neue Lessonrevisionen archivieren
die früheren Läufe; die Lehrabdeckung bleibt eine Teilprüfung des Produkts.

Die Party- und Tagesrechner-Popups teilen den
[verankerten Popuphost](../architecture/anchored-popup.md). Native Auto-Popovers führen Escape,
Außenklick und Fokusrückgabe; die Fachbereiche behalten ihre Aktionen.
