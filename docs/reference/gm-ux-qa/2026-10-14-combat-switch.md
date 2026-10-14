# GM-Probe: Zwischen Begegnungen wechseln

Ausgang `9d2cfd0f`: isolierte native Kampagne mit Torwache/Wache (10 HP)
und Keller/Wolf (8 HP). Eigener IPC-Lesebeleg kontrolliert verzögert.

| Ausgangsproblem | Änderung | Direkter Beleg |
| --- | --- | --- |
| Keller auswählen, Antwort anhalten: Auswahl Keller, alte Torwache weiter bedienbar. Schaden trifft tatsächlich Wache (10 → 9); Wolf bleibt auf 8. | Schreibaktionen während Laden sperren, auch direkt ausgelöste Handler. Nur bestätigte Antwort wird Schreibbasis; überholte Antworten und Fehler verwerfen. | [Native Ausgangsdaten](2026-10-14-combat-switch-before.json), [Wache nach falschem Schaden](2026-10-14-combat-switch-before.png). |
| Lesefehler lässt alte Aktionen stehen; Aktualisieren liest den alten Besitzer. | Alte Arbeitsfläche entfernen, Auswahl erhalten, lokalen Fehler zeigen. Retry liest dieselbe angeforderte Begegnung; falsche Antwortidentität wird abgewiesen. Leere Neuanlage entfällt in der Fehleransicht. | [Fehleransicht](2026-10-14-combat-switch-read-error.png). |
| Offene Notizen dürfen weder verloren gehen noch mitwechseln. | Vorhandene unabhängige Entwurfssicherung erhalten. | Leerer Titel und Hafennotiz über Auswahl, Fehler, Retry und Fresh erhalten; gespeicherte Torwache inklusive CRLF-Prosa bytegleich. |

[Foundry unterstützt mehrere Begegnungen pro Scene und deren Auswahl](https://foundryvtt.com/article/combat/).
Zwei tatsächlich geschriebene und wieder gelesene Markdowndateien erlauben
ebenfalls, nur Keller zu bearbeiten und Torwache unverändert zu lassen
([Dateikontrolle](2026-10-14-combat-switch-markdown.json)). Maßstab ist die
eindeutige Beziehung zwischen Auswahl und Schreibziel. Foundry wurde anhand
seiner Dokumentation verglichen; keine direkte Bedien- oder Geschwindigkeitsmessung.

Fünf neue UI-/SQLite-Fälle prüfen Schreibsperre/Entwurf, Fehler/Retry,
überholte Fehler, Scene-Wechsel und falsche Antwortidentität. Vier scheitern
am Ausgangscode; der Scene-Wechselguard bestand bereits. Nach letzter
Integration bestehen 50 Prüfungen einschließlich vorhandener Entwurfs-,
Masken-, Regel- und Transferfälle; Typecheck und Desktop-Build erfolgreich.

Native Nutzung: Wache bleibt auf 10, ausdrücklich bestätigter Schaden trifft
nur Wolf (8 → 7). Ein Goblin-Statblockangriff wird mit Formel, Quelle und
Ergebnis bei der richtigen Gruppe protokolliert, ohne implizite HP-Änderung.
Lesefehler und Retry gelingen; Entwurf bleibt beim Neustart erhalten.
Zwei Begegnungsstarts plus zwei ergänzende Regel-/Probenstarts enden normal;
alle eigenen Electron-PIDs beendet. [Ergebnisdaten](2026-10-14-combat-switch-after.json),
[Ansicht](2026-10-14-combat-switch-after.png), [Abschlussbeleg](2026-10-14-combat-switch-sync.json).

Dokumentierte Qualifikationsjobs: höchstens rund 661 MiB bei 4 GiB Limit,
kein Swap, ein eigener schwerer Job gleichzeitig.

Grenzen: kontrollierte Verzögerung und Lesefehler, kein Latenzbenchmark oder
Hard-Crash-Test. Vollständige GM-, Atlas-, Import-, OS- und Konkurrenzabnahme offen.
