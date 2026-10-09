# GM-UX-N-002: Objekte beim Tippen finden und Suche leeren

Planlauf vom 09.10.2026 zum [GM-Produkttest](ROADMAP-GM-PRODUCT-TESTING-PLAN.md) und [Koordinationsbefund](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6082352187). Im Cloud-GM-Lauf blieben bei „Wooden Crate“ und „Oak Barrel“ die drei Bibliothekskacheln bis Enter sichtbar. × leerte danach das Feld, ließ aber den angewandten Treffer stehen. Der reproduzierte P2-Befund ist auf Suche und Leeren begrenzt; Dungeondraft-Originalbelege und die Papierkorbregel `DD-026.07` bleiben erhalten.

## Umsetzung

1. Im hostneutralen Suchzustand setzt jede Texteingabe die wirksame Anfrage sofort. Leere Eingabe hebt den Textfilter auf. Enter darf dieselbe Anfrage weiter anwenden. Der Fuzzy/Exact-Regler behält seinen bisher gesondert bestätigten Anwendungszeitpunkt.
2. Im Objektbibliothek-Panel aktualisiert Eingabe die sichtbaren Kacheln ohne Fokusverlust. × leert Text und wirksamen Filter und zeigt alle Kacheln; „Suche zurücksetzen“ behält die eigene Originalwirkung mit stehendem Suchtext. Used, Tags, Auswahl und Platzierung bleiben bedienbar.
3. Gezielte Zustands- und UI-Regressionen prüfen drei unterscheidbare Assets, unmittelbaren Wechsel zwischen zwei Namen, ×, Papierkorb, Tagfilter und Kachelauswahl. Ein isolierter Hostlauf platziert danach zehn Objekte, nimmt die letzte Platzierung zurück und stellt sie wieder her; Save und frische Öffnung erhalten alle zehn. Typprüfung, Kerntests und Build ergänzen den GUI-Nachweis.

## Review und Grenze

Umsetzung und unabhängiger Review laufen getrennt. Der Cloud-Befund wird auf dem integrierten Build einem weiter zuständigen Produkttester zur Nachprüfung angeboten; der konkret abgelöste Cloud-GM-Strang bleibt gemäß Koordinationsentscheidung auf Architektur-/Technikreview beschränkt. Dieser P2-Fix gibt weder Dungeon-Parität noch Atlas- oder Plattform-ADR-Tore frei. Die Suchzustandslogik bleibt hostneutral für die künftige Desktop-Shell.
