# Produkttests aus GM-Sicht

## Auftrag und aktueller Stand

Direkter Nutzerauftrag vom 09.10.2026: das Produkt wie ein Endanwender in längeren Arbeitsabläufen benutzen; Hindernisse, unnötige Umwege, langsame häufige GM-Aktionen und störende selten gebrauchte UI erfassen. Daraus konkrete Nacharbeiten planen, an zuständige Kollegen beauftragen und anschließend erneut im Nutzerablauf prüfen.

GM-UX-01 erster Cloud-Durchlauf teilweise ausgeführt; Laufstand und Belege stehen in `checkpoint.gmProductTesting`. Ein vorläufiger, reproduzierter Bedienkosten-Kandidat GM-UX-001 ist dem Dungeon-Verantwortlichen als GM-UX-N-001 zur Prüfung und kleinen Nacharbeit vorgelegt; Häufigkeit über diesen einzelnen GM-Ablauf hinaus ist noch Hypothese. Nutzerkorrektur vom 09.10.2026: Dieser Arbeitsstrang testet in seiner eigenen Cloud-Umgebung und benötigt keine Laptop-GUI-Slots. Die frühere Anfrage an den lokalen Host-Kollegen entfällt. Ein isolierter Cloud-Obsidian-Host mit eigenem Testvault ist eingerichtet; Editoröffnung und Speichern einer neuen Testkarte wurden über die Oberfläche ausgeführt. Die stündliche Automation folgt diesem Schwerpunkt. Aktuellen Laufzustand ausschließlich in `checkpoint.gmProductTesting` führen.

## Durchführungsregeln

- Eine eigene Cloud-GUI-Instanz mit eigenem Testvault und eigener Karte; unabhängig von lokalen Kollegen und deren GUI-Slots. Repository-Änderungen und Aufgabenbesitz weiter koordinieren; produktive Texte und Karten schützen. Hostzugang, Build-Hash, Commit, Fenstergröße, Eingabeart und Testdaten vor dem Lauf erfassen.
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

## Erster Durchlauf: Teilbefunde und offene Strecke

Am 09.10.2026 im isolierten Obsidian 1.14.4 wurden über die sichtbare Oberfläche sechs Räume in „GM-UX-01 Nebelwacht“ angelegt, eine Wandverbindung und ein Durchgang ergänzt, eine Geheimnisnotiz im Key von Raum 6 eingetragen, gespeichert, zum Layout zurückgekehrt und die Karte frisch geöffnet. Die Notiz und alle sechs nummerierten Räume blieben erhalten. Belege liegen unter `/workspace/scratch/gm-cloud-qa/`. Eingabe über Playwright/CDP, Appfenster 1024×800; keine physische Bedienabnahme. Die noch fehlenden acht Verbindungen, zweites Geschoss, Assetwiederholungen, Spielerimprovisation, Undo/Redo und Spielansicht sind nicht ausgeführt.

**GM-UX-001 · P2 Kandidat · eigene UI-Beobachtung:** Im Rechteckwerkzeug besteht die Raumaufgabe aus Fläche ziehen und anschließend pro Fläche „Raum anlegen“ betätigen. Für sechs Räume wurden zwölf UI-Gesten gezählt, Werkzeugwahl nicht eingerechnet. Bei nicht einzeln abgewarteten Folgezeichnungen blieben zunächst Flächen ohne Raum-Key; mit sichtbarer Berechnung und anschließender Bestätigung ließ sich der Ablauf fertigstellen. Eine Produktlatenz wurde nicht gemessen. Ein erster schneller Durchgang war nicht kontrolliert genug, um eine Eingabeverlust-Störung zu behaupten. GM-Häufigkeit ist eine zu prüfende Annahme.

**GM-UX-N-001 · vorgeschlagener Dungeon-Auftrag:** Optionalen schnellen Rechteck-Raum-Modus prüfen/umsetzen, der nach dem Ziehen direkt einen Raum-Key erzeugt; ausgeschaltet müssen freie Grundflächen weiter möglich sein. Abnahme: sechs Räume in sechs Ziehgesten, genau sechs Keys, keine Doppelanlage, Modus bleibt nach Speichern/Neuöffnen erhalten. Danach denselben GM-UX-01 Abschnitt vergleichen. Zuteilung und Annahme im Koordinationsthread dokumentieren.

**Objekttest offen:** Objektbibliothek zeigte „Keine Objekte“ bei aktivierten „Eingebauten Grundassets“; Assetmanager meldete keine importierten Pakete. Daher sind Such- und Wiederholungsplatzierung mit einem freigegebenen Packdatensatz noch nicht beurteilbar. Das ist derzeit eine Lücke der Testdaten, kein allgemeiner Produktbefund. Screenshot `27-assets-manager.png`, `28-search-door.png`.

## Messung und Befunde

Für jede Aufgabe Anfangs-/Endzustand, sichtbares Ziel, tatsächliche Klicks/Tastendrücke, Dialog-/Werkzeugwechsel, Suchzeit, sichtbare Wartephasen, Fehlversuche und Ergebnis notieren. Verzögerungen durch Teststeuerung separat kennzeichnen. Bei wiederholten Aufgaben einzelne Messwerte und Median berichten; keine Nutzerpopulationsstatistik daraus machen.

Jeder Befund erhält `GM-UX-###`, Build/Commit, Szenario und Schritt, Reproduktionsfolge, erwartetes Nutzerergebnis, beobachtetes Verhalten, Belegpfad und Auswirkung. Kennzeichnen: eigene UI-Beobachtung / Kollegenbeleg / noch ungeprüfte Hypothese. Ein Codeverdacht wird erst nach Reproduktion als Produktbefund geführt.

Für UI-Überladung dokumentieren: konkretes Element, Ort und beanspruchter Platz, ob es in den Aufgaben verwendet wurde und welches häufige Ziel dadurch verdeckt oder schwerer auffindbar ist. Seltene Nutzung allein ist kein Entfernungsgrund. Kontextabhängige Anzeige oder ein weiterhin auffindbarer erweiterter Bereich sind mögliche Nacharbeiten; Erreichbarkeit und Tastaturbedienung müssen erhalten bleiben.

Priorisierung: P0 Daten-/Textverlust oder blockierter Kernablauf; P1 häufig wiederholtes Hindernis mit hohem Zeitverlust bzw. Fehlergefahr; P2 unnötige Umwege oder konkurrierende UI; P3 geringe kosmetische Reibung. Häufigkeit und Zeitverlust mit Beobachtung oder klarer Annahme begründen. Vor Optimierung eine Ausgangsmessung festhalten.

## Aufträge und Nachprüfung

- **GM-UX-CLOUD – dieser Cloud-Arbeitsstrang:** isolierten Obsidian-Host mit eigenem Testvault und bedienbarer Oberfläche einrichten. Ergebnis: dokumentierte Obsidian-Version, Produktbuild, Bildschirmgröße, Eingabeweg und Cloud-Belegpfad. Keine Slotfreigabe oder Laptopverbindung erforderlich. GM-UX-ACCESS ist durch die Nutzerkorrektur aufgehoben.
- **GM-UX-01 – dieser Arbeitsstrang:** ersten Cloud-Produktlauf durchspielen, Belege prüfen und priorisierte Befunde aufbereiten. Kein Ersatz durch wiederholte technische Standardtests.
- **GM-UX-N-### – zuständiger Produktkollege nach Befund:** pro Nacharbeit ein kleiner Auftrag mit Bezug auf GM-UX-ID, Nutzerproblem, begrenztem Änderungsziel, betroffenen Dateien/Komponenten, Priorität, Abhängigkeiten und überprüfbarem Abnahmekriterium. Dungeonverhalten an den Dungeon-Verantwortlichen, Atlas an Hex, Stadt an City; gemeinsame UI einer Person zur Umsetzung geben. Zuteilung im Koordinationsthread ausdrücklich melden und Annahme/Verfügbarkeit erfassen.
- **GM-UX-R-### – dieser Arbeitsstrang:** denselben Nutzerablauf auf dem gelieferten Build wiederholen. Abnahme umfasst erreichtes Nutzerziel, vorher/nachher Bedienkosten, erhaltene Texte/Links, Undo/Redo und Speichern/Neuöffnen soweit betroffen. Bei UI-Verschiebungen auch den seltenen ausgelagerten Befehl wiederfinden und bedienen.

Neue Nacharbeitstickets entstehen aus belegten Befunden. Die Cloud-Testumgebung ist einsatzbereit; keine Produktänderung oder Usability-Abnahme vorgetäuscht. Abschluss eines Tickets erst nach erfolgreicher Nachprüfung, ohne die separaten HEX-/CITY-/Originalparitätsgates zu schließen.
