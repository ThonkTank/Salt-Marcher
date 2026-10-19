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

## Vorhandenen Abend bewusst wählen · 19.10.2026

Erneute vollständige Aufgabe auf `5c4a6a95d9b5d37a1a28c019be5558e288e6d0db`
plus den durch Bundlehashes bezeichneten Änderungen: drei Protokollabsätze
übernehmen, die vorhandene Siv ergänzen, Varo als NSC und den Schrank als Quest
anlegen; die drei Originale im zweiten Besuch des vorhandenen Abends 13 lesen,
normal schließen und nach frischem Start Varo am Original weiterbearbeiten.
Der alte Abend 11 und der erste Besuch von Abend 13 bleiben unverändert.

Der [Ausgangsstand](before-visit-target.png) wählte aus der reinen Wissensarbeit
unbegründet den ersten historischen Abend und dessen ersten Besuch vor.
Im tatsächlichen Durchlauf wurde diese Auswahl vor dem Schreiben korrigiert;
es wurde kein versehentliches Überschreiben beobachtet. Die Store-/DOMgegenprobe
belegt, dass ohne diese Korrektur ein Schreiben an das alte Ziel möglich war.

Jetzt übergibt die Vorbereitung nur einen tatsächlich geöffneten Planungskontext.
Ohne diesen Kontext bleibt das Ziel unbestimmt; für einen neuen Abend müssen
Name und Besuch eingegeben werden. Vorschläge sind
[bei 200 % sichtbare Platzhalter](after-visit-target-200.png).
Ein gewählter anderer Abend wählt nicht automatisch dessen ersten Besuch.
Ein zuvor bewusst geöffneter Besuch bleibt beim Wechsel zu den Quellen erhalten.
Die drei Quellen sind weiterhin einzeln wählbar; die Rohprotokollübersicht wurde
für diese Aufgabe abgewählt, damit der Abend die Informationen nicht doppelt zeigt.

`tools/test-desktop-protocol-visit.mjs` führt diesen Gesamtweg bei 100 % und
200 % aus, einschließlich Abweisen eines noch unbenannten Ziels, Auswahl des
zweiten Besuchs, [Weiterbearbeitung nach Neustart](visit-fresh-further-edit.png)
und Erhalt des bekannten Planungskontexts. Kanonisch geprüft sind exakte
Protokollbytes, ursprüngliche CRLF-Texte von Siv und beiden Plänen, die drei
Herkunftsbeziehungen und ausschließlich die beabsichtigten drei Original-IDs
am zweiten Besuch. Vier normale Prozessenden in den beiden abschließenden
Durchläufen; zusätzlich zwei normale Prozessenden im Ausgangsstand.

Derselbe vollständige Weg gelang in Obsidian 1.14.4 mit isoliertem Vault:
Absätze kopieren, vorhandene Siv öffnen und ergänzen, zwei neue Dateien benennen,
Art als Text eintragen, Herkunftslinks manuell ergänzen und drei Originale unter
dem zweiten Besuch des vorhandenen Abends einbetten. Nach normalem Schließen
und frischem Start wurde Varo am Original ergänzt und die aktualisierte
[Einbettung wieder gelesen](obsidian-existing-visit-fresh.png).
Das installierte `app.asar` lief unter Test-Electron 44.7.0; die Flatpak-Startkette
ist damit nicht qualifiziert. Obsidian normalisierte den bearbeiteten Siv-Text
auf LF; das unberührte Rohprotokoll blieb bytegleich.

Die zusätzliche Korrektur einer unbegründeten historischen Zielvorgabe entfällt.
Originalsuche, neue Namen/Arten und das beabsichtigte Ziel bleiben fachlich nötige
Entscheidungen. Der Vergleich belegt diese ausgeführte Aufgabe, keine allgemeine
Überlegenheit oder menschliche GM-Abnahme. Versionen, Inhalte, IDs, Bundlehashes
und Prozessenden stehen in [visit-target-results.json](visit-target-results.json).
Die vollständige Aufgabe ist als native Quellbuild-Bedienprobe geprüft;
Paketinstallation und Owner-Abnahme bleiben gesondert offen.
