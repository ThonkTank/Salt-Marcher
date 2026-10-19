# Gemeinsame Fallenabwicklung in zwei Raum-Keys

Native Quellbuild-Prüfung vom 18.10.2026 auf `ea00b1e6c1e2e99986882472e79872e186fb4fd7`
mit der Verknüpfungssuche; die konkreten UI-Bundlehashes und Prozessenden stehen
im [Ergebnis](results.json). Vergleich: Obsidian 1.14.4, eigener Vault, dieselben
zwei Raumtexte, dieselbe gemeinsame Notiz und 35 weitere Kampagneninhalte.

Die vollständige Aufgabe verknüpft dieselbe Fallenabwicklung mit Torhalle und
Sakristei, korrigiert den gemeinsamen Rettungswurf im Original, findet beide
Verwendungsstellen, ergänzt nur die Torhalle und prüft nach normalem Prozessende
und frischem Öffnen die Volltextsuche sowie beide aktuellen Quellen.

[Vorher](before.png): weit unten verborgener Bereich, ungefilterte Gesamtliste,
separate Hinzufügen-Aktion und dieselbe Auswahl im zweiten Raum.
[Nachher bei 200 %](after-200.png): Verknüpfungen beim Raumtext, höchstens acht
Suchtreffer, direkte Auswahl mit Maus oder Enter, erhaltener Suchbegriff beim
Raumwechsel. Notizen, Orte und Spielabende benutzen dieselbe Suche; der Writer
und die kanonischen Inhalte bleiben erhalten. Die Aufgabe wurde vollständig
wiederholt; Originalabschnitte und beide Verweis-IDs wurden zusätzlich gelesen.

[Obsidian nach frischem Öffnen](obsidian-uses.png): Linkvervollständigung mit
`[[Druckplatten` und Enter, Korrektur im gemeinsamen Original, Backlinks für
beide Räume und raumspezifische Ergänzung. Das direkte Auswählen eines gefilterten
Links liefert die Vergleichsidee; SaltMarcher braucht dafür keine Markdownsyntax.

Die ergänzende bestehende native Prüfung `test-desktop-key-note-context.mjs --unlink`
prüfte verschachtelte Notizmappe, Quelle lösen, IME, Rückkehr, Fresh und 200 %.
Keine Paketinstallation oder menschliche Produktabnahme ist daraus ableitbar.

## Rückkehr im Atlas am 19.10.2026

Erneute vollständige Aufgabe auf Basis `54c0e95c5fb4c10c1aed76ef279ff95e1682737d`
plus dem in [context-results.json](context-results.json) durch Bundlehashes
gebundenen Rückwegänderungen. [Vorher](context-return-before.png) führt „Zurück zur
Notiz“ aus dem Atlas in die allgemeine Wissensansicht. [Nachher](context-return-after.png)
öffnet dieselbe Aktion die Quelle wieder bei der ursprünglichen Sakristei.
Die beiden Raumverwendungen bleiben unmittelbar von dort erreichbar.
[Bei 200 %](context-return-200.png) bleibt die Quellüberschrift mit „Zum Raumtext“
über der gescrollten Verwendungsliste bedienbar; die Raumformulare erscheinen erst
bei dieser Rückkehr wieder. Es gibt weiterhin nur einen Notizeditor und Writer. Der Rückweg bindet die tatsächlich
angezeigte Notiz, auch nach Beziehungsnavigation. Ein anderweitig eingebundener
Editor erhält dadurch keinen fremden Raumrückweg.

Der aktualisierte native Ablauf `tools/test-desktop-room-rule-reuse.mjs` beginnt
an der sichtbaren Atlassuche. Er verknüpft beide Räume, korrigiert die Quelle,
bearbeitet die Torhalle, kehrt zweimal zum ursprünglichen Atlas-Kontext zurück,
prüft den anklickbaren Rückweg bei 200 %, beendet normal und öffnet frisch.
Eine kontrolliert ausgelöste laufende IME-Eingabe blockiert die Raumnavigation;
die Quelle bleibt anschließend über „Zum Raumtext“ verlassbar.
Volltextsuche, beide aktuellen Quellen, die lokale Ergänzung und der bisherige
Wissensansicht-Rückweg werden erneut benutzt. 35 weitere Notizen, beide
Originalabschnitte und die Quellenbindungen bleiben bei zusätzlichem Store-Read
unverändert. Beide Prozesse endeten mit Exitcode 0 und verschwanden aus `/proc`.

Die [erneute Obsidian-Aufgabe](obsidian-context-fresh.png) verwendete einen eigenen
Vault mit denselben Texten und weiteren Inhalten: Linkvervollständigung in beiden
Räumen, SG-Korrektur im Original, beide Backlinks, lokale Raumergänzung, sichtbares
„Navigate back“, normale Beendigung und frisches Wiederfinden. Sie lief mit den
installierten Obsidian-1.14.4-App-Dateien unter Test-Electron 44.7.0. Das ist eine
native Gegenprobe der App, keine Qualifikation des Flatpak-Launchers. Der direkte
Rückweg zum selben Arbeitskontext liefert die Vergleichsidee.

Die Beobachtung belegt den entfallenen Arbeitsbereichswechsel, keine allgemeine
Überlegenheit für menschliche GMs. Paketinstallation und menschliche Abnahme
bleiben ungeprüft.
