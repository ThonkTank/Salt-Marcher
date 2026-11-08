# Aktueller Stand

Stand: 8. November 2026. Regulärer Produkteinstieg bleibt Atlas V7 mit
Dateiformat 22 und Generierungsrezept 4. Der optionale Electron-/Pixi-Höhenversuch
verwendet Dateiformat 23. [README](../../README.md) enthält Befehle,
[Architektur](../architecture.md) Zuständigkeiten und
[Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktueller Auftrag und Richtungsentscheidung

Aaron hat eine gründliche Aufräumplanung mit gleicher vereinbarter
Nutzerfunktionalität beauftragt. Der vorhandene
[Neubau- und Aufräumplan](atlas-rebuild-plan.md) bleibt der einzige Ausführungsplan.
Er erhält F01–F19 mit den bereits vereinbarten D01–D09 und konkretisiert
Reihenfolge, wenige Zuständigkeiten, Löschpflichten und gezielte Nachweise.
Diese Überarbeitung betrifft ausschließlich Dokumentation: keine neuen
Laufzeitänderungen, Messreihen oder Ausführung von P1–P9.

**Den lokalen Kern beibehalten, zwei Datenwege gezielt korrigieren.**
Der kleine Höhenfall belegt lokale Änderungen, Detailerhaltung, History und
Dateirundlauf. Das unterstützt die Trennung von aktivem Modell, Darstellung,
begrenzter Hintergrundarbeit und Speicher. Eine allgemeine Überlegenheit von
Electron/Pixi gegenüber V7 ist damit nicht belegt.

Zwei voneinander unabhängige Schwächen verhindern eine positive Gesamtentscheidung:

1. **Großer bewegter Pinsel:** Im sauber gebauten Paket kommen exakt zugeordnete
   aktuelle Änderungen deutlich verspätet beim Render-Submit an. Das tritt schon
   in der kleinen Szene auf und ist nicht die 512-Quellen-Grenze.
2. **Grobe Ansichten über vielen Feindaten:** Der räumliche Leser verlangt alle
   berührten Quellenstufen. 1024 und 9000 Quellen scheitern bereits beim groben
   Navigieren an der Grenze von 512 Quellkacheln. Die geplante maßstabsgerechte
   Übersicht ist noch nicht implementiert.

Ein Host-/Sprachwechsel folgt aus diesen Befunden nicht. Der Plan priorisiert
kurze gezielte Korrekturen dieser beiden Wege vor weiteren Fachwerkzeugen.

## Identität und vorhandene Belege

Der Laufzeitkandidat wurde aus sauberem Arbeitsbaum gebaut und als eigenständiges
Forge-Paket gestartet. Nachfolgende Änderungen betreffen die Dokumentation.

| Identität     | Wert                                                               |
| ------------- | ------------------------------------------------------------------ |
| Codecommit    | `442576ccb9bce95cb6d7c63758b4a2829f77af63`                         |
| Quell-SHA-256 | `f8261ae209f3e1db73fc505b7d2befe356af2719cfc530bc16b20ce4fb5b74f4` |
| Lock-SHA-256  | `8f90d72914d5d7599759b5d117e4c40457f883f4213f870940a1167db6a17839` |
| Paket-SHA-256 | `3dd319c486e0e55056737539e29bead6869dc00a39af010c3de24a388568c165` |

| Prüfung                                                 | Nachweis und Grenze                                                                                                                                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-Modell, Raster, Renderer, Beobachtung und Auswertung | 80 Tests bestanden am Codekandidaten.                                                                                                                                                                     |
| SQLite-Store und Skalierungsfixtures                    | 12 Tests bestanden in Electrons tatsächlicher Laufzeit.                                                                                                                                                   |
| TypeScript, Syntax und Format der damaligen Änderungen  | Bestanden am damaligen Kandidaten; kein Nachweis neuer Laufzeitänderungen.                                                                                                                                |
| Gezielte Interaktionsvorprüfung                         | 17 Inhalts-/Interaktionschecks und fünf Fehlerkontrollen bestanden (`repair-interactions-5`); früherer Arbeitsstand, keine vollständige Prüfung des späteren Pakets.                                      |
| Gezielte warme/kalte Lastsammler                        | 100 Striche mit 600 Eingaben bzw. 34 kalte Wechsel vollständig gesammelt, ohne Ereignisverlust (`repair-busy-series-2`, `repair-cold-busy-series-2`); Sammlung allein ist kein bestandenes Leistungsziel. |
| Skalierungsvorprüfung                                   | 32 Quellen einschließlich Relief, History und Dateirundlauf bestanden; 1024 und 9000 Quellen an der weiterhin vorhandenen 512-Kachel-Grenze gescheitert (`repair-scaling-4`).                             |
| Native Vorprüfung des Pakets                            | Exit 2, `NO_NATIVE_DISPLAY` (`representative-final/442576c-native-preflight`).                                                                                                                            |

Alle Belegpfade liegen unter dem ignorierten Verzeichnis `artifacts/atlas-rebuild/`.
Vorprüfungen, deren fehlgeschlagene Vorläufer und Paketnachweise sind verschiedene
Stände; sie werden nicht zu einer bestandenen Gesamtabnahme zusammengesetzt.

## Aussage der vorhandenen Paketjournale

Basis: `artifacts/atlas-rebuild/representative-final/442576c-packaged-full/`.
Die Beobachtungen liegen jeweils in
`release-1-release-1-<Szenario>/observation.json` beziehungsweise
`release-2-release-2-<Szenario>/observation.json`.

Die folgende Auswertung ordnet echte Eingabe, Modelländerung und `edit-submit`
über Eingabe-ID, Session, Revision und tatsächlich übergebenen Frame zu.
**Submission ist keine native Präsentationsmessung.** Der Lauf verwendet
Softwaregrafik mit ANGLE/SwiftShader; die Displayfrequenz ist nicht qualifiziert.

| Warmes Szenario                   | Striche je Gruppe | Edit-Eingabe → exakter Submit, p95, Gruppe 1 / 2 | Pointerup → exakter Submit, p95, Gruppe 1 / 2 |
| --------------------------------- | ----------------- | ------------------------------------------------ | --------------------------------------------- |
| `M03-height-small`, 16 CSS-Pixel  | 100 / 100         | 33,7 / 34,1 ms                                   | 15,2 / 13,0 ms                                |
| `M03-height-large`, 256 CSS-Pixel | 100 / 100         | 284,5 / 282,7 ms                                 | 145,2 / 146,7 ms                              |
| `M04-coarse-fine`                 | 100 / 100         | 35,1 / 34,1 ms                                   | 16,8 / 15,3 ms                                |
| `M06-height-busy`                 | 100 / 100         | 72,7 / 68,5 ms                                   | 55,5 / 50,8 ms                                |

Beim großen Pinsel besitzt in beiden Gruppen **0 von 100 Strichen** eine exakt
zugeordnete Edit-Bestätigung vor Pointerup; gefordert sind mindestens zwei
aktuelle inhaltliche Zwischenstände während der Bewegung. Teilflächen werden
durchaus während der Geste hochgeladen und übergeben. Der Befund bedeutet daher
nicht, dass bis Pointerup überhaupt kein Bildfortschritt stattfindet. Er belegt,
dass der aktuelle genaue Änderungsbereich bei diesem Verlauf nicht rechtzeitig
bestätigt wird. Ein kurzer Inhaltsvergleich muss außerdem abgrenzen, ob die
Bestätigungsregion selbst zu weit gefasst ist.

Der Ausgangsausschnitt der großen Probe lädt acht Quellen mit 262144 Byte. Eingabe → Modell
liegt bei p95 20,2 / 20,4 ms, Modell → Submit bei 268,5 / 268,6 ms.
Die meiste gemessene Verzögerung liegt damit nach der Modelländerung.
Rasterarbeit, überholte Aufträge, Queue und Bestätigungsumfang sind noch nicht
ursächlich getrennt. Weitere Frame-CPU-Optimierungen allein sind nicht begründet.

| Kaltes Szenario                  | Vollständige Wechsel | Navigation → lokal bereit, p95 | Navigation → erster exakter Edit-Submit, p95 |
| -------------------------------- | -------------------- | ------------------------------ | -------------------------------------------- |
| `M10-height-cold`, Gruppe 1      | 34                   | 22,5 ms                        | 498,2 ms                                     |
| `M10-height-cold`, Gruppe 2      | 34                   | 23,7 ms                        | 498,5 ms                                     |
| `M10-height-cold-busy`, Gruppe 1 | 34                   | 353,2 ms                       | 828,0 ms                                     |

Unter Last überschreiten 27 der 34 vollständigen kalten Fälle 750 ms bis zum
Submit. Auch das ist ein konkretes Warnsignal, keine gemessene native
Präsentationslatenz. Die zweite kalte Lastserie ist unvollständig und liefert
keine vergleichbare vollständige Verteilung.

Last bedeutet reale Persistenz einer Datei mit 9008 Quellen sowie einen
rechnenden Höhen-Sampling-Worker zusätzlich zum Rasterworker. Das beweist keine
zwei späteren produktiven schweren Fachjobs und keine große sichtbare Übersicht.
Kalte Ziele sind nach Projektöffnen ungeladen; ein geleerter Betriebssystem-
Dateicache wird nicht behauptet.

Der Paketlauf wurde bewusst mit SIGINT/Exit 130 beendet. Vorhanden sind Log,
`interrupted-metadata.json` und 19 abgeschlossene Beobachtungsdateien ohne
verworfene Ereignisse. Zwei warme Gruppen und drei kalte Serien sind vollständig
protokolliert. Gruppe 3 und nachgelagerte Kontrollen/Skalierungsfälle fehlen.
Es gibt keinen abschließenden `report.json` und kein Gesamt-PASS.

## Erhaltenswerte Korrekturen und offenes Aufräumen

Die Interaktionsprüfung trennt sichtbaren Zoom und Kameraanker. Bewegte Striche
prüfen Modellwerte, Canvasinhalt, Renderübergaben und eine gemeinsame Undo-Aktion.
Die Fehlerkontrollen erkennen ignorierten Zoom, Zeichnen erst nach Pointerup,
verzögerte und fehlende Übergaben; der normale Pfad muss sich danach erholen.
History hält eigene Patches nach Quellenauslagerung. Pointerup fordert nötigenfalls
einen echten Frame an. Sessionwechsel setzt Hintergrundstatistik zurück.
Diese Eigenschaften bleiben erhalten.

Trotz bereits schlankerer Zustandsabfragen dupliziert der Prüfablauf noch Gesten,
Szenarioergebnisse und vergangene Save-Aktivität. Ein vorhandener Bericht mit
100 Laststrichen umfasst 17944269 Byte. Schon ein Szenariozweig enthält
20304 Aktivitätseinträge für 404 unterschiedliche Ereignisse; derselbe Zweig
wird nochmals serialisiert (`repair-busy-series-2/report.json`).
Im normalen Start wird weiterhin Beobachtungsaktivität gesammelt.
P0b plant einen gemeinsamen Ablauf, ein Journal pro Prozess, sofortige
Szenarioauswertung und einen ausdrücklich aktivierten Diagnosebetrieb.

## Nächste Arbeit und verbleibende Abnahme

Der nächste Umsetzungsauftrag beginnt gemäß dem bestehenden Plan mit:

1. **P0b:** Bekannte Journale korrekt auswerten und denselben kurzen Szenarioablauf
   für Richtungsprobe und spätere Vollabnahme verwenden.
2. **P0d:** Den großen Pinsel einmal gezielt aufschlüsseln und seinen direkten
   Änderungs-/Darstellungsweg vereinfachen; ersetzte Snapshot-/Dispatchpfade entfernen.
3. **P0e:** Numerische Übersicht über 32, 1024 und 9000 echte Quellen beweisen:
   begrenzte Reads und vollständige Pflegekosten, sichtbare grobe Änderungen,
   genaue Detailrückkehr, Undo/Redo und Neustart. Keine erhöhte Transfergrenze als Ersatz.
4. **P0-Abschluss:** Native Abnahme am ausgeführten Kandidaten; anschließend
   Zustände und APIs konsolidieren und den vollständigen Funktionsumfang übernehmen.

Fehlender Displayzugriff verhindert unabhängige strukturelle Korrekturen nicht.
Die formale native P0-Abnahme bleibt jedoch **blockiert**: Es fehlt die
nachgewiesene Zuordnung von Atlas-Generation über die verbrauchte Canvasressource
zum tatsächlich präsentierten Compositorframe und eine qualifizierte Referenz.
Submission, RAF und Softwaregrafik ersetzen diesen Nachweis nicht. Einzelwerte
über 50 ms sind außerdem von einem verfehlten p95-Ziel zu unterscheiden.

Die V7-Vergleichsreihe, RPM-Installation und echte OS-Dateidialogbedienung bleiben
offen. Ohne `cargo` konnten hier die Rust-Anteile der Gesamtprüfung nicht
laufen. Die Teilnachweise ersetzen keine Freigabe durch
`Candidate · exact-SHA aggregate`; der PR bleibt ein Draft.
