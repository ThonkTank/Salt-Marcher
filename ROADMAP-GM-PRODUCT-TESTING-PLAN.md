# Produkttests aus GM-Sicht

Zusammenhängende Abläufe über die sichtbare Oberfläche prüfen. Die [Lieferwege](docs/ROADMAP.md) und das Abnahmeregister bestimmen die Fachanforderungen. Die folgenden Szenarien sind Testquellen, keine wiederkehrenden Agentenaufträge.

## Durchführungsregeln

- Eine isolierte GUI-Instanz mit eigenem Testvault und eigener Karte verwenden. produktive Texte und Karten schützen. Hostzugang, Build-Hash, Commit, Fenstergröße, Eingabeart und Testdaten vor dem Lauf erfassen.
- Aufgaben über sichtbare Bedienelemente lösen. Kein direkter Modellaufruf oder DOM-Eingriff, um schwierige Schritte zu umgehen. Diagnose darf anschließend separat erfolgen.
- Erster Durchlauf ohne vorbereitete Klickfolge; Irrwege und Suchzeit zählen. Danach denselben Ablauf mit erlernten Befehlen wiederholen, um Auffindbarkeit und wiederholte Bedienkosten auseinanderzuhalten.
- Eingabe durch Fernsteuerung ausdrücklich kennzeichnen; keine physische Maus-/Touchpadabnahme daraus ableiten. Übertragungszeit und Produktwartezeit unterscheiden; bei fehlender Messbarkeit keine scheinpräzise Latenz behaupten.
- Implementierte Funktionen testen. Fehlende Atlasfunktionen als noch nicht verfügbar markieren; den vereinbarten nahtlosen Zoom ohne erforderlichen Modus-/Kontextwechsel als künftige Anforderung erhalten.
- Ein kleiner Vorbereitungsfall liefert keine Großkartenabnahme. Einen späteren Lauf mit repräsentativ dichter, anonymisierter Karte separat planen.

## GM-UX-01: Ein Abenteuer vorbereiten und leiten

Geplante Testkarte: zwei Ebenen, zwölf Räume, acht Verbindungen, wiederholte Möbel und mindestens sechs verknüpfte Raum-/Featuretexte. Umfang ist eine Testvorgabe, kein bereits vorhandener Produktnachweis. Geplante Laufdauer etwa 45–60 Minuten; bei Hindernissen den tatsächlichen Abbruchpunkt dokumentieren, keine Schritte still auslassen.

| Abschnitt | Zusammenhängende Nutzeraufgabe | Zu beobachten |
| --- | --- | --- |
| A – Vorbereitung | Neue Karte anlegen, sechs Räume zeichnen, verbinden, nummerieren und benennen; Raum-Key, Geheimnis und Objektnotiz erfassen; häufig verwendetes Asset suchen und zehnmal platzieren. | Erster Einstieg, Werkzeugwechsel, Suchwege, Wiederholung, Fokus und Auswahl, Verlust des räumlichen Kontexts. |
| B – Ausbau | Zweite Ebene mit weiteren Räumen anlegen; zwischen Ebenen wechseln; ähnliche Einrichtung wiederverwenden; Maße und einen Durchgang nachträglich ändern. | Wiederverwendung, Navigation, persistente Werkzeug-/Suchzustände, Sichtbarkeit wichtiger Aktionen. |
| C – Improvisation | Spieler wählen unerwartet einen anderen Weg: bestimmten Raum und Hinweis finden, Notiz ändern, Durchgang versetzen, Möbel duplizieren; Fehlaktion rückgängig machen und wiederherstellen. | Informationszugriff unter Zeitdruck, Schreib-/Zeichenfokus, Eingabefehler, Undo/Redo-Reichweite, Rückkehr zur vorherigen Ansicht. |
| D – Fortsetzung | Speichern, normal schließen, in frischem Prozess öffnen und denselben Raum samt Notiz, Ebenenzustand und Änderungen wiederfinden; zwei Schritte aus C erneut ausführen. | Verständlicher Speicherzustand, Text-/Linkerhalt, Wiederaufnahme und wiederholte Bedienkosten. |

Die Annahme, dass Raum-/Keyzugriff, Navigation, Auswahl, wiederholtes Platzieren, Undo und Speichern häufig sind, wird zunächst als GM-Aufgabenhypothese dokumentiert. Die Beobachtungszahl innerhalb des Szenarios ist kein Beleg für die Häufigkeit bei allen Nutzern.

## Befunde und Nachweise

Die bestehenden GM-Befunde, Korrekturen und begrenzten Abnahmen stehen in `acceptance.json.gmProductFollowups`. Portable Nachweise bleiben unter [docs/reference](docs/reference/), darunter die [Dungeon-am-Ort-Belege](docs/reference/atlas-detail-binding-d01/README.md), [Cloud-N04-Prüfung](docs/reference/gm-cloud-n04-20261011/README.md) und [Planner-Fokusprüfung](docs/reference/gm-cloud-manual-planner-pr144-focus-retest-20261011-01/README.md).

Ein Teilablauf bestätigt weder vollständige Originalparität noch physische Eingabe, Großkarten, 200-Prozent-Skalierung oder die gesamte E2E-Kette. Fehlende und widersprüchliche Nachweise bleiben offen.

Frühere einzelne Beobachtungen und Laufbelege bleiben im [Checkpoint vor der Bereinigung](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/6a90f3ee2f50f0be45f0e256784576f13722c319/checkpoint.json) zugänglich; sie sind keine aktuellen Aufgaben oder Gesamtfreigaben.

## Historische Checkpoint-Belege

Diese beiden abgeschlossenen Berichte werden als direkte Belegverweise erhalten; sie liefern keine aktuellen Agentenaufträge oder zusätzlichen Produktfreigaben.

| Bericht | Gebundener Befund und Grenze |
| --- | --- |
| [Dungeon-am-Ort #89](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/89), [Checkpoint `59bb5bb`](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/59bb5bb2771bf27ab58f867b5ae9080ab50f77b2/checkpoint.json), [Verbrauchsbericht](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80#issuecomment-6103561640) | Begrenzter sichtbarer Cloud-GM-PASS auf Produkt-SHA `a454d9a708f54c4dddc755786653cb8155cbe29e`: Dungeon nach Torheim verorten, Raum-Key ändern, speichern und dieselbe Datei im selben Prozess wieder öffnen. Kein Frischprozessnachweis; späterer Shared `d9eda92` wurde wegen ENOSPC nicht neu gebaut. Rohbilder lagen nur im Cloud-Workspace und wurden lokal nicht unabhängig geprüft. |
| [City-Rotation #129](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/129), [Checkpoint `7be3fa5`](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/7be3fa5dc3d806d1d1fe305ad31353fc26976c8e/checkpoint.json) | Kandidat `31afa4cec498446509f1a796b69eed4f0e84f148` gebaut; isolierter Host durch volles Cloud-Root blockiert. Keine Plugininstallation, keine sichtbare City-Bedienung und keine Nutzungsabnahme. Spätere [Rotation-H02-Belege](docs/reference/city-building-rotation-h02/receipt.json) sind ein eigener Nachweis und erweitern diesen abgebrochenen Lauf nicht rückwirkend. |
