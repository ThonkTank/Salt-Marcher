# Produkttests aus GM-Sicht

Status: Current; offene Ziele sind als solche beschrieben.
Owner: project
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Zusammenhängende Abläufe über die sichtbare Oberfläche prüfen. Die [Lieferwege](../delivery/roadmap.md) und das Abnahmeregister bestimmen die Fachanforderungen.

## Durchführungsregeln

- Eine isolierte GUI-Instanz mit eigenem Testvault und eigener Karte verwenden. produktive Texte und Karten schützen. Hostzugang, Build-Hash, Commit, Fenstergröße, Eingabeart und Testdaten vor dem Lauf erfassen.
- Aufgaben über sichtbare Bedienelemente lösen. Kein direkter Modellaufruf oder DOM-Eingriff, um schwierige Schritte zu umgehen. Diagnose darf anschließend separat erfolgen.
- Erster Durchlauf ohne vorbereitete Klickfolge; Irrwege und Suchzeit zählen. Danach denselben Ablauf mit erlernten Befehlen wiederholen, um Auffindbarkeit und wiederholte Bedienkosten auseinanderzuhalten.
- Eingabe durch Fernsteuerung ausdrücklich kennzeichnen; keine physische Maus-/Touchpadabnahme daraus ableiten. Übertragungszeit und Produktwartezeit unterscheiden; bei fehlender Messbarkeit keine scheinpräzise Latenz behaupten.
- Implementierte Funktionen testen. Fehlende Atlasfunktionen als noch nicht verfügbar markieren; den vereinbarten nahtlosen Zoom ohne erforderlichen Modus-/Kontextwechsel als künftige Anforderung erhalten.
- Ein kleiner Vorbereitungsfall liefert keine Großkartenabnahme. Einen späteren Lauf mit repräsentativ dichter, anonymisierter Karte separat planen.

## GM-UX-01: Ein Abenteuer vorbereiten und leiten

Geplante Testkarte: zwei Ebenen, zwölf Räume, acht Verbindungen, wiederholte Möbel und mindestens sechs verknüpfte Raum-/Featuretexte. Umfang ist eine Testvorgabe, kein bereits vorhandener Produktnachweis.

| Abschnitt | Zusammenhängende Nutzeraufgabe | Zu beobachten |
| --- | --- | --- |
| A – Vorbereitung | Neue Karte anlegen, sechs Räume zeichnen, verbinden, nummerieren und benennen; Raum-Key, Geheimnis und Objektnotiz erfassen; häufig verwendetes Asset suchen und zehnmal platzieren. | Erster Einstieg, Werkzeugwechsel, Suchwege, Wiederholung, Fokus und Auswahl, Verlust des räumlichen Kontexts. |
| B – Ausbau | Zweite Ebene mit weiteren Räumen anlegen; zwischen Ebenen wechseln; ähnliche Einrichtung wiederverwenden; Maße und einen Durchgang nachträglich ändern. | Wiederverwendung, Navigation, persistente Werkzeug-/Suchzustände, Sichtbarkeit wichtiger Aktionen. |
| C – Improvisation | Spieler wählen unerwartet einen anderen Weg: bestimmten Raum und Hinweis finden, Notiz ändern, Durchgang versetzen, Möbel duplizieren; Fehlaktion rückgängig machen und wiederherstellen. | Informationszugriff unter Zeitdruck, Schreib-/Zeichenfokus, Eingabefehler, Undo/Redo-Reichweite, Rückkehr zur vorherigen Ansicht. |
| D – Fortsetzung | Speichern, normal schließen, in frischem Prozess öffnen und denselben Raum samt Notiz, Ebenenzustand und Änderungen wiederfinden; zwei Schritte aus C erneut ausführen. | Verständlicher Speicherzustand, Text-/Linkerhalt, Wiederaufnahme und wiederholte Bedienkosten. |

Die Annahme, dass Raum-/Keyzugriff, Navigation, Auswahl, wiederholtes Platzieren, Undo und Speichern häufig sind, wird zunächst als GM-Aufgabenhypothese dokumentiert. Die Beobachtungszahl innerhalb des Szenarios ist kein Beleg für die Häufigkeit bei allen Nutzern.

## Befunde und Nachweise

Die bestehenden GM-Befunde, Korrekturen und begrenzten Abnahmen stehen in `acceptance.json.gmProductFollowups`. Portable Nachweise bleiben unter [docs/reference](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference), darunter die [Dungeon-am-Ort-Belege](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/atlas-detail-binding-d01/README.md), [Cloud-N04-Prüfung](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference/gm-cloud-n04-20261011/README.md) und [Planner-Fokusprüfung](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference/gm-cloud-manual-planner-pr144-focus-retest-20261011-01/README.md).

Ein Teilablauf bestätigt weder vollständige Originalparität noch physische Eingabe, Großkarten, 100 %-Skalierung oder die gesamte E2E-Kette. Fehlende und widersprüchliche Nachweise bleiben offen.
