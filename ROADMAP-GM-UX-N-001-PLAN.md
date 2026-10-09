# GM-UX-N-001: Räume mit einem Rechteckzug anlegen

Planlauf vom 09.10.2026. Der [Cloud-GM-Test](ROADMAP-GM-PRODUCT-TESTING-PLAN.md) beobachtete bei sechs Räumen sechs Rechteckzüge und sechs zusätzliche Klicks auf „Raum anlegen“. Das ist ein P2-Bedienkostenkandidat aus einem Testlauf; weder Produktlatenz noch Eingabeverlust sind belegt. Der Dungeon-Verantwortliche hat die Nacharbeit in [Issue #1](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6080496136) übernommen. Dieser Plan ändert noch kein Produkt.

## Umsetzungslauf

1. Beim Rechteckwerkzeug eine ausdrücklich zuschaltbare Option „Raum-Key beim Zeichnen anlegen“ anbieten. Standard bleibt der bisherige freie Boden. Der Zustand gehört zu den persistenten Werkzeugvorgaben, damit er nach einem neuen Obsidian-Start wiederkehrt.
2. Bei aktivierter Option erzeugt ein abgeschlossener, nicht radierender Rechteckzug eine eigenständige V4-Raumfläche mit Nummer und leerem strukturiertem Key. Berührende Räume müssen getrennt bleiben. Fläche, Raum und zugehörige Zellen werden in einem einzigen History-Befehl angelegt; Abbruch oder ungültige Geste erzeugen keinen Key. Radieren und alle anderen Bodenwerkzeuge behalten ihr Verhalten.
3. Die asynchrone Flächenberechnung darf schnelle Folgegesten nicht verschlucken oder doppelt ausführen. Die Bedienoberfläche muss den laufenden Vorgang klar anzeigen; gezielte Tests prüfen die Reihenfolge. Andere Raum- und Portalbefehle dürfen nicht beschädigt werden.

## Abnahme und getrennte Läufe

Im isolierten Obsidian-Host sechs Rechtecke mit sechs Ziehgesten erstellen: sechs nummerierte Räume, sechs Keys, keine Doppelanlage und kein zusätzlicher Bestätigungsklick. Einen Raum per Undo entfernen und per Redo wiederherstellen. Save und frische Neuöffnung erhalten Geometrie, Key-Anzahl und eingeschaltete Option. Nach Abschalten erzeugt derselbe Zug wieder eine freie Bodenfläche, die sich weiterhin manuell als Raum übernehmen lässt. Relevante Unit-Regressionen sowie `npm run check`, `npm test` und `npm run build` ergänzen diesen Hostlauf. Die Produktänderung und ihr unabhängiger Review sind getrennte Arbeitspakete. Danach wiederholt der Cloud-GM-Kollege denselben GM-UX-01-Abschnitt; erst dessen Nachtest entscheidet über GM-UX-N-001. Dungeondraft-Parität und die übrigen GM-/Atlas-Tore bleiben davon unberührt.
