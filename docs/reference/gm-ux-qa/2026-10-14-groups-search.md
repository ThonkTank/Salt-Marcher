# GM-Probe: Gruppe offen halten und andere Gruppen finden

Ausgangsstand: `58bdb6a9` plus integrierte installierte Änderungen. Isolierte
Electron-Kampagne mit je 65 Hafen- und Waldgruppen; keine Nutzerdaten.

| Ausgangsproblem | Änderung | Direkte Gegenprobe |
| --- | --- | --- |
| „Hafen“ suchen, unfertige Gruppennotiz offen lassen, „Wald“ eintippen, „Weitere Gruppen“: 25 Hafen- plus 25 Waldgruppen; alter Cursor überspringt Waldgruppen. | Eingabe entwertet Ergebnisse/Cursor sofort. Abgeschickte Suche und eigene Anfragegeneration bestimmen jede Fortsetzung. | [Native Ausgangsdaten](2026-10-14-groups-search-before.json), [Bild](2026-10-14-groups-search-before.png). Vier gezielte UI-/SQLiteprüfungen scheitern am alten Code und bestehen mit der Änderung. |
| Doppelklick lädt dieselbe Seite zweimal; späte Antworten können eine neuere Suche ersetzen; Fehler lassen alte Treffer stehen. | Eine Fortsetzung gleichzeitig; veraltete Antworten verwerfen. Fehler beim Ersetzen leeren die Liste; Nachladefehler behalten den Cursor für ausdrücklichen Retry. Sichtbarer Status zählt geladene Gruppen. | Verzögerte Antworten, Kampagnenwechsel, Doppelklick und beide Lesefehler im Regressionstest. |
| Gruppennamen erscheinen in zufälliger UUID-Reihenfolge. | Nach angezeigtem Namen sortieren, ID nur als eindeutiger Gleichstandsanker. Keyset-Fortsetzung über Seitengrenzen; fremder Suchanker wird abgewiesen. | 65 Namen vollständig, eindeutig und geordnet über drei Seiten; native Darstellung. |
| Neue Party-/Zeitquellen treffen bei der Integration auf die ältere Suchbegrenzung. | Partyzuordnung und Zeitereignisse erhalten; Kategorie/Text vor der Grenze anwenden, Quellen in Portionen lesen, vollständige Kampfauszeichnungen erhalten. | 2003 bestätigte Zeitschritte: ältester „Bronzeschlüssel“ auffindbar; Kategorie Party enthält ihn nicht. Historybytes bleiben gleich. |

Eine einfache tatsächlich geschriebene und zurückgelesene Markdownliste erreicht
alle 65 Waldnamen ohne gemischte Treffer; [Kontrollprotokoll](2026-10-14-groups-search-markdown.json).
[Kanka beschreibt Namenssuche](https://docs.kanka.io/en/latest/features/search.html)
und [Filter für große Listen](https://docs.kanka.io/en/latest/advanced/filters.html).
Das begründet klare Suchzugehörigkeit als Vergleichsmaßstab; es ist keine
Bedienmessung in Kanka und kein Nachweis allgemeiner Geschwindigkeitsparität.

Nachweis am reparierten nativen Produkt: alle 65 Waldgruppen ohne Duplikate,
leerer Titel und unfertige Hafennotiz bleiben über Such-/Tabwechsel erhalten.
Alle 130 gespeicherten Gruppen unverändert; gesicherter Entwurf nach normalem
Close und frischem Electronstart erneut geöffnet. Zwei normale Gruppenstarts
und zusätzlich zwei Chronikstarts; tatsächlicher gefilterter Markdownexport
und kontrollierter Chronik-Lesefehler in der ergänzenden Chronikprobe.
[Ergebnisdaten](2026-10-14-groups-search-after.json),
[Bild](2026-10-14-groups-search-after.png).

Regressionen: `tests/desktop-groups-search.test.mjs` (fünf Fälle), zusätzlicher
SQLite-Zeit-/Partyfilterfall in `tests/desktop-chronicle-store.test.mjs`,
Chronik-/Chase-/Todesrettungswurf-/Szenentischprüfungen sowie bestehende
Generator- und Live-Prüfungen mit aktualisierten privaten API-Fixtures.
92 Prüfungen einschließlich des letzten Integrationsmerges bestanden, Desktop-Typecheck und Build erfolgreich. Die vier nativen
Starts endeten normal. Ein einzelner begrenzter QA-Job benötigte laut systemd
1,5 GiB Spitze bei 4 GiB Limit; alle eigenen Electron-PIDs sind beendet.

Grenzen: Gruppenfixture ohne Monsterteilnehmer; diese Probe qualifiziert Suche,
Entwurferhalt und Anschluss der Chronikquellen. Kein Beleg für vollständige
Gruppen-/Generator-/Atlasfunktion, menschliche GM-Geschwindigkeit oder das
Gesamtprodukt. Die Chronik bleibt auf 2000 passende Einträge begrenzt und
kennzeichnet ausgelassene Ereignisse.

[Abschlussprüfung nach letztem Code-Merge](2026-10-14-groups-search-sync.json).
