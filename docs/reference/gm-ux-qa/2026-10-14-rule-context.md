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
Der damalige separate native Kontextlauf ist inzwischen in
`tools/test-desktop-rule-reading.mjs` aufgegangen; der npm-Aufruf
`test:desktop-rule-context-ui` bleibt erhalten. Der gemeinsame aktuelle Lauf
prüft zusätzlich den vollständigen Leseweg und beide Gruppen nach Neustart.

Die native Probe erhält sämtliche ursprünglichen Notizbytes, schließt normal
und öffnet beide Gruppen mit ihren jeweiligen Regeln frisch.

Die Gruppe-Regel-Zuordnung ist damit gezielt geprüft. Vollständige Regelverwaltung,
gesamter Kampagnentransfer, Crash-Recovery, OS-Parität und das Gesamtprodukt
bleiben eigene offene Abnahmen.

54 gezielte Tests einschließlich GM-Proben- und Archivintegration bestanden; Desktop-Typecheck und Build erfolgreich. Zwei native
Starts endeten normal; alle eigenen Electron-PIDs beendet. Ein serieller QA-Job
blieb im Abschlusslauf laut systemd bei rund 628 MiB Spitze unter 4 GiB Limit, ohne Swap.

Der letzte Merge erhält persistente GM-Proben: native Probe mit Vorteil, +2,
SG 10 und angeheftetem Sichtschutz. Zwei Würfel, Maximum +2 und Gruppenzuordnung
wurden im frischen Store geprüft; das Ergebnis blieb beim nativen Neustart in B.
Ein zusätzlicher UI-Fall verwirft die späte Würfelantwort aus A vor der nächsten
Probe in B. [Abschlussbeleg](2026-10-14-rule-context-sync.json).

Letzter Abgleich: Archivierte Scenes sperren ihre Masken und deren Undo; der
Verlauf bleibt erhalten. Die vorhandenen Archiv-Gegenproben bestanden zusätzlich.
Mehrere offene Begegnungen und die gemeinsame HP-Wahrheit bleiben erhalten.


## Hausregel vor dem Festhalten lesen

Am 19.10.2026 wurde auf Main-Basis `ee7d3605305997adb5daa74fa40e02945b69ca96`
eine vollständige weitere GM-Aufgabe ausgeführt: Im geteilten Spiel die
Sicherungsleinenregel nachschlagen, ihren Vorteil und die Einschränkung ohne
Ankerpunkt lesen, für die betroffene Gruppe festhalten, eine Geschicklichkeitsprobe
mit Vorteil, +2 und SG 12 protokollieren, Gruppen wechseln und nach regulärem
Neustart Regelbasis und Ergebnis wiederfinden.

Der vollständige Ausgangsweg funktionierte, aber [am Treffer](2026-10-19-rule-reading-before.png)
stand ausschließlich „Anheften“. Der vollständige GM-Text war erst danach über
„GM-Details“ lesbar. Die ungezielte Liste zeigte kommentarlos nur 20 von 25 Regeln;
die Inhaltssuche nach „schlüpfrigen“ fand die gesuchte Quelle bereits korrekt.

Jetzt öffnet „Regel lesen“ direkt im Treffer das kanonische Original. Lesen
verändert weder Gruppenpins noch Quelltexte. Erst „Anheften“ übernimmt den
angezeigten Stand; eine inzwischen geänderte Quelle wird atomar abgewiesen und
kann ausdrücklich erneut gelesen werden. Die bereits vorhandene Notizsuche
liefert Regeln mit Filter vor der 40er-Seitengrenze, Textfundstelle und weiteren
Treffern. Es gibt keinen neuen Index, Speicher oder Writer.

Derselbe vollständige Ablauf besteht bei [100 %](2026-10-19-rule-reading-100.png)
und [200 % Zoom](2026-10-19-rule-reading-200.png), einschließlich weiterem Scrollen
im langen Regeltext. Die Gegenprobe erreicht zusätzlich alle 45 Regeln über
weitere Treffer. Die betroffene Gruppe erhält genau eine Regelbasis und eine
Probe; die andere bleibt ohne beides. Maximum der beiden Würfel plus Modifikator,
SG-Auswertung, Quellenrevision und alle ursprünglichen Notizbytes werden am
kanonischen Store geprüft. Vier reguläre Exits 0, abwesende PIDs und identische
finale Bundlehashes sind im [Ergebnis](2026-10-19-rule-reading.json) festgehalten.
[Nach Neustart](2026-10-19-rule-reading-fresh.png) bleiben Regel und Ergebnis lesbar.

Die tatsächliche [Obsidian-Gegenprobe nach Neustart](2026-10-19-rule-reading-obsidian.png)
verwendet einen eigenen Vault mit 25 Hausregeln und zwei Gruppennotizen:
Strg+Umschalt+F → „schlüpfrigen“ → Treffer öffnen → vollständige Regel lesen →
bestehende Gruppennotiz öffnen → Regel verlinken, Einschränkung festhalten und
Beispielwürfel 7/11 mit Vorteil, +2 und SG 12 manuell protokollieren → andere
Gruppe und zurück → normal schließen → frisch Ergebnis und Originalregel öffnen.
Die [Inhaltssuche](https://obsidian.md/help/plugins/search) und
[internen Links](https://obsidian.md/help/links) sind Obsidian-Kernfunktionen.
Ein Würfelplugin wurde nicht verwendet; die vorgegebenen Beispielwerte sind kein
Nachweis automatischen Würfelns. Originalregel und zweite Gruppennotiz bleiben
unverändert. Zwei Exits 0 sind belegt. Installierte Obsidian-App-Dateien 1.14.4
liefen unter Test-Electron 44.7.0; dies qualifiziert nicht den Flatpak-Launcher.

Der Vergleich stützt die Trennung von Lesen und Festhalten. SaltMarcher erhält
den Gruppenbezug und berechnet die Probe; Obsidian benötigt hier manuelle
Protokollierung. Eine allgemeine menschliche Präferenz folgt daraus nicht.
69 gezielte Authority-/Store-/Such-/Schnellsuchtests bestehen. Die neue native
Probe ist `tools/test-desktop-rule-reading.mjs` (`GM_QA_ZOOM=2` für 200 %).
Paketinstallation, menschliche Bedienabnahme und vollständige SMR-AC-03/-04-Abnahme
bleiben offen.


Die erste [Candidate-CI auf 20d3f325](https://github.com/ThonkTank/Salt-Marcher/actions/runs/39199584716)
endete mit 4038 bestandenen, vier fehlgeschlagenen und einem übersprungenen Test.
Alle vier Live-Moment-Fälle meldeten den fehlenden `searchDesk`-Port ihres
Testdoppels. Dessen bestehende Storedelegation enthält jetzt auch Suche und
Detailreader; Assertions auf Originalprosa, Gruppenbindung und ausbleibende
Übernahme/Zeitwirkung bleiben erhalten. Der unveränderte Vorher-Test reproduziert
dieselben vier Fehler, die vier gezielten Gegenfälle bestehen mit dem ergänzten
Port. Produktquellen und die nativ geprüften Bundlebytes sind unverändert.
