# Verstreute Notizen für einen Spielabend organisieren

## Aufgabe

Für **Abend 7 · Die Übergabe**, Besuch **Im Archiv ermitteln**, werden drei vorhandene Quellen zum **Lastenaufzug** gesucht: Nera, Die flüsternden Listen und Nachtwache. Eine bereits verknüpfte Quelle außerhalb dieser Suche muss erhalten bleiben. Die Spielleitung soll Inhalte lesen, die passenden Identitäten verknüpfen und anschließend alle Quellen in der Spielabendmappe nutzen. Die Notiztexte und der zweite Besuch dürfen dabei nicht verändert werden.

## Tatsächliche Vergleichsreihenfolge

### Werkstatt zuerst

Ein eigenes SQLite-Profil enthielt zwölf Notizen, zwei Besuche und die drei Quellen mit expliziten Raum-Key-Verweisen zum Archiv. Die vorhandene Verknüpfungsliste zeigte nur Titel: keine Inhaltssuche, keine Textvorschau. **Lastenaufzug** war in dieser Liste nicht sichtbar. Die Wissenssuche fand die drei Quellen samt Textstellen; die Notizen wurden dort einzeln gelesen. Nach Rückkehr zur Planung mussten die drei Titel erneut in der vollständigen Liste gewählt werden. Die bestehende Quelle blieb erhalten und die Spielabendmappe enthielt anschließend korrekt alle vier Notizen.

[Native Ausgangslage](before/result.json), [Titel ohne Inhaltssuche](before/title-only-list.png), [erneute vollständige Liste nach Wissenssuche](before/after-knowledge-search.png), [bereits funktionierende Mappe](before/packet.png).

Geprüfter Vorher-Quellstand: `4915339dbfb14b52ca3a31a7899aa1719ae4099e`, Version 0.133.0. Der native Lauf startete erst nach dem abgeschlossenen Desktop-Build und bindet fünf Artefakt-Hashes. Keine Nutzerkampagne wurde verändert.

### Anschließend Logseq

In der erhaltenen offiziellen Demo wurden dieselben drei Hinweisquellen und eine Spielabendseite mit zwei Besuchen verwendet. Bestehende synthetische Nera-/Listen-Inhalte blieben erhalten; die Aufzugshinweise wurden ergänzt, Nachtwache als eigene Seite aufgebaut. Ein temporärer Aufbauverweis wurde danach entfernt.

Die globale Suche **Lastenaufzug** zeigte vier Blocktreffer samt Text: die drei Notizseiten und die zusätzliche Raumseite Torhalle. Sie half damit bei der Identifikation, benötigte aber noch die Auswahl passender Quellen. Ein Escape leerte zuerst die Suchanfrage; erst das zweite schloss die Suche.

Im Archivabschnitt der Spielabendseite wurden normale Seiten-Einbettungen eingegeben: `{{embed [[Nera die Quartiermeisterin]]}}`, `{{embed [[Die flüsternden Listen]]}}` und `{{embed [[Nachtwache]]}}`. Die Oberfläche zeigte danach alle drei Quelltexte direkt im Abend, ohne dass deren Prosa in den Vorbereitungstext kopiert wurde. Der Rückwegabschnitt blieb als eigener Besuch erhalten. [Inhaltstreffer](logseq/content-search.png), [tatsächliche Quellen-Einbettungen](logseq/embedded-session.png).

Verglichen wurde ein konkreter Arbeitsablauf, kein identisch großer Leistungsdatensatz: Die Werkstatt besaß zwölf explizite Notizen; die Demo behielt weitere Raum- und Notizseiten aus früheren Fällen. Es gibt keine vergleichende Zeit- oder Klickzahlwertung. Die zuvor angezeigte Demo-Version war 1.0.0, derselbe Dokumentstand blieb erhalten. Ohne lokales Verzeichnis weist die Demo auf fehlende dauerhafte Speicherung hin; dort wurden weder Datenträger- noch Neustartpersistenz geprüft.

## Übernommene Arbeitsweise

**Verknüpftes Weltwissen** im Besuch ist jetzt ein zusammenhängender Arbeitsbereich:

- Inhaltssuche nach Namen, GM-Notizen und Vorlesetext, mit markierten Textstellen und Quellenart. Die bestehende FTS-Suche liefert höchstens 40 Notizkandidaten pro Anforderung; weitere Treffer werden ausdrücklich geladen. Der Bereich sucht nur Notizen, ohne Raum-/Ortsresultate dazwischen.
- Bereits verknüpfte Notizen stehen unabhängig von Suchtreffern oberhalb der Suche. Eine Suche ohne Ergebnis löscht oder versteckt diese Auswahl nicht. Verknüpfungen werden ausdrücklich gelöst.
- **Lesen** zeigt die aktuelle Originalnotiz direkt beim Besuch, einschließlich Vorlesetext und gespeicherter Raumverweise. Die Vorschau verändert keine Prosa. **Notiz bearbeiten…** führt bei Bedarf zum vorhandenen Editor; es gibt keinen zweiten Notizschreiber.
- Die Checkboxen und die Vorschauaktion ändern ausschließlich die Notiz-IDs im bestehenden Besuchsentwurf. Der vorhandene Session-Schreiber und seine Quittungs-/Recoverylogik speichern sie. Die bestehende Spielabendmappe sammelt die vollständigen Quellen weiterhin gemeinsam.

Anders als Logseqs gezeigte Seiten-Einbettungen zeigt die Planung eine ausführliche Vorschau auf einmal; alle ausgewählten vollständigen Texte stehen in der vorhandenen Spielabendmappe. Es wird keine identische Editier- oder Einbettungsinteraktion behauptet. Die entscheidende beobachtete Hürde – Planung verlassen, um Hinweise per Inhalt zu finden und zu lesen – entfällt im geprüften Ablauf.

## Schutz der Arbeitsweise

Suche, Lesekontext und Auswahl sind an Kampagnenaktivierung, Plan und Besuch gebunden. Eine ältere Suchantwort, ein abgetrenntes Kontrollfeld oder eine verzögerte Vorschau/Raumantwort kann keine neuere Auswahl oder einen anderen Besuch verändern. Sperren des vorhandenen Schreibers gelten auch für neu erzeugte Kontrollen. Ältere Verzeichnisdaten überschreiben keine frisch gelesene Notizrevision. Beschädigte Kandidaten bleiben als gesperrte Quellen mit Hinweis sichtbar. Textstellen und Originalprosa werden als Text gerendert.

Es gibt keine zweite Notizablage, keine neue Datenbankschema-Tabelle und keine automatische Textkopie in den Plan. Die neue Notizkategorie verwendet den vorhandenen Such-Endpunkt und den vorhandenen abgeleiteten Notizindex. Namen bleiben Anzeigenamen, IDs bleiben Identitäten.

## Prüfnachweise und Grenzen

Geprüfter Produktstand: `078a6be26563df45942d41606ff7c49038a96732`, integriert durch `fc5e50c8`, Version **0.134.0**. Der spätere Fixture-Commit `4fcd92d8` verändert ausschließlich einen Test; die Produktquellen stimmen unverändert überein. Die [Artefaktzuordnung](validation.json) bindet alle sieben nativen Berichte an dieselben fünf Hashes, 15 reguläre Prozessenden und anschließend nicht mehr vorhandene eigene Haupt-PIDs. [Suche, Auswahl und Quellenkontext](after/search-preview-and-links.png), [ausgeführte Aktion bei 200 %](after/reading-200percent.png), [frischer Prozess](after/fresh-visit-links.png), [Spielabendmappe](after/packet.png). Beide Typprüfungen, Repository-Prüfung sowie Plugin- und Desktop-Build sind erfolgreich. Die [gemeinsame gezielte Schlussprüfung](targeted-tests.txt) auf Fixture-Stand `4fcd92d8` bestand **107 von 107 Tests**, einschließlich Notizsuche/-auswahl, Vorbereitung/Recovery, Session-Review/-Mappe und der übernommenen Kampfauflösung.

Der native Wiederholungsfall liest und verknüpft alle drei Hinweise beim selben Besuch, erhält die vierte Verknüpfung trotz leerer Suche und nutzt die Verknüpfungsaktion tatsächlich bei 200 % Zoom. Ein frischer Prozess liest die gespeicherten vier Verweise und die unveränderte Originalquelle. Die Mappe enthält alle vier Quellen. Sämtliche ursprünglichen Notizdokumente und beide Planbesuche werden nach Prozessende direkt aus dem Speicher unverändert geprüft; nur die Notiz-ID-Auswahl des ersten Besuchs darf sich ändern.

Die letzte veröffentlichte Gesamt-CI für `f6afd4bf`, [38811462364](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/actions/runs/38811462364), endete regulär mit drei Fehlern bei 2864 Tests. Die beiden Combat-Tests und der Szenenkopiertest prüften asynchrone Zustände mit einer festen Anzahl unmittelbarer Eventloop-Durchläufe. Die betroffenen Wartehelfer verwenden jetzt eine reale begrenzte Deadline; der Kopiertest wartet außerdem auf die tatsächlich gespeicherte Kopie. Revisions-, Text-, Kampagnen- und Schreibanzahl-Assertions bleiben erhalten.

Der ältere lokale Diagnoseauftrag `93813` wurde nicht neu gestartet und endete regulär: 2860 Tests, 2855 bestanden, vier fehlgeschlagen, einer übersprungen. Er lief während früherer Integrationen und ist kein unveränderlicher Nachweis dieses Quellstands. Seine Fehler und der neue veröffentlichte CI-Handle werden im übergeordneten `work-status.json` getrennt geführt. Gezielte Prüfungen und native Bedienung ersetzen keine vollständige grüne CI. PR-Merge, Release und allgemeine Überlegenheit für menschliche Spielleitungen sind nicht belegt.

Nachtrag vom 16. Oktober: Die vollständige [CI 38814025322](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/actions/runs/38814025322) auf dem veröffentlichten Kopf `e4072f63` ist erfolgreich abgeschlossen: 2890 Tests, 2889 bestanden, keiner fehlgeschlagen, einer übersprungen. Dieser terminale Nachweis ersetzt die damals noch offene CI-Beobachtung für genau diesen Kopf. Spätere Notizmappen-Änderungen besitzen eigene Prüfungen.
