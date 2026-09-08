# Roadmap: Vom bestehenden Szenenmenü zur DnD-Arbeitsfläche

## Leitlinie

Die Umstellung erfolgt in sechs aufeinander aufbauenden Etappen. Zuerst entsteht eine belastbare Fenster-Arbeitsfläche mit den vorhandenen Funktionen. Anschließend werden Charakterverwaltung und Schnellaktionen verbessert. Das alte Layout entfällt erst, wenn die neue Oberfläche sämtliche bisherigen Arbeitsabläufe abdeckt.

Bis dahin bleibt das aktuelle Szenenlayout Standard. Die neue Arbeitsfläche ist über eine ausdrücklich als Vorschau bezeichnete Einstellung erreichbar. Beide Oberflächen verwenden dieselben Fachzustände; es gibt keine zweite Kampagnen-, Kampf- oder Reiselogik.

Jede Etappe endet mit einem nutzbaren, getesteten Zwischenstand und dokumentierter Abnahme.

## Etappe 1 — Fensterverwaltung und gespeicherte Arbeitsflächen

**Ziel:** Das Desktop-Verhalten unabhängig von komplizierten Spielfunktionen absichern.

**Umsetzung**

- `SceneDesktop` mit Szenenwahl, Fensteröffnern und Fensterleiste einführen.
- Verschieben, Skalieren, Minimieren, Maximieren/Wiederherstellen, Fokus und Stapelreihenfolge implementieren.
- Einrasten an Seiten und benachbarten Fenstern einschließlich Vorschau und tastaturbedienbarer Anordnung.
- Eine kompakte, zunächst lesende Szenenübersicht mit vorhandenen Charakteren und Gruppen integrieren.
- Zod-validierte Desktop-Verträge sowie Installation-eigenen Speicher je Kampagne und Szene ergänzen.
- Fenstergeometrie, Öffnungszustand und Wiederherstellungszustand dauerhaft speichern.
- Vorschau-Einstellung ergänzen; bisherige Oberfläche bleibt vollständig verfügbar.

**Abnahme**

Zwei Szenen behalten unterschiedliche Anordnungen über Szenenwechsel, Katalogbesuch und App-Neustart hinweg. Fenster bleiben bei kleinerer Arbeitsfläche erreichbar. Schließen der letzten Ansicht öffnet sie nicht ungefragt erneut.

**Abhängigkeit:** Keine.

## Etappe 2 — Nachschlagen und unabhängige Lesefenster

**Ziel:** Den wichtigsten Mehrwert der Arbeitsfläche nutzbar machen: Inhalte nebeneinander ansehen.

**Umsetzung**

- Nachschlagefenster mit vorhandenen statischen und Kampagnenindizes verbinden.
- Gemeinsames Lesefenster mit Zurück-/Vorwärts-Verlauf integrieren.
- „Separat öffnen“ und Wiederfinden bereits geöffneter Referenzen implementieren.
- Bestehende Referenzauflösung, Links und Caches weiterverwenden.
- Referenzziele, Verlauf und Scrollposition in den Desktop-Zustand aufnehmen.
- Referenz-Pins innerhalb der neuen Arbeitsfläche durch ihre Lesefenster ersetzen.

**Abnahme**

Eine Itembeschreibung lässt sich maximieren, wiederherstellen und neben einer Ortsbeschreibung lesen. Szenenwechsel und Neustart stellen die richtigen Inhalte wieder her. Verspätete Ladeantworten überschreiben keine inzwischen andere Auswahl.

**Abhängigkeit:** Etappe 1.

## Etappe 3 — Karte, Reise und Kampf als produktive Fenster

**Ziel:** Die neue Arbeitsfläche für laufendes Spiel qualifizieren.

**Umsetzung**

- Bestehende Karten- und Reiseansichten in ein gemeinsames Fenster integrieren.
- Bestehende Encounter-Ansicht als Kampffenster integrieren.
- Spiellaufzeit und Befehlsausführung vom Lebenszyklus der Fenster entkoppeln.
- Kartenansicht, Zoom und Auswahl beim Verdecken oder erneuten Öffnen erhalten; unsichtbare Zeichenarbeit pausieren.
- Reise und Kampf innerhalb derselben Szene gegenseitig gegen gleichzeitige Ausführung absichern.
- Bestehende Szenen-, Zeit-, Orts-, Gruppen- und Beuteaktionen in der Übersicht beziehungsweise ihren Fachfenstern zugänglich machen.

**Abnahme**

Während eines Kampfes lassen sich Karte und Beschreibungen öffnen. Fenster schließen oder minimieren verändert weder Reise noch Kampf. Nach Wiederöffnen stimmt der laufende Zustand. Andere Szenen bleiben unabhängig.

**Abhängigkeiten:** Etappen 1–2.

**Meilenstein:** Ab hier kann die Vorschau für vollständige Spielsituationen erprobt werden. Das Party-Popup bleibt vorerst als vorhandener Zugang zur Charakterverwaltung erhalten.

## Etappe 4 — Charakterkatalog und kompakte Schnellinfos

**Ziel:** Dauerhafte Charakterpflege und Informationen am Spieltisch sauber trennen.

**Umsetzung**

- `Katalog → Charaktere` ergänzen: Liste, Suche, Detailansicht, Anlegen, Bearbeiten und bestätigtes Löschen.
- Alle bestehenden Felder, leere optionale Werte, inaktive Charaktere und persönliche Beute berücksichtigen.
- Charakter-Schnellinfos als eigenes Szenenfenster ergänzen.
- Sprachen und passive Werte direkt vergleichbar darstellen; Hervorhebung ohne Umsortieren.
- Charakterdetails mit aktuellen XP, nächster Levelschwelle und Zugang zum Katalog anbieten.
- Bestehende XP- und Rastaktionen noch nicht fachlich ändern.

**Abnahme**

Inaktive Charaktere lassen sich vollständig pflegen, ohne sie zu aktivieren. Neue Charaktere benötigen nur einen Namen. Schnellinfos zeigen ausschließlich die Mitglieder ihrer Szene. Wechsel zum Katalog und zurück erhält die Arbeitsfläche.

**Abhängigkeiten:** Etappen 1–3.

## Etappe 5 — Besetzung, Aufteilen, XP und selektive Rasten

**Ziel:** Die gemeinsam entworfenen Schnellaktionen fachlich korrekt umsetzen.

Diese Etappe wird intern in drei aufeinanderfolgende Arbeitspakete geteilt.

**5A — Besetzung und Szenenwechsel**

- Gemeinsamen Befehl für die gewünschte Szenenbesetzung ergänzen.
- Verschieben ausgewählter Charaktere in bestehende oder neue Szenen ergänzen.
- Primäre Änderungen gemeinsam validieren und schreiben; abhängige Kampf-/Reisezustände nachvollziehbar abgleichen.
- Stabile Auswahl mit Suche, Leeren und Übernehmen implementieren.
- Neue Szenen übernehmen Zeit und Ort der Quelle; bestehende Ziele bleiben unverändert. Leere Quellszenen werden nicht automatisch gelöscht.

**5B — XP und Encounter-Belastung trennen**

- Manuelle XP-Änderungen von Rastzählern entkoppeln.
- Absolutes Setzen von XP ergänzen; Level-Untergrenze und Wertevalidierung beibehalten.
- Kompakte Bedienung `[Betrag] [+] [−] [Überschreiben]` implementieren.
- Nur bestätigte Encounter-Vergaben erhöhen die Belastung ihrer tatsächlichen Empfänger, jeweils genau einmal.
- Bestehende vermischte Zähler erhalten, aber ihre Ausgangsbasis als ungesichert markieren. Keine exakte Prognose daraus anzeigen.

**5C — Rasten und Belastungsanzeige**

- Rastbefehl mit expliziten Charakter-IDs ergänzen.
- Zweiten Bestätigungsklick am selben Button implementieren.
- Auswahländerung, veralteter Datenstand oder Schließen verwirft die Bestätigung.
- Kurze Rast stellt den kurzen Zähler, lange Rast beide Zähler auf eine gesicherte Basis.
- Belastungsanzeige und Rastorientierung aus produktiven Regeln und Katalogwerten berechnen.

**Abnahme**

Besetzungsaustausch verschiebt keine Listeneinträge. Aufteilen und Zusammenführen betrifft nur ausgewählte Charaktere. Manuelle XP verändern keine Belastung. Rasten benötigen zwei Klicks und betreffen ausschließlich die Auswahl. Fehler und wiederholte Befehle erzeugen keine Teil- oder Doppeleffekte.

**Abhängigkeit:** Etappe 4; innerhalb dieser Etappe 5A → 5B → 5C.

## Etappe 6 — Vollständige Umstellung und Bereinigung

**Ziel:** Die neue Arbeitsfläche wird die reguläre Szenenoberfläche.

**Umsetzung**

- Funktionsabgleich gegen die bisherige Oberfläche abschließen.
- Neues Desktop-Modell zum Standard machen und Vorschau-Umschalter entfernen.
- Party-Popup, altes Spaltenlayout und ausschließlich dafür benötigte Zustände entfernen.
- Separaten Adventuring-Day-Rechner erhalten.
- `Alt+P` auf die Charakter-Schnellinfos umstellen.
- Dokumentation, Architekturgrenzen, Migrationen und visuelle Referenzen auf den endgültigen Stand bringen.
- Verwaiste Desktop-Einträge und nicht mehr vorhandene Referenzziele kontrolliert behandeln.

**Abnahme**

Vollständige E2E-Prüfung einer Sitzung: Charakterpflege, Besetzung, Reise, Kampf, Nachschlagen, XP, Rasten, Szenenwechsel und Neustart. Zusätzlich beide Themes, kleinere Arbeitsflächen, Tastaturbedienung sowie Ressourcenverbrauch bei wiederholtem Öffnen und Schließen prüfen.

**Abhängigkeiten:** Alle vorherigen Etappen.

## Qualität und Auslieferung je Etappe

- Neue Verträge, Migrationen und Fachbefehle erhalten passende Unit- und Integrationstests; sichtbare Abläufe werden gezielt per E2E geprüft.
- Neue Fehlerfälle werden in derselben Etappe behoben, bevor darauf aufgebaut wird.
- Anforderungen und Fortschritt werden im versionierten Migrationsplan fortgeschrieben.
- Jede app-relevante Etappe wird auf einem sauberen `codex/`-Kandidatenbranch committed und gepusht.
- Der exakte SHA durchläuft alle erforderlichen Remote-Checks und `pnpm handoff:app`.
- Erst danach wird derselbe SHA nach `origin/main` vorgezogen und dort erneut grün bestätigt.

Es werden keine Kalendertermine zugesagt. Die Abnahmekriterien entscheiden, wann die nächste Etappe beginnt.
