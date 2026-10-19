# Nach einem Spielabend Originalquellen fortschreiben

**Neunter Fall durchgeführt: Nachbereitung und nächster Abend funktionieren in der verbesserten Werkstatt und in `nb` 7.25.5. Der neue Gegenversuch schreibt über die reguläre CLI und liest zusätzlich über `nb browse`; grafisches Bearbeiten und allgemeine menschliche Usability sind damit nicht abgenommen.**

## Vollständige GM-Aufgabe und Ausgangslage

Nach **Abend 8 · Die Nachtwache** ist bekannt: **Die Nachtwache wird von der Küfergilde bezahlt.** Die Spielleitung soll diese Information an Neras Originalnotiz ergänzen, das dadurch erledigte Gerücht **Drei Glockenschläge** schließen und mit der verbleibenden Frage **Wer führt die Küfergilde?** den nächsten Abend vorbereiten. Der Handlungsstrang **Die Aufzug-Verschwörung** verbindet Nera, dieses Gerücht, die bereits abgeschlossene Fass-Spur und das noch offene Gerücht **Das blaue Siegel**.

Zuerst wurde der bestehende Ablauf im echten Desktop auf `099e3fbf4dd0a67c453abe55dc4290e8195e9251`, Version **0.135.0**, ausgeführt. Das isolierte Profil enthielt zwölf Quellen und die gewöhnliche Übersichtsnotiz mit vier Beziehungen. Der frühere Besuch war bereits mit Übersicht, Nera und Glockenschlägen verknüpft; die Fass-Spur war über den regulären Statusschreiber geschlossen. Keine Nutzerkampagne wurde verändert.

Die Mappe zeigte die Originaltexte und offenen Zustände korrekt, bot aber keine Bearbeitungsaktion. Für die Nachbereitung wurde sie geschlossen, Nera über die bestehende Beziehung geöffnet und ihr Text ergänzt. Der vorhandene Rückverweis führte korrekt zur Übersicht. Danach wurde das Gerücht über eine weitere Beziehung geöffnet und über **Narrative Angaben speichern** geschlossen. Ein weiterer Rückverweis und erneutes Öffnen der Mappe zeigten die verbleibenden Quellen. Der neue Abend ließ sich damit bereits korrekt vorbereiten; es gab keinen beobachteten Datenverlust. Der konkrete Mehraufwand bestand im Verlassen und erneuten Öffnen der Mappe für die beiden Änderungen.

[Verifizierter Vorher-Lauf](before/result.json), [Mappe ohne Bearbeitungsaktion](before/initial-thread.png), [bereits funktionierendes Vorbereitungsergebnis](before/next-session-packet.png).

Ein erster Neustartprüfer erwartete nach dem bewusst geschlossenen Gerücht noch drei aktive Karten. Tatsächlich waren korrekt nur zwei vorhanden. Die Erwartung wurde für den zweiten Start berichtigt und der gesamte Ablauf mit frischen Daten wiederholt. Nur der verifizierte Lauf mit zwei regulären Prozessenden zählt als Vorher-Nachweis.

## Tatsächlich benutzte Alternative: nb

Nach den vollständigen eigenen Vorher-/Nachherläufen wurde dieselbe inhaltliche Aufgabe mit [nb](https://github.com/xwmx/nb) **7.25.5** ausgeführt. Das isolierte Notizbuch enthält dieselben zwölf Quellen, die Übersicht und Abend 8. Quellenstatus wird hier durch reguläre Todos dargestellt; die Datenmodelle sind nicht identisch. Alle Schreibhandlungen verwenden öffentliche Benutzerbefehle (`add`, `todo add`, `edit`, `do`); es gab keine Datenbank- oder Dateimanipulation als Ersatz für die Bedienung.

`nb edit nera.md --content …` ergänzt den neuen Fakt am Original. `nb do 2` schließt **Drei Glockenschläge**. `nb todos open --tags Aufzug` zeigt danach ausschließlich **Das blaue Siegel**, während der Geschlossen-Filter beide erledigten Spuren zeigt. Die acht Nordtor-Spuren bleiben außerhalb dieses Filters. **Abend 9 · Die Küfergilde** wurde mit dem Besuch **Das blaue Siegel verfolgen** und drei Verweisen auf die bestehenden Originale angelegt. Frische CLI-Prozesse lesen die gespeicherte Vorbereitung und Quellen wieder ein. Nera behält ID 1, Übersicht ID 13, Abend 8 ID 14 und die neue Vorbereitung ID 15; Übersicht, altes Abenddokument sowie die unveränderten Quellen stimmen auf Textebene mit dem Ausgangsstand überein. Eine CRLF-genaue Binärgleichheit wird für nb nicht behauptet.

Die fertige Vorbereitung wurde außerdem über nbs eigenen lokalen Webserver geöffnet und nach dessen Neustart erneut gelesen. Alle drei sichtbaren Linkziele wurden über ihre beobachteten URLs aufgerufen: Übersicht 13, Nera 1 mit dem neuen Fakt und Siegel 4 mit der offenen Frage. Der CUA-Klickpfad blieb ohne Effekt; das Lesen über normale Linkadressen funktionierte. Die Schreibabnahme gilt deshalb für die CLI, die zusätzliche Browserabnahme für das Lesen. [Vollständiges Befehlsprotokoll einschließlich Fehlversuchen](nb/transcript.jsonl), [Ausgangsstand](nb/baseline.json), [Ergebnis](nb/result.json), [Version und Installation](nb/installation.json), [Abend 9](nb/abend-9.png), [Neras Original](nb/nera-updated.png), [offene Frage](nb/remaining-clue.png).

| Beobachtung im ausgeführten nb-Ablauf | Verhalten der verbesserten Werkstatt |
| --- | --- |
| Fakt lässt sich direkt am Original ergänzen; keine neue Kopie nötig. | Derselbe vorhandene Editor wird in der Mappe geöffnet; die Vorbereitung verweist auf die Originale. |
| Offene Todos sind mit einem Tagfilter auffindbar. Filterauswertung und neue Linkauswahl wurden getrennt ausgeführt. | Bestätigt geschlossene Quellen verschwinden aus der aktiven Mappe; ausgewählte Originale werden gemeinsam übernommen. |
| Übersicht und neue Vorbereitung enthalten Links; für die Quelltexte wurden weitere Ansichten/Befehle aufgerufen. | Quelleninhalt, Status und Auswahl stehen in der Mappe zusammen; die fertige Spielabendmappe enthält die relevanten Originaltexte. |
| `[[1|Nera die Quartiermeisterin]]` und `[[4|Das blaue Siegel]]` blieben in der geprüften Webansicht unverbundener Text. Erst die korrigierten Dateiverweise wurden als echte Links geprüft. | Die sichtbare Quellenauswahl erstellt bestehende ID-Verweise ohne selbst verfasste Linksyntax. |

Der erste CLI-Aufbauversuch gab einen gewünschten Dateinamen vor dem Todo-Titel an; die Ausgabe behandelte ihn als Teil des Titels, und `do faesser.todo.md` fand kein Todo. Dieser fehlgeschlagene Aufbau bleibt im Protokoll. Der vollständige Fall wurde anschließend in einem neuen isolierten Notizbuch über die ausgegebenen IDs ausgeführt. Der zusätzliche Browserstart benötigte eine ausführbare lokale nb-Datei auf dem temporären PATH und Pandoc; beides wurde isoliert eingerichtet. Das ist Einrichtungsarbeit dieses Tests, kein Beleg für dauerhafte Produktfriction. Keine allgemeine Aussage zu Geschwindigkeit, menschlichen Vorlieben oder fehlenden nb-Fähigkeiten folgt aus diesem einzelnen CLI-Ablauf. Für die bereits beobachteten Umwege ist die vorhandene Werkstattänderung ausreichend; dieser Vergleich erfordert keinen künstlichen weiteren Produktumbau.

## Weitere Zugangsproben

Die erhaltene TiddlyWiki-Seite und Logseq-Demo reagierten weiterhin nicht auf dokumentierte Klick-/Tastaturwege; der frühere erfolgreiche Vergleich ersetzt diesen neuen Schreibfall nicht. Auch in der offiziellen Etherpad-Entwicklungsinstanz ließ sich der Padname eintragen, aber das Formular nicht öffnen. Bei Dillinger blieb **New Document** ohne beobachteten Effekt. Es wurden keine vorhandenen Dillinger-Dokumente verändert. Diese Proben zählen nicht als ausgeführte GM-Vergleiche und nicht als UX-Mängel der Produkte.

Die Zustimmung zu den HedgeDoc-Demobedingungen wurde vom Nutzer ausdrücklich erteilt. Danach blieben sowohl der AX-Klick als auch der semantische Klick auf die Annahmeschaltfläche ohne sichtbare Änderung. Die Annahme selbst ist daher nicht bestätigt; es wurden keine HedgeDoc-Notizen erstellt. [Aktualisierter Zugangsstand](hedgedoc/access-state.json). Die fehlende Browser-Schreibbedienung wurde für diesen Fall durch nbs unabhängig bedienbare reguläre CLI umgangen, nicht durch versteckte Funktionen fremder Anwendungen.

## Zusammenhängende Werkstattänderung

Aus dem eigenen beobachteten Umweg folgt die lokale Verbesserung: **Notiz bearbeiten…** bei jeder verfügbaren Quelle und **Übersichtsnotiz bearbeiten…** öffnen den vorhandenen vollständigen Notizeditor direkt in der Mappe. **Zur Notizmappe** speichert beziehungsweise prüft offene Eingaben über die bisherigen Funktionen und kehrt zur aktualisierten Quellenansicht zurück. Bestätigt geschlossene Spuren verschwinden aus der aktiven Ansicht, ihre gewöhnlichen Beziehungen bleiben erhalten. Die gerade bearbeitete offene Quelle behält ihre vorherige Auswahl; fremd geänderte Quellen benötigen weiterhin eine neue Prüfung. Zielnamen und bewusste Quellenauswahl bleiben erhalten.

Es gibt weiterhin einen Editor mit den ursprünglichen DOM-Knoten, einen Notizentwurf und die bestehenden Text-/Narrativschreiber. Auch die vorhandenen Preparation-Kontrollen für unklare Schreibantworten werden mit angezeigt. Bei unbestätigtem Status bleibt die Originalnotiz offen; die ursprüngliche Quittung wird ausdrücklich geprüft, ohne automatische zweite Speicherung. Ein gemeinsamer kleiner Mount-Helfer stellt verschachtelt ausgeliehene Kontrollen in umgekehrter Reihenfolge zurück. Wird ein äußerer Kontext beendet, werden zuerst seine inneren Kontexte beendet. Dadurch können alte Antworten oder Dialoge den Editor nicht in einer anderen Ansicht zurücklassen.

Der vollständige Nachbereitungsfall wurde danach erneut über die Oberfläche ausgeführt: neue Tatsache in Nera ergänzen, zur Mappe zurückkehren, Gerücht schließen, zurückkehren, verbleibende Frage lesen, neuen benannten Abend/Besuch anlegen und die fertige Spielabendmappe benutzen. Die Rückkehr aus der Bearbeitung wird tatsächlich bei **200 % Zoom** ausgeführt. Ein regulärer Neustart zeigt die aktualisierte Originalnotiz und den bestätigten Status erneut. [Nachher-Lauf](after/result.json), [Bearbeitung und tatsächlich ausgeführte Rückkehr](after/edit-return-200percent.png), [frischer Originalstand](after/fresh-remaining-sources.png), [verwendbarer nächster Abend](after/next-session-packet.png).

Der Speichervergleich bestätigt: Nur Neras beabsichtigter Text wurde geändert. Ihr ursprünglicher Vorlesetext einschließlich CRLF, alle anderen Originalnotizdokumente, die Übersichtsnotiz samt Beziehungen und der frühere Plan/Besuch bleiben erhalten. Der nächste Besuch verweist genau auf Übersicht, Nera und blaues Siegel. Die geschlossenen Quelltexte sind nicht ausgewählt; ihre Namen bleiben im Beziehungsanhang der Übersicht sichtbar.

## Prüfung und offene Abnahme

Produktquellstand **0a3b6b11a6c0dcbe75c66beff565e6723ec4d1d8**, integriert durch **42fc7a9c**, Version **0.136.0**. [Validierung](validation.json) und [199 gezielte Tests](targeted-tests.txt) unterscheiden Quellstand, native Artefakte und CI. Die Tests umfassen reale Preparation-/Narrativintegration, Composition, manuelle Quittungsprüfung, verlorene Antworten, Kampagnenwechsel, veraltete Öffnungs-/Rückkehrantworten, unveränderte Originale sowie verschachtelte Editor-Rückgabe. Beide Typprüfungen, Repository-Prüfung sowie Plugin- und Desktop-Build bestehen.

Auf denselben fünf Artefakthashes wurden zusätzlich die Quellenorganisation aus dem vorherigen Fall und der Raum-Key-Notizkontext erneut benutzt. Letzterer öffnet nun auch aus der bereits neben dem Key angezeigten Notiz eine Mappe, leiht denselben Editor erneut aus, gibt ihn zurück und führt anschließend die ursprüngliche Textänderung mit Composition-Schutz und Neustart aus. Insgesamt sechs reguläre App-Prozessenden auf dem finalen Build; die eigenen Haupt-PIDs sind anschließend nicht mehr vorhanden.

Die vorherige vollständige [CI 38818222989](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/actions/runs/38818222989) auf **76406c96** endete mit drei Fehlern bei 2931 Tests: zwei Timeline-Testmodule besaßen den neuen Session-Port nicht, der Kopiertest wartete zu kurz auf den neuen Dialogzustand. Nach Aktualisierung der Port-Doubles wurde außerdem die fehlende Dialog-Unterstützung ihrer DOM-Umgebung sichtbar und ergänzt. Der Kopiertest wartet auf tatsächlich geladene Auswahl, tatsächlichen Versand und danach die freigegebene neue Ansicht; seine Eigentums- und Navigationsassertionen bleiben erhalten. Die betroffenen **27 Tests** und die gemeinsame Schlussprüfung bestehen. Diese ältere Fehlerlage wurde anschließend behoben; die neuere grüne CI ist separat belegt.

Die vollständige [CI 38822316945](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/actions/runs/38822316945) auf **b8cbc3b269aea265f26b993f90927b45affbde56** ist erfolgreich: 2978 Tests, 2977 bestanden, keiner fehlgeschlagen, einer übersprungen; Typprüfungen und Builds bestanden ebenfalls. Dieser Nachtrag verändert ausschließlich Vergleichsbelege. Allgemeine menschliche Usability-Wertung, Nutzerabnahme, Merge/Release und der breite Vergleichsauftrag bleiben offen.


## Integrationsnachtrag und offener Zugang

Der weitere gemeinsame Stand **6e5d6285** trennt freie Dungeon-Platzierung von Reiseereignissen. Er wurde normal integriert. Produktstand **8b75f7fdc26bd8abf04ca726159cd4f164ff5a79**, weiterhin **0.136.0**, besteht [92 gezielte Speicher-/Vorbereitungsprüfungen](placement-integration/targeted-tests.txt), beide Typprüfungen, Repository-Prüfung und Desktop-Build. Der vollständige Nachbereitungsfall wurde auf diesem Build erneut nativ bis Spielabendmappe und Neustart benutzt. [Native Ergebnisse](placement-integration/native-result.json) und [Artefakt-/Prozesszuordnung](placement-integration/validation.json) belegen zwei reguläre Prozessenden und anschließend nicht mehr vorhandene eigene Haupt-PIDs. Nur `main.cjs` änderte sich; Preload, Renderer, HTML und CSS sind bytegleich mit dem zuvor geprüften Stand. Die ursprünglichen 199 Tests und sechs nativen Prozessenden bleiben ihrem ursprünglichen Quellstand zugeordnet.

Die inzwischen terminale [CI 38820907006](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/actions/runs/38820907006) auf **fea06154** hatte 2976 Tests: 2974 bestanden, einer fehlgeschlagen, einer übersprungen. Der einzelne Fehler war die Wartebedingung des verzögerten Batch-Quelllesetests. Der unveränderte Test bestand lokal; seine 100 unmittelbaren Eventloop-Durchläufe wurden durch eine begrenzte reale Deadline ersetzt. Vor dem Bestätigen prüft er zusätzlich die tatsächlich offene und bedienbare Auswahl. Die Assertions auf genau zwei übernommene alte Besuche, leeren neuen Plan, leere neue Vorschau und fehlende falsche Erfolgsmeldung bleiben erhalten. [64 Session-/Recoverytests](placement-integration/batch-recovery-tests.txt) bestehen. Der alte CI-Auftrag wurde beobachtet und bis zum regulären Ende belassen; keine Wiederholung dieses alten Kopfes wurde gestartet.

Der aktuelle Konkurrenz- und Zugangsstand ist oben dokumentiert. Der ausgeführte nb-Ablauf ersetzt den fehlenden neuen TiddlyWiki-/HedgeDoc-Schreibversuch als Gegenprobe für diesen konkreten Fall; eine grafische Schreibabnahme dieser Produkte wird weiterhin nicht behauptet.

## Abgeschlossene Spur wieder aufnehmen und denselben Abend weiterverwenden

Am 19.10.2026 wurde diese vollständige Folgeaufgabe auf Basis
`94e57937c` erneut im nativen Desktop ausgeführt: Fass-Spur wieder öffnen und
Hinweis ergänzen, Neras Original aktualisieren, dieselbe Dossierauswahl zum
vorhandenen Abend 9 übernehmen, dessen Mappe lesen, normal schließen, frisch
wiederfinden und die Spur weiter bearbeiten. Der frühere Abend 8 bleibt erhalten.
[Versionen, Bundlehashes, Ergebnisse und Prozessenden](reopen-handoff-results.json).

[Vorher](reopen-before-source-only.png) öffnet „Für Spielabend verwenden…“
innerhalb der Quellenbearbeitung eine eigene Mappe nur für diese Quelle.
Die ursprüngliche Dossierauswahl liegt dann eine Ebene zurück. Der bereits
erfolgreiche Weg über „Zur Notizmappe“ bleibt erhalten. Wer stattdessen die
sichtbare Spielabendaktion benutzt, wechselt den Gegenstand und muss zurück.
Der vollständige Ausgangsablauf wurde bei beiden Skalierungen benutzt.

[Im Quelleneditor](reopen-editor-200.png) ersetzt jetzt „Mit dieser Mappe zum
Spielabend…“ den konkurrierenden Einzelquellen-Übergang. Der Button nutzt den
vorhandenen Flush und Rückweg und [öffnet die Dossierauswahl am gewählten Besuch](reopen-handoff-200.png).
„Notizmappe öffnen…“ bleibt der ausdrücklich getrennte Weg zur eigenen Mappe der
Quelle. Es gibt keinen neuen Writer oder automatischen Besuchsauftrag.

Der native Ablauf `tools/test-desktop-note-reopen.mjs` prüft beide Skalierungen,
eine bewusst abgewählte Quelle, den gewählten Abend trotz eines weiteren Plans,
kontrolliert ausgelöste IME-Sperre und ausdrückliche Fortsetzung, aktuelle Texte
in der Spielabendmappe sowie Fresh/Weiterbearbeitung. Canonical Store-Reads prüfen
unveränderte Übersichts-/Siegelnotizen, frühere Planung, vorhandene Besuchsprosa,
Vorlesetexte und Verweis-IDs. Vier reguläre Exits 0 und abwesende PIDs sind gebunden. Der unabhängige native
Unterstrang-Ablauf besteht zusätzlich bei 200 % Zoom: eigene Quellenmappe öffnen,
Original bearbeiten, übergeordnete Auswahl und Besuch wiederherstellen, den
Unterstrang vorbereiten und nach regulärem Neustart lesen (zwei weitere Exits 0).

[Obsidian nach Neustart und weiterer Quellenbearbeitung](reopen-obsidian-fresh.png)
verwendet einen eigenen Vault: Dossier mit Originaleinbettungen öffnen, erledigten
Task im Original wieder öffnen, Fass- und Nera-Original ergänzen, denselben Abend
mit den Originalen verknüpfen, normal schließen, frisch öffnen und die Spur weiter
bearbeiten. Der Status wird dort als gewöhnliche Checkbox geführt. Die Aufgabe
lief mit den installierten Obsidian-1.14.4-App-Dateien unter Test-Electron 44.7.0;
das qualifiziert nicht den Flatpak-Launcher. Früherer Abend, Dossier und Siegeltext
bleiben unverändert; es entstanden keine zusätzlichen Notizdateien.

Belegt ist der entfallene Wechsel zu einer Einzelquellen-Mappe. Es wird weder eine
allgemeine menschliche Präferenz noch eine Paketinstallation oder vollständige
SMR-AC-03-Abnahme behauptet.
