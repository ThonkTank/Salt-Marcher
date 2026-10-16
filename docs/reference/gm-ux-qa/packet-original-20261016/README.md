# Eine Quelle beim Lesen des vorbereiteten Abends ändern

Geprüfte Aufgabe: Im zweiten Besuch eines Abends die Reaktion auf drei Glockenschläge in einer langen Originalnotiz finden. „Nera bleibt am Westtor.“ wird zu „Nera wartet jetzt im Wachraum.“ geändert. Danach im Abend weiterlesen und im frischen Prozess die Änderung sowie unveränderte Begleitnotizen wiederfinden.

## Beobachtung und Änderung

Ausgangsstand `03549db8` (Produktdateien identisch mit `bc0d3b10`): Die Mappe zeigt Markdownsyntax einschließlich Tabellen als Rohtext. Ein Original lässt sich dort nicht bearbeiten. Der externe Umweg verliert die Suche; eine einzelne Texteingabe normalisiert die bisherigen CRLF-Zeilenenden. Die Suche nach dem vollständig kopierten Titel mit freistehendem Mittelpunkt findet die Notiz nicht.

Der Kandidat rendert Überschriften, Tabellen, Zitate und passive Checklisten. „Original bearbeiten…“ bleibt am sichtbaren Quellabschnitt erreichbar. Er verwendet denselben kanonischen Preparation-Editor und dieselbe Speicherung; die Rückkehr erhält Suche, Besuch und Leseposition. Der Suchbegriff wird im Original sichtbar ausgewählt. Ein unklarer Speicherbeleg bleibt manuell prüfbar und verhindert unbeabsichtigte Wiederholung. Veraltete Kontextantworten dürfen keinen neuen Besitzer übernehmen. Die Titel-Suche ignoriert alleinstehende Satzzeichen. Textänderungen erhalten bestehende Zeilenenden außerhalb der beabsichtigten Änderung.

Das Markdown nutzt den Lexer von Marked 18.0.14 und DOM-Textknoten statt HTML-Injektion. Links bleiben in dieser passiven Projektion lesbare Bezeichnungen; Bilder und ausführbare Inhalte werden nicht geladen. Unstrukturierter Text behält seine Leerzeichen und Zeilenenden. Abgehakte Leselisten bleiben passiv und werden nicht als Quellenauswahl umgeschrieben.

## Tatsächlich benutzte Gegenstücke

**Obsidian 1.14.4:** Offizielles AppImage mit SHA-256 `6362ddbeeeebb7bbccb48fae009572cf2284ef92f5c919c1332aba48de6ffeaa`. Separates Profil und vier Markdowndateien; Dateien/Vaultregistrierung sind Testvorbereitung, keine behauptete UI-Erstellung. Die Abendnotiz bettet die zwei Originale ein. Tabellen und Checklisten sind unmittelbar lesbar. Der Weg über „Open link“ am Anfang der langen Einbettung führt zum Original; normale Suche/Ersetzen ändert die Bedingung. Back kehrt zur Abendnotiz nahe deren Anfang zurück (2142 → 34). Ein nachträglich geprüfter Navigationsweg über den Quick Switcher vermeidet den Weg zum Einbettungsanfang, erfordert aber die erneute Eingabe des Quelltitels. Daraus folgt keine allgemeine Unfähigkeit von Obsidian, Lesepositionen zu halten. Das bearbeitete Original normalisiert CRLF zu LF; die anderen drei Dateien bleiben exakt unverändert. Frischer Prozess und beide regulären Fenster-Schließungen werden separat belegt.

Eine zunächst unmaskierte Wiki-Alias-Trennlinie in der Tabellen-Testdatei wurde vor dem eigentlichen Änderungsablauf korrigiert; dieser Fixturefehler zählt nicht als Produktmangel. Nicht gestartete Flatpak-Launcher sind ebenfalls kein abgeschlossener Vergleich.

**Joplin Desktop 3.7.21, ergänzend:** Drei Quellen und eine Abendnotiz wurden tatsächlich über die Oberfläche angelegt/verknüpft. Gerenderte Tabelle, Originaländerung, Back/Forward und erneutes Lesen aller vier Notizen im frischen Prozess sind belegt. Die Abendnotiz benötigt ausdrücklich angelegte Links. Neustartgrenze SIGTERM; keine reguläre Schließung behauptet.

## Nachprüfung unseres Kandidaten

Produktquelle `f125a5b90d99436041a997f49eef6af976c42b91`, sauber. Vollständiger Ablauf bei 100 % und 200 %, vier reguläre Prozessenden mit Code 0 und ohne Signal, eigene Haupt-PIDs anschließend abwesend, keine Seitenfehler. Suche, Besuch, derselbe Editor und Leseposition bleiben erhalten. Nach frischem Start ist nur der beabsichtigte Originaltext samt Revision geändert; die vollständigen übrigen Notizen, Pläne und Besuche sowie rohe CRLF bleiben exakt erhalten. Ein erster 200-%-Lauf deckte einen außerhalb des Dialogs liegenden Quellbutton auf; begrenzte Lesehöhe und kompakter Kopfbereich beheben dies im erneut vollständig ausgeführten Ablauf.

148 gezielte technische Tests, beide Typprüfungen, Repositoryprüfung und beide Builds bestanden. Enthalten sind der echte Store, unklarer Speicherbeleg ohne erneutes Senden, verspäteter Original-Leseabschluss nach Kampagnenwechsel, Titel-Suche, passive Darstellung und unveränderte Rohtexte. Die vollständige Suite des früheren Veröffentlichungsstands `03549db8` bestand separat (3346 Tests, 3345 bestanden, 1 übersprungen); das ist kein vollständiger Test des neuen Kandidaten.

Reproduktion nach Desktopbuild: `node tools/test-desktop-packet-original.mjs`, zusätzlich `--zoom`; Ergebnisse standardmäßig unter `.build/qa/packet-original[-zoom]`. Die beigefügten ursprünglichen Laufdaten binden die tatsächlich geprüften Artefakte und Quellstände.

## Grenze und Integration

Keine menschliche Usability- oder Gesamtproduktabnahme. World Anvil, Kanka, VTTs und Google Docs sind weitere primäre Vergleichsziele und wurden in diesem Lauf noch nicht benutzt. Der Umzug nach SaltMarcher wird separat integriert; alte Arbeitsstände und Belege bleiben erhalten. Dieser lokale Kandidat wird erst nach dem Main-Umzug auf dem neuen Zielstand qualifiziert und veröffentlicht.

Belege: [vorher](before.json), [100 %](after-100.json), [200 %](after-200.json), [Obsidian](obsidian.json), [Joplin](joplin.json), [Checks](checks.json). Bilder: [vorher](before.png), [Originaleditor](original-editor.png), [Rückkehr bei 200 %](after-200.png), [Obsidian frisch](obsidian-fresh.png).
