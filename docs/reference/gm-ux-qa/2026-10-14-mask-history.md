# GM-UX-QA: Frühere laufende Vorgänge nach einer Pause wiederfinden

PRODUCT/SCOPE und LiveScene-Vertrag verlangen mehrere unabhängige Masken und
verlässliche Wiederaufnahme. Native Electron-Wegwerfkampagnen: aktuelle Gruppe
mit 38 Verfolgungen und 107 vorbereiteten Kämpfen; frühere Gruppe mit 35
Verfolgungen und 103 Kämpfen. Kein Nutzer-Vault und keine installierte Ausgabe.

- Ausgangsproblem: Die Direktauswahl enthält nur 30 Verfolgungen bzw. 100 Kämpfe.
  Eine laufende „Kupfersiegel“-Verfolgung fehlt nach 36 neueren Abschlüssen;
  die älteste „Bronzeschlüssel“-Vorbereitung fehlt hinter 106 neueren Kämpfen.
  Nativer Vorherlauf zeigt beide nicht in der Auswahl; ein frischer Store findet
  dieselben IDs weiterhin. Normales App-Ende, danach erwarteter Assertionfehler.
  Auch die Maskenliste früherer Gruppen verwendete dieselben begrenzten Antworten.
- Vergleich: In der [gleich großen Markdown-Übersicht](2026-10-14-mask-history-markdown.md)
  findet der tatsächliche `rg -n 'Kupfersiegel|Bronzeschlüssel'`-Aufruf alle vier
  gesuchten Überschriften, Zeilen 5/121/553/660. [Obsidian Search](https://obsidian.md/help/plugins/search)
  dokumentiert Inhaltsuche; [Foundry](https://foundryvtt.com/article/combat/)
  dokumentiert mehrere Encounter derselben Scene mit unabhängigen Zügen/Runden.
  Eigene Nutzung der Textdatei und des Desktop-Produkts, Konkurrenzvergleich
  anhand Primärdokumentation. Kein Original-GUI- oder menschlicher Zeitvergleich.
- Änderung: Gemeinsame Suchübersicht für Kampf und Verfolgung, jeweils an die
  aktuelle bzw. frühere Gruppe gebunden. Suche über Titel, Kampfnotizen, Ziel
  und Ergebnis; mehrere Wörter per AND, Groß-/Kleinschreibung und diakritische
  Zeichen unabhängig. Statusfilter, 20 kompakte Ergebnisse pro Seite und
  bidirektionales Blättern mit query-/campaign-/scene-gebundenem Cursor.
  Laufende/vorbereitete Vorgänge stehen zuerst. Backend lädt keine vollständigen
  Masken in die Suchantwort; erst die ausdrückliche Wahl öffnet ihren Fachstand.
  Veraltete Antworten/Callbacks können keine fremde Auswahl öffnen. Lokale
  Fehler leeren alte Ergebnisse und bieten dieselbe Seite erneut an. IME wird
  abgewartet. Das Archiv zeigt Suche und gewählten Detailstand oberhalb einer
  auf zehn Einträge je Art begrenzten Direktauswahl. Ältere Masken bleiben über
  die vollständige Suche erreichbar. Ein zusätzlich reproduzierter Handlerfehler
  wird behoben: Nach fehlgeschlagenem Kampflesen öffnet die sichtbare Suche
  tatsächlich, statt wirkungslos zu bleiben.
- Ergebnis: Nativer Treffer öffnet die ältere Verfolgung, bestätigt ausdrücklich
  Runde 1 mit 27 m und findet sie nach Neustart wieder. Die andere Verfolgung
  bleibt bytegleich und behält ihren offenen Komplikationsentwurf. Älterer Kampf
  ist nach einem erzwungenen Lesefehler über die Suche erreichbar; Auswahl und
  CRLF-Notizen stimmen, sein gespeicherter Stand bleibt exakt. Vorwärts/Zurück
  liefert dieselben Seiten ohne doppelte IDs. Beide ältesten Archivmasken sind
  erreichbar, schreibgeschützt und alle 138 Archivmasken bleiben bytegleich.

Die vorher unerreichbare Aufgabe ist damit im Produkt ausführbar. Eine generelle
Geschwindigkeitsüberlegenheit gegenüber Markdown/Papier oder Konkurrenz ist
weiterhin nicht belegt. Suche umfasst die genannten Felder; freie Teilnehmer-
notizen und Kreaturen-Statblocks sind nicht Teil dieses Suchindex.

Regressionen prüfen alle 38/107 IDs, neue Einträge zwischen Seiten, getrennte
Scopes/Filter, Unicode, doppelte Titel, beschädigte Bytes, alte Replies,
Kontextwechsel und IME. Eine rund 1-MB-Kampfnotiz bleibt unverändert, während die
passende Suchantwort einschließlich Vorschau unter 2 KB bleibt. Die neue Suche
benötigt zusätzliche Indizes, keine Änderung des Recordformats (Schema 44).

139 gezielte Regressionen, Typprüfung und Build bestanden. Vier native Abläufe
mit neun regulären App-Ausgängen; Spitze 870,8 MiB bei 4-GiB-Limit, kein Swap,
ein Testworker und maximal zwei Go-Worker. Mitintegrierte Autonomie-Rollbacks
und Scene-Spielerprojektion sind regressionsgeprüft, keine separate native
Freigabe. Einzelheiten stehen in der
[Verifikation](2026-10-14-mask-history-verification.json).
[Vorher](2026-10-14-mask-history-before.json),
[Nachher](2026-10-14-mask-history-after.json),
[Suchoberfläche](2026-10-14-mask-history-browser.png),
[Archivdetail](2026-10-14-mask-history-archive.png),
[Prüflog](2026-10-14-mask-history-checks.log).

Native Nutzung ist hier auf Linux, normalen Neustart und die beschriebenen
Abläufe begrenzt. Hard-kill, native Spielerfenster, 200-Prozent-/Tastatur-/OS-
Gesamtmatrix, Originalbedienung und vollständige Produktabnahme bleiben offen.
