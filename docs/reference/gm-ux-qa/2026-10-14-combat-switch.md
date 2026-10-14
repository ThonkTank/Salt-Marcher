# GM-Probe: Zwischen zwei Begegnungen wechseln

Ausgang: `9d2cfd0f`, integrierter Produktstand. Isolierte native Kampagne mit
Torwache/Wache (10 HP) und Keller/Wolf (8 HP). Beide Begegnungen liegen in
derselben Gruppe. Ein eigener IPC-Beleg wird kontrolliert verzögert.

| Ausgangsproblem | Änderung | Ergebnis |
| --- | --- | --- |
| Keller auswählen, Antwort anhalten: Auswahl zeigt Keller, alte Torwache bleibt mit aktiven Schadensaktionen stehen. „Schaden“ reduziert tatsächlich die Wache auf 9 HP; Wolf bleibt auf 8. | Ladezustand sperrt sämtliche Schreibaktionen einschließlich bereits ausgelöster Handler. Sichtbarer Status nennt die angeforderte Begegnung. Neuere Auswahl entwertet alte Antworten und Fehler. | [Native Ausgangsdaten](2026-10-14-combat-switch-before.json), [Wache nach falschem Schaden](2026-10-14-combat-switch-before.png). Danach bleibt Wache bei 10; ausdrücklicher Schaden nach bestätigtem Keller-Wechsel reduziert ausschließlich Wolf auf 7. |
| Fehlgeschlagene Auswahl lässt den alten Kampf bedienbar; Aktualisieren liest den alten Besitzer statt der gewählten Begegnung. | Alte Arbeitsfläche bei Lesefehler entfernen, bekannte Auswahl erhalten, lokalen Fehler zeigen. Auswahl und Aktualisieren bleiben nutzbar; Retry bindet an die angeforderte Identität. Antworten anderer Begegnungen werden abgewiesen. | Kontrollierter nativer Lesefehler, gesperrter Schaden und ausdrücklicher Retry derselben Begegnung; [Fehleransicht](2026-10-14-combat-switch-read-error.png). |
| Offene Notizen dürfen beim Wechsel nicht verloren gehen oder einer anderen Begegnung zugeordnet werden. | Bestehende unabhängige Entwurfssicherung erhalten; erst bestätigte Antworten werden zur neuen Schreibbasis. | Leerer Entwurfstitel und „Unfertige Hafennotiz“ bleiben nach Wechsel, Fehler, Retry, normalem Close und frischem Electronstart erhalten. Gespeicherter Torwache-Record einschließlich CRLF-Prosa bleibt bytegleich. |

[Foundry unterstützt mehrere Begegnungen pro Scene und deren explizite Auswahl](https://foundryvtt.com/article/combat/).
Eine tatsächlich geschriebene und erneut gelesene Markdowndatei pro Begegnung
erhält ebenfalls die Zuordnung: nur Keller bearbeiten, Torwache unverändert
([Dateikontrolle](2026-10-14-combat-switch-markdown.json)). Der geprüfte Maßstab
ist deshalb eine verlässliche Beziehung zwischen Auswahl und Schreibziel.
Foundry wurde hier anhand offizieller Dokumentation verglichen; keine direkte
Bedienmessung oder menschliche Geschwindigkeitsparität wird behauptet.

Fünf neue UI-/SQLite-Regressionen prüfen gesperrte alte Aktionen, Entwurferhalt,
Fehler/Retry, überholte Fehler, Scene-Wechsel und falsche Antwortidentität.
Vier scheitern am Ausgangscode; der bestehende Scene-Wechselguard bestand
bereits. Nach der Änderung bestehen alle fünf.

50 Prüfungen insgesamt: zusätzlich vorhandene Entwurfs-, Masken-, Regel- und
Transferfälle. Desktop-Typecheck und Build erfolgreich. Zwei native
Begegnungsstarts und zwei ergänzende Regel-/Probenstarts enden normal;
beide Proben prüfen ursprüngliche Textbytes und Fresh.
[Native Ergebnisdaten](2026-10-14-combat-switch-after.json),
[Ansicht](2026-10-14-combat-switch-after.png).

Grenzen: bewusste Verzögerung und Lesefehler sind kontrollierte Gegenproben,
kein Latenzbenchmark oder Hard-Crash-Test. Vollständige GM-, Atlas-, Import-,
OS- und Konkurrenzabnahme bleiben offen.

Letzter Integrationsstand: 50 Prüfungen sowie Desktop-Typecheck/Build bestanden.
Zusätzlich zwei native Starts mit Goblin im Keller: erkannter Angriff aus dem
Statblock wird mit Formel und Quellenbezug protokolliert; die Summe wurde im
frischen Store geprüft. Kein impliziter HP-Schaden. Torwache und ihr Entwurf
bleiben unverändert. Alle eigenen nativen Prozesse sind beendet.

In der Fehleransicht entfallen außerdem die Aufforderung und die leeren Felder
für eine neue Begegnung. Sichtbar bleiben die betroffene Auswahl, der Fehler
und der gezielte Retry. Dieser Zustand wurde erneut nativ geprüft.

[Abschlussbeleg](2026-10-14-combat-switch-sync.json): 50 Gesamtprüfungen,
fünf betroffene Fälle nach der letzten Änderung erneut bestanden; nativer Build
und Typecheck erfolgreich. Höchstens rund 661 MiB je dokumentiertem
Qualifikationsjob bei 4 GiB Limit; ein eigener schwerer Job gleichzeitig.
