# Eine vorhandene NSC-Notiz aus einem zweiten Raum wiederverwenden

## Aufgabe und tatsächliche Vergleichsreihenfolge

Nera existiert bereits als NSC-Notiz und ist mit der Torhalle verknüpft. Im Archiv entsteht eine weitere Information über dieselbe Figur. Die Spielleitung soll diese Information bei derselben Nera ergänzen, beide Raumverweise behalten und anschließend im Raum weiterarbeiten.

1. Zuerst echte Kampagnenwerkstatt-Oberfläche: eigenes temporäres SQLite-Profil, markierter GM-Text → Erfassungsdialog → derselbe Titel → Speichern.
2. Danach tatsächliche Bedienung der offiziellen Logseq-Demo: weitere Raumseite, vorhandenen Seitennamen referenzieren, dieselbe NSC-Seite im Kontext öffnen und ergänzen.
3. Aus dem beobachteten Unterschied Umsetzung ableiten und mit eigenen synthetischen Daten nativ wiederholen.

## Vorher

Der Erfassungsdialog bot keine vorhandene Notiz an und legte ohne Rückfrage eine zweite **Nera die Quartiermeisterin** an. Torhalle und Archiv zeigten danach auf unterschiedliche IDs. Die ursprüngliche Nera und ihr Text blieben erhalten, waren aber vom neuen Raum getrennt. [Native Belege](before/result.json), [Dialog](before/capture.png), [getrennte Notiz](before/note.png).

Die bisherige Referenzauswahl konnte vorhandene Notizen bereits verknüpfen. Der Fehler betrifft den neuen Erfassungsweg; Wiederverwendung war im Gesamtprodukt nicht unmöglich.

Vorher-Quellstand: `63ed21e1ebc8358f5503c56149e80eddb5b08ada`. Ein unabhängiger Wiederaufbau mit gleichem relativen Abhängigkeitspfad reproduzierte alle fünf beobachteten Desktop-Hashes: [Zuordnung](before/source-verification.json).

## Derselbe Fall in Logseq

`[[Nera die Quartiermeisterin]]` auf der neuen Torhalle-Seite verwendete die vorhandene Seite. Shift-Klick zeigte deren bisherigen Absatz und jetzt **3 Linked References**: Wachstube, Archiv, Torhalle. Der neue Hinweis wurde in diesem tatsächlich durchlaufenen Weg anschließend separat auf der NSC-Seite eingegeben. [Bedienfolge und Grenzen](logseq/steps.md), [sichtbares Ergebnis](logseq/reused-page.png).

Die Demo war derselbe erhaltene Dokumentstand, in dem zuvor Version 1.0.0 angezeigt wurde. Ohne lokales Verzeichnis weist sie ausdrücklich auf fehlende dauerhafte Speicherung hin. Hier sind weder Neustartpersistenz noch eine allgemeine Überlegenheit geprüft. Auch eine automatische Übernahme markierten Raumtexts wurde in Logseq nicht beobachtet.

## Änderung

- **Notiz zum Raum…** sucht beim Namen nach vorhandenen aktiven Notizen der aktuellen Kampagne. Treffer zeigen Name, Art und einen kurzen GM-Textauszug; nach der Auswahl werden bisherige Raumverweise geladen.
- **Verknüpfen und ergänzen** hängt den eingegebenen Text an die ausgewählte Notiz an. Vorlesetext, Beziehungen und der bisherige GM-Wortlaut bleiben erhalten. Ohne neue Eingabe heißt die Aktion **Verknüpfen und öffnen**.
- Derselbe Name erzwingt eine bewusste Auswahl: vorhandene Identität oder **Eigenständige neue Notiz**. Die Speicherschicht prüft diese Entscheidung ebenfalls, einschließlich normalisierter Groß-/Kleinschreibung und kanonisch gleicher Unicode-Schreibweisen. Verschiedene Figuren dürfen ausdrücklich denselben Namen haben; vorhandene Dubletten werden nicht automatisch zusammengeführt.
- Ergänzung und Raumverweis laufen atomar über die vorhandenen Notiz- und Key-Schreiber. Bereits vorhandene Verweise werden nicht erneut angehängt. Ein bereits verknüpftes Ziel ohne Ergänzung verändert weder Notiz- noch Key-Inhalt.
- Quittungen und explizite Statusprüfung verhindern wiederholtes Anhängen nach verlorenen Antworten. Unsicherer Text bleibt auswählbar erhalten. Veraltete Such- und Raumkontextantworten können eine neuere Auswahl nicht ersetzen.

Es gibt keine zweite dauerhafte Notizablage, keine neue Datenbankschema-Tabelle und keinen zweiten Notizeditor. Treffer sind auf 20 begrenzt; bei weiteren Treffern wird zu genauerer Suche aufgefordert. Nicht lesbare passende Notizen werden ausdrücklich gemeldet.

## Abnahme dieser Runde

Endgültiger geprüfter Quellstand: `4c26e2021cd407e87ee23f80850d65773d91930c`, Version `0.133.0`, gemeinsamer Entwicklungsstand `81f6ccfd`. Produktänderung: `4e898cb8`. Die spätere Berichtsergänzung ändert die gebauten Produktquellen nicht.

Im nativen Wiederholungsfall bleibt genau eine Nera erhalten. Ihr ursprünglicher GM-Text mit CRLF und Randabständen bleibt als identischer Präfix erhalten; genau eine Ergänzung folgt. Beide Räume referenzieren dieselbe ID. Der Vorlesetext bleibt unverändert. Ein frischer Prozess zeigt beide Rückverweise. Erneutes Verknüpfen ohne Text verändert weder die Identität noch den Notizinhalt. Die Aktion ist bei 200 % Zoom sichtbar, frei anklickbar und wurde tatsächlich ausgeführt.

Die [abschließende Zuordnung](validation.json) enthält sechs native Arbeitsabläufe mit denselben fünf Artefakt-Hashes, 13 reguläre Prozessenden und anschließend nicht mehr vorhandene eigene Haupt-PIDs. [75 gezielte Notiz-/Autonomieprüfungen](targeted-note-autonomy.txt), [13 Chronicle-/Autonomieprüfungen](targeted-core.txt), [49 Vorbereitungskontextprüfungen](targeted-preparation.txt) und [15 Chase-/Session-Prüfungen](targeted-chase-session.txt) sind grün. Beide Typprüfungen, Repository-Prüfung sowie Plugin- und Desktop-Build sind erfolgreich. [Neue Oberfläche](after/existing.png), [ausgeführte Aktion bei 200 %](after/reuse-200percent.png), [beide Raumverweise nach Neustart](after/fresh-two-rooms.png), [nativer Ablauf](after/result.json). Lokale, gezielte Prüfungen, vollständige CI und Veröffentlichung/Merge sind getrennte Nachweise.

## Vollständiger Prüfstand und verbleibender Umfang

Der frühere veröffentlichte Gesamt-CI-Lauf [38808338356](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/actions/runs/38808338356) für `f2f85bb4` endete mit 12 Fehlern bei 2834 Tests. In dieser Runde wurden konkrete veraltete Test-Doubles und vorzeitige UI-Aktionen korrigiert: gezielte Profil-/Ortsleser und History-Cursor in Chronicle, der inzwischen benötigte Live-Leser in Treasury, native Eingabe-Konstruktoren und der gebundene Seed-Handler im Session-Test. Die Session-Prüfung bestätigt zusätzlich, dass eine geänderte Planrevision auch bei erneutem Klick keinen Übernahmeauftrag erhält; der bestehende Fehlerdialog bleibt prüfbar offen.

Bei Chase und Szenenkopie warten betroffene Tests auf bedienbare Aktionen beziehungsweise tatsächlich erreichte Haltepunkte. Die Assertions zu unverändertem Text, Kampagnenzuordnung, Revisionsbasis und Anzahl der Schreibaufträge bleiben bestehen. Der gemeinsame Entwicklungszweig ergänzte unabhängig ebenfalls das Warten auf abgeschlossene Autonomie-Schritte; diese Fassung wurde beim Zusammenführen übernommen.

Ein zuvor gestarteter lokaler Gesamtlauf wird regulär zu Ende geführt. Er begann vor der letzten Integration und vor mehreren Fixture-Korrekturen und ist deshalb keine vollständige Abnahme dieses Quellstands. Aktuelle Handles und der veröffentlichte CI-Lauf stehen im übergeordneten `work-status.json`. Kein automatischer Neustart eines laufenden Auftrags und kein Merge- oder Release-Nachweis.

Der Gesamtauftrag bleibt offen: weitere Organisation von Notizen und Vorbereitung vollständiger Spielabende müssen in weiteren tatsächlichen Vergleichsfällen geprüft werden.
