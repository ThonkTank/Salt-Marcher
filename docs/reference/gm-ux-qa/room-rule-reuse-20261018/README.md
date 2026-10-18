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
