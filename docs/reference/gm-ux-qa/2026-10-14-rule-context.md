# GM-Probe: Regelkarten beim Gruppenwechsel

Ausgang: `09967453` mit integrierten Masken-/Regelbeiträgen. Eigene isolierte
Electron-Kampagne, zwei aktive Gruppen und drei eigene Regeln. Ein absichtlich
verzögerter IPC-Lesebeleg macht die Reihenfolge reproduzierbar; keine Nutzerdaten.

| Ausgangsproblem / Vergleich | Änderung | Gegenprobe |
| --- | --- | --- |
| Gruppe A hat zwei Regeln. Aktualisieren verzögern, zu Keller B wechseln, alte A-Antwort freigeben, Sichtschutz in B anheften: scheitert mit „Regelreferenzen dieser Scene wurden geändert“. Sichtbare Gruppe und interne Schreibbasis widersprechen sich. | Antwort erst nach Prüfung von Kampagne, Gruppe und Anfragegeneration übernehmen. Bekannte höhere Revisionen bleiben maßgeblich; Antworten für andere Gruppen werden abgewiesen. | [Nativer Fehler](2026-10-14-rule-context-before.json), [Bild](2026-10-14-rule-context-before.png). Derselbe Ablauf gelingt nach der Änderung; B behält Sichtschutz nach Neustart, A unverändert Festhalten und Deckung. |
| Späte Schreibantwort ersetzt die neue Gruppenbasis; alte Suchaktionen bleiben während neuer Eingabe und nach Lesefehlern bedienbar. | Auch Schreibantworten vor Übernahme prüfen. Suche entwertet alte Aktionen sofort; Lade-/Suchfehler lokal anzeigen, neue Aktualisierung ermöglicht Retry. Schreibende Buttons bleiben während offener Antwort gesperrt. | Vier neue UI-Regressionen scheitern am Ausgangscode und bestehen nach Reparatur; zusätzliche bestehende Fälle prüfen A→B→A, falsche Gruppe, ältere Revision und Doppelklick. |
| Zwei konkurrierende Integrationen entfernten Partyfiguren beziehungsweise sicherten gemeinsame HP und deren Belege separat. | Ein atomarer Abgleich erhält HP, entfernt Figuren aus allen offenen Masken, korrigiert den aktuellen Zug und schreibt je Maskeneffekt genau einen Beleg. | Reale SQLite-Daten: zwei Kämpfe plus eine Verfolgung, Iri bleibt auf 3 HP, drei Belege, zwei Kampf-Austritte; Replay und Fresh ohne Dopplung. Erzwungener Belegfehler rollt Party, HP, Masken und History gemeinsam zurück. |
| Alte Schema-38-Pakete ohne Verfolgungstabellen waren nicht lesbar; Kopien behielten alte Verfolgungslinks. Negative Regelrevision wurde exportierbar gelesen. | Tatsächliche Legacy-Abwesenheit akzeptieren, vorhandene Historylinks strikt prüfen. Fachliche Scene-/Chase-Referenzen umschlüsseln; freie Prosa unverändert lassen. Ungültige Regelrevision vor Lesen/Backup abweisen. | Wiederverwendete SQLite-Transfer-/Authority-Prüfungen reproduzierten sechs weitere Fehler; nach Korrektur bestanden. Quellpaketbytes und freie Texte bleiben erhalten. |

[Foundry Journal Entries](https://foundryvtt.com/article/journal/) und
[Map Notes](https://foundryvtt.com/article/map-notes/) bieten verknüpfte Notizen
für Scenes. Eine tatsächlich geschriebene und wieder gelesene Markdowndatei
pro Gruppe hält die Regeln ebenfalls eindeutig getrennt
([Kontrolle](2026-10-14-rule-context-markdown.json)). Daraus folgt der hier
geprüfte Maßstab: Eine Regel für B muss ohne Neuladen der Kampagne an B
angeheftet werden können; ein Wechsel darf die Zuordnung nicht verdeckt ändern.
Dies ist Dokumentationsvergleich und lokaler Dateigebrauch, keine direkte
Foundry-Bedienmessung oder menschliche Geschwindigkeitsparität.

Nachweise: `tests/desktop-rule-context.test.mjs`,
`tests/desktop-mask-integration.test.mjs`, bestehende Rule-/Chase-/Masken- und
Todesrettungswurfprüfungen sowie `tools/test-desktop-rule-context.mjs`.
Die native Probe erhält sämtliche ursprünglichen Notizbytes, schließt normal
und öffnet beide Gruppen mit ihren jeweiligen Regeln frisch.

Die Gruppe-Regel-Zuordnung ist damit gezielt geprüft. Vollständige Regelverwaltung,
gesamter Kampagnentransfer, Crash-Recovery, OS-Parität und das Gesamtprodukt
bleiben eigene offene Abnahmen.

50 gezielte Tests bestanden; Desktop-Typecheck und Build erfolgreich. Zwei native
Starts endeten normal; alle eigenen Electron-PIDs beendet. Ein serieller QA-Job
blieb laut systemd bei 924 MiB Spitze unter 4 GiB Limit, ohne Swap.
