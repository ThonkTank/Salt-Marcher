# Spielprotokoll zu wiederverwendbaren Originalnotizen

Geprüft am 18.10.2026: SaltMarcher auf `eb2f589422d07e22b6e157494bc56bbd07984fe5`
mit den in `results.json` bezeichneten Änderungen; Obsidian 1.14.4 mit eigenem Vault.
Die UI-Bundlehashes und normalen Prozessenden stehen im [Ergebnis](results.json).

Die reale Aufgabe ergänzt eine vorhandene Fährfrau aus einem Rohprotokoll,
übernimmt einen weiteren Absatz als Quest, verbindet die Quellen mit einem
neuen Spielabend und prüft nach normalem Schließen/frischem Start Volltextsuche,
Weiterbearbeitung und aktualisierte Abendinhalte. Das Rohprotokoll bleibt in
SaltMarcher bytegleich; NSC und bisheriger Text behalten ihre Identität.

Vorher war die Übernahme unter „Textwerkzeuge“ verborgen. Jetzt erscheint die
Aktion an der Auswahl, mit Tab erreichbar und auch bei 200 % über der Musikleiste.
Der Dialog sucht zuerst nach dem Original; ein gewähltes Original braucht keine
Artwahl. [Vorher](before.png) · [Nachher bei 200 %](after-200.png).

In [Obsidian nach frischem Öffnen](obsidian-fresh.png) gelang dieselbe Aufgabe
mit Kopieren/Einfügen, Wechsel zum vorhandenen Original, manuellen Herkunftslinks
und drei Einbettungen für den nächsten Abend. Die automatische Verknüpfung im
SaltMarcher-Writer spart diese Arbeit bereits; sie wurde beibehalten.

Die beiden bestehenden nativen Prüfungen für neue und vorhandene Auszüge liefen
mit `GM_QA_ZOOM=2` vollständig durch. Zusätzlich wurden Auswahl/Abbruch für beide
Textfelder im eingebetteten Mappeneditor geprüft. Dies ist eine native Quellbuild-
Bedienprobe, keine Paketinstallation und keine menschliche Produktabnahme.
