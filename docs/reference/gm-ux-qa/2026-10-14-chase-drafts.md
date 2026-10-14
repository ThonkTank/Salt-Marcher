# GM-UX-QA: Eine offene Runde nach der Pause wieder aufnehmen

Fortsetzung des [Verfolgungsbefunds](2026-10-14-chase-switch.md). PRODUCT/SCOPE
fordern automatische Sicherung und verlässliche Wiederaufnahme. Eine offene
Runde muss trotzdem von einer tatsächlich bestätigten Runde getrennt bleiben.
Wegwerfkampagne mit zwei Masken, echter Electron-Desktop und SQLite; kein Nutzer-Vault.

- Ausgangsproblem: 36 m, Erschöpfung 1, Komplikation und unfertigen Ergebnistext
  eingeben, normal schließen, neu starten. Im Vorherlauf erscheinen wieder
  18 m, Erschöpfung 0 und leere Texte. Beide App-Ausgänge waren regulär; die
  abschließende Assertion scheitert erwartungsgemäß. Runde bleibt 0.
- Vergleich: Die [Markdown-Notiz](2026-10-14-chase-drafts-markdown.md) hält die
  bestätigte Runde und offene Werte getrennt. Tatsächliches Schreiben und
  frisches Dateilesen [erhalten beide Zustände](2026-10-14-chase-drafts-markdown-comparison.json).
  [Obsidian](https://obsidian.md/help/data-storage) beschreibt lokale Markdown-Dateien;
  [Foundrys Journal](https://foundryvtt.com/article/journal/) dokumentiert
  getrenntes Bearbeiten und Speichern. Das stützt den Bedarf nach dauerhaftem
  Bearbeitungsstand, belegt keine eigene Original-Bediensitzung oder Zeitüberlegenheit.
- Änderung: Eigener checksummierter, revisions-/ID-gebundener SQLite-Entwurf
  speichert Rohfelder einschließlich leerer Zahlen. Autosave hält nur den
  laufenden und den neuesten Schreibstand; Fehler behalten Eingaben und bieten
  lokales erneutes Sichern. Navigation/Schließen warten auf die Sicherung.
  Aktionsbuchung, gezielter Entwurfsverbrauch und Receipt sind eine Transaktion:
  Runde verbraucht ihre Abstände/Erschöpfung/Komplikation, erhält offenen
  Ergebnistext; Teilnehmeränderungen erhalten andere Eingaben, Abschluss
  verbraucht alles. CAS-Konflikte überschreiben keine fremden Entwürfe. Nach
  Teilnehmer-Reconciliation kann Retry den eigenen unveränderten Entwurf an
  die neue Revision anpassen, ohne entfernte Teilnehmer wiederherzustellen.
- Ergebnis: Native Wiederaufnahme zeigt die vier offenen Werte exakt, weiterhin
  Runde 0. Auch ein leerer Abstand übersteht einen weiteren Neustart und sperrt
  Bestätigung; erst ausdrückliche Korrektur auf 36 m erlaubt Runde 1. Leeres
  Tempo wird ebenfalls nicht still zu 0. Speicherfehler → gesperrte Buchung →
  Retry behält die Eingaben. Verbergen/Anzeigen erhält offene Werte. Frischer
  Store bestätigt Runde 1, verbrauchte Rundenfelder und weiterhin offenen
  Ergebnistext; andere Maske bleibt bytegleich. Lost-ack/Receipt-Regression
  bestätigt genau eine Runde. Die öffentliche Projektion nutzt bestätigte
  Werte und enthält keine privaten Entwurfstexte.

Unabhängige Kopie ordnet Campaign/Scene/Chase/Teilnehmer und Entwurfskennung neu
zu; Prosa und Originalpaket bleiben exakt. Schema 43 wird auf 44 übernommen;
fehlende aktuelle Entwurfstabelle und beschädigte/fremde Bytes werden abgewiesen.
Backup und Kampagnenlöschung schließen den neuen Speicher ein.

103 Regressionen, Typprüfung und Build bestanden. Drei native Abläufe mit sieben
regulären App-Ausgängen; der Entwurfsablauf hat drei Starts. 50 zusätzliche
Eingaben während eines laufenden Saves erzeugen im Cachetest nur zwei Writes.
Ein schwerer QA-Job, ein Testworker, 816,5 MiB Spitze, 4-GiB-Limit und kein Swap.
[Verifikation](2026-10-14-chase-drafts-verification.json).

[Vorher](2026-10-14-chase-drafts-before.json),
[Nachher](2026-10-14-chase-drafts-after.json),
[wiederhergestellter Entwurf](2026-10-14-chase-drafts-restored.png),
[Prüflog](2026-10-14-chase-drafts-checks.log).
Die frühere Einschränkung auf flüchtige Rundenvorschläge ist damit für diesen
Ablauf geschlossen. Native Hard-kill-/Stromausfallprüfung, separate Spielerfenster-,
Original-, Zeit-, Accessibility-, Betriebssystem- und Gesamtproduktabnahme bleiben offen.
