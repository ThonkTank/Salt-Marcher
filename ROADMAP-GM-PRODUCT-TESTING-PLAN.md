# Produkttests aus GM-Sicht

## Auftrag und aktueller Stand

Direkter Nutzerauftrag vom 09.10.2026: das Produkt wie ein Endanwender in längeren Arbeitsabläufen benutzen; Hindernisse, unnötige Umwege, langsame häufige GM-Aktionen und störende selten gebrauchte UI erfassen. Daraus konkrete Nacharbeiten planen, an zuständige Kollegen beauftragen und anschließend erneut im Nutzerablauf prüfen.

GM-UX-01 ist geplant, noch nicht ausgeführt. Es liegen aus diesem Arbeitsstrang keine beobachteten Usability-Befunde vor. Aktueller Blocker: In diesem Workspace ist kein bedienbarer Obsidian-Host verfügbar. Der lokale Host-Kollege wurde in [Koordination #1](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6080090197) mit Slot-/Zugangsabstimmung beauftragt. Die stündliche Automation folgt diesem Schwerpunkt. Aktuellen Laufzustand ausschließlich in `checkpoint.gmProductTesting` führen.

## Durchführungsregeln

- Eine GUI-Instanz, reservierte Slots respektieren. Eigener Testvault und eigene Karte; produktive Texte und Karten schützen. Hostzugang, Build-Hash, Commit, Fenstergröße, Eingabeart und Testdaten vor dem Lauf erfassen.
- Aufgaben über sichtbare Bedienelemente lösen. Kein direkter Modellaufruf oder DOM-Eingriff, um schwierige Schritte zu umgehen. Diagnose darf anschließend separat erfolgen.
- Erster Durchlauf ohne vorbereitete Klickfolge; Irrwege und Suchzeit zählen. Danach denselben Ablauf mit erlernten Befehlen wiederholen, um Auffindbarkeit und wiederholte Bedienkosten auseinanderzuhalten.
- Eingabe durch Fernsteuerung ausdrücklich kennzeichnen; keine physische Maus-/Touchpadabnahme daraus ableiten. Übertragungszeit und Produktwartezeit unterscheiden; bei fehlender Messbarkeit keine scheinpräzise Latenz behaupten.
- Implementierte Funktionen testen. Fehlende Atlasfunktionen als noch nicht verfügbar markieren; den vereinbarten nahtlosen Zoom ohne erforderlichen Modus-/Kontextwechsel als künftige Anforderung erhalten.
- Ein kleiner Vorbereitungsfall liefert keine Großkartenabnahme. Einen späteren Lauf mit repräsentativ dichter, anonymisierter Karte separat planen.

## GM-UX-01: Ein Abenteuer vorbereiten und leiten

Geplante Testkarte: zwei Ebenen, zwölf Räume, acht Verbindungen, wiederholte Möbel und mindestens sechs verknüpfte Raum-/Featuretexte. Umfang ist eine Testvorgabe, kein bereits vorhandener Produktnachweis. Reservierung etwa 45–60 Minuten; bei Hindernissen den tatsächlichen Abbruchpunkt dokumentieren, keine Schritte still auslassen.

| Abschnitt | Zusammenhängende Nutzeraufgabe | Zu beobachten |
| --- | --- | --- |
| A – Vorbereitung | Neue Karte anlegen, sechs Räume zeichnen, verbinden, nummerieren und benennen; Raum-Key, Geheimnis und Objektnotiz erfassen; häufig verwendetes Asset suchen und zehnmal platzieren. | Erster Einstieg, Werkzeugwechsel, Suchwege, Wiederholung, Fokus und Auswahl, Verlust des räumlichen Kontexts. |
| B – Ausbau | Zweite Ebene mit weiteren Räumen anlegen; zwischen Ebenen wechseln; ähnliche Einrichtung wiederverwenden; Maße und einen Durchgang nachträglich ändern. | Wiederverwendung, Navigation, persistente Werkzeug-/Suchzustände, Sichtbarkeit wichtiger Aktionen. |
| C – Improvisation | Spieler wählen unerwartet einen anderen Weg: bestimmten Raum und Hinweis finden, Notiz ändern, Durchgang versetzen, Möbel duplizieren; Fehlaktion rückgängig machen und wiederherstellen. | Informationszugriff unter Zeitdruck, Schreib-/Zeichenfokus, Eingabefehler, Undo/Redo-Reichweite, Rückkehr zur vorherigen Ansicht. |
| D – Fortsetzung | Speichern, normal schließen, in frischem Prozess öffnen und denselben Raum samt Notiz, Ebenenzustand und Änderungen wiederfinden; zwei Schritte aus C erneut ausführen. | Verständlicher Speicherzustand, Text-/Linkerhalt, Wiederaufnahme und wiederholte Bedienkosten. |

Die Annahme, dass Raum-/Keyzugriff, Navigation, Auswahl, wiederholtes Platzieren, Undo und Speichern häufig sind, wird zunächst als GM-Aufgabenhypothese dokumentiert. Die Beobachtungszahl innerhalb des Szenarios ist kein Beleg für die Häufigkeit bei allen Nutzern.

## Messung und Befunde

Für jede Aufgabe Anfangs-/Endzustand, sichtbares Ziel, tatsächliche Klicks/Tastendrücke, Dialog-/Werkzeugwechsel, Suchzeit, sichtbare Wartephasen, Fehlversuche und Ergebnis notieren. Verzögerungen durch Teststeuerung separat kennzeichnen. Bei wiederholten Aufgaben einzelne Messwerte und Median berichten; keine Nutzerpopulationsstatistik daraus machen.

Jeder Befund erhält `GM-UX-###`, Build/Commit, Szenario und Schritt, Reproduktionsfolge, erwartetes Nutzerergebnis, beobachtetes Verhalten, Belegpfad und Auswirkung. Kennzeichnen: eigene UI-Beobachtung / Kollegenbeleg / noch ungeprüfte Hypothese. Ein Codeverdacht wird erst nach Reproduktion als Produktbefund geführt.

Für UI-Überladung dokumentieren: konkretes Element, Ort und beanspruchter Platz, ob es in den Aufgaben verwendet wurde und welches häufige Ziel dadurch verdeckt oder schwerer auffindbar ist. Seltene Nutzung allein ist kein Entfernungsgrund. Kontextabhängige Anzeige oder ein weiterhin auffindbarer erweiterter Bereich sind mögliche Nacharbeiten; Erreichbarkeit und Tastaturbedienung müssen erhalten bleiben.

Priorisierung: P0 Daten-/Textverlust oder blockierter Kernablauf; P1 häufig wiederholtes Hindernis mit hohem Zeitverlust bzw. Fehlergefahr; P2 unnötige Umwege oder konkurrierende UI; P3 geringe kosmetische Reibung. Häufigkeit und Zeitverlust mit Beobachtung oder klarer Annahme begründen. Vor Optimierung eine Ausgangsmessung festhalten.

## Aufträge und Nachprüfung

- **GM-UX-ACCESS – lokaler Hex-/Host-Kollege, mit Stadt-Kollegen abstimmen:** freien Produkttestslot und erreichbaren Bedienzugang bereitstellen. Ergebnis: isolierter Testvault, identifizierter Build, dokumentierte Eingabeart und Slotbestätigung. Falls kein direkter Zugriff möglich ist, lokalen Szenariolauf ausdrücklich als Kollegenlauf übernehmen und Belege liefern.
- **GM-UX-01 – dieser Arbeitsstrang:** ersten erreichbaren Produktslot durchspielen, Belege prüfen und priorisierte Befunde aufbereiten. Kein Ersatz durch wiederholte technische Standardtests.
- **GM-UX-N-### – zuständiger Produktkollege nach Befund:** pro Nacharbeit ein kleiner Auftrag mit Bezug auf GM-UX-ID, Nutzerproblem, begrenztem Änderungsziel, betroffenen Dateien/Komponenten, Priorität, Abhängigkeiten und überprüfbarem Abnahmekriterium. Dungeonverhalten an den Dungeon-Verantwortlichen, Atlas an Hex, Stadt an City; gemeinsame UI einer Person zur Umsetzung geben. Zuteilung im Koordinationsthread ausdrücklich melden und Annahme/Verfügbarkeit erfassen.
- **GM-UX-R-### – dieser Arbeitsstrang:** denselben Nutzerablauf auf dem gelieferten Build wiederholen. Abnahme umfasst erreichtes Nutzerziel, vorher/nachher Bedienkosten, erhaltene Texte/Links, Undo/Redo und Speichern/Neuöffnen soweit betroffen. Bei UI-Verschiebungen auch den seltenen ausgelagerten Befehl wiederfinden und bedienen.

Neue Nacharbeitstickets entstehen aus belegten Befunden. Gegenwärtig ist nur der Zugangs-/Testvorbereitungsauftrag erteilt; keine Produktänderung oder Usability-Abnahme vorgetäuscht. Abschluss eines Tickets erst nach erfolgreicher Nachprüfung, ohne die separaten HEX-/CITY-/Originalparitätsgates zu schließen.
