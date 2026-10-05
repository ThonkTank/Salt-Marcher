# DD-039: unabhängige Gruppenprüfung, vorbereitet

## Original und Kandidat

Der direkte Originalbericht `audit-20261004-vollstaendigkeit/objekte/native-dd039-packoff-20261005/DD-039-ORIGINAL.md` belegt `Menu → Show Map Info`, die lesende Größe `8 by 8`, den vollständigen Dateipfad, einen ausgewählten Paketnamen samt Autor und die Abwesenheit eines abgewählten Pakets trotz verbliebener Assetreferenz. Close und X schlossen ohne Änderung der Originalkartendatei. Der leere Listeneintrag `1` bei abgewähltem Paket ist beobachtet, seine Ursache ist offen.

`candidate/dd039-map-info` (`fd3b824`) bietet den lesenden Dialog über `Dungeon → Karteninformationen` an. Größe kommt aus `session.settings`, der Desktop-Dateipfad aus `FileSystemAdapter.getFullPath`, die Paketliste aus den ausgewählten `assetPacks` und dem Katalog. Der abweichende Zugang und die anders formulierten Labels sind Oberflächenunterschiede. Der frühere Kandidaten-Hostlauf mit Build-SHA-256 `5a31edde17ad0eb1a58848f90f0711edd473ea51ad7f6d6fdb363f13bcf9547d` bestand Edit und Frischstart unter `qa/map-info-isolated/evidence/1791186597811-map-info-edit` und `1791186636313-map-info-reopen`. Dieser Lauf ist ein vorhandener Beleg, keine Ausführung des neuen Gruppenszenarios.

## Neues Gruppenszenario

`tools/groups/scenarios/verwaltung-karte-datei.cjs` prüft ausschließlich `DD-039.01–.06` aus der 30 Fälle umfassenden Gruppe. Die anderen Fälle bleiben im Gruppenprotokoll offen. Es legt zwei isolierte Karten an: 9 × 10 mit dem ausgewählten QA-Paket und 8 × 8 ohne ausgewähltes Paket, aber mit gespeicherter Objektreferenz auf dieses Paket. Beide Karten werden gespeichert und im zweiten Obsidian-Prozess frisch geöffnet. Je Karte und Phase prüft es:

| Fall | Prüfung |
| --- | --- |
| DD-039.01 | Eigenständigen lesenden Dialog über die Editorbedienung öffnen. |
| DD-039.02 | Aktuelle Größe beider Karten anzeigen. |
| DD-039.03 | Tatsächlichen vollständigen Pfad beider Dateien anzeigen. |
| DD-039.04 | Paketname und Autor nur bei ausgewähltem Paket; verbliebene Referenz allein darf den Namen nicht erzeugen. |
| DD-039.05 | Close erhält Dokument, Dirty-Flag, History, Notizen und Kartenprüfsumme. |
| DD-039.06 | X erhält dieselben Zustände. |

Die Paketfixture ist eine unveränderte Kopie außerhalb des Nutzervaults, SHA-256 `df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088`. Das Szenario schreibt Screenshot, Dialog-HTML, Karteninfo-Ergebnis und die üblichen `group-cases.json`-Sätze ausschließlich in den übergebenen QA-Root. Es wurde statisch geprüft, **noch nicht grafisch ausgeführt**.

## Verbleibende Grenzen

- Der genaue visuelle Listeneintrag `1` ohne Paket wird nicht nachgebildet; Zielwirkung ist, kein abgewähltes Paket fälschlich zu nennen.
- Ein Dateiadapter ohne lokalen Vollpfad ist nicht geprüft. Der Kandidat zeigt dort den Vaultpfad.
- Größenänderung während eines offenen Informationsdialogs und unbekannte Paket-ID sind keine direkt gemessenen Originalfälle.
- Für endgültige Abnahme ist der neue Gruppenlauf auf dem zu installierenden Build und danach auf dem installierten Endstand nötig. `pass` im Szenario ist ein erwarteter Prüfentscheid bei bestandenen Assertions, kein vorweggenommenes Ergebnis.

Ausführung nach Freigabe des exklusiven Grafikslots mit neuem `DUNGEON_QA_ROOT`: `node tools/host-test.cjs --group verwaltung-karte-datei`, anschließend derselbe Aufruf mit `--restart`. Build und Kartenprüfsummen sind in beiden Ergebnisverzeichnissen zu vergleichen.
