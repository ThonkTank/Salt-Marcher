# Erklärbare Kampagnenhistorie und Chronik

Stand: 14.10.2026. Verbindlicher Umfang: [SCOPE](../../SCOPE.md),
[Campaign/Data](../../../ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md)
und [Gesamtportfolio](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md).

## Ziel und vorhandene Nutzerwege

Program Capabilities, Revision `9de85c1a26f526acbc1af332ac5962e185c0aab2`,
„Corrections And History“ (L530–535) und „Explanatory Campaign History“
(L887–904), verlangen bestätigte Zeit-, Reise-, Encounter-, XP-, Party-, NPC-,
Stock- und Korrekturfolgen. Frühere Fakten bleiben erhalten; Korrekturen hängen
verknüpfte Einträge an. Weltzeit und Erfassungszeit am Spieltisch sind getrennt.
Quellenhash: `714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.

- **Nachlesen:** Die Chronik verbindet `progress_event`, `world_history` und
  `scene_time_step` unter einem Lesesnapshot. Kategorie und Text filtern vor der
  Ergebnisgrenze, sodass auch ältere passende Ereignisse gefunden werden.
  Partywechsel, Zeit, Besuchsergebnisse, narrative Statusänderungen und
  Todesrettungswürfe bleiben sichtbar; interne Records verdrängen sie nicht.
- **Ausgeben:** UI und Markdown zeigen höchstens 2.000 passende Ereignisse und
  kennzeichnen Kürzungen. Zusammengehörige Kampfawards bleiben vollständig.
  Beschädigte Quellen oder Kontextlabels führen zu einem sichtbaren Lesefehler.
- **Festhalten:** Ein manueller Moment speichert Bereich, Wortlaut, Ursprungsscene,
  damalige Figuren, Ort und Weltzeit. Er bestätigt keine XP, Beute oder Kampfenden.
  Optional entsteht atomar eine offene Quest oder ein Gerücht im vorhandenen
  Wissensbinder; die Chronik öffnet diesen Inhalt über seinen Verweis.
- **Spielabend abgrenzen:** Anfang und Ende werden ausdrücklich in der Chronik
  gespeichert. Der Writer erlaubt nur einen offenen Abend und bewahrt Replay.
  Die letzte Grenze wird unabhängig vom 2.000-Ereignis-Ausschnitt gelesen.
  Dabei werden Einträge vom neuesten bis zur Grenze vor dem Artfilter geprüft;
  beschädigte Marker dürfen keinen zweiten Start freigeben.
  gekürzte Rückblicke sind sichtbar markiert. Vor dem Ende zeigt eine Übersicht
  laufende Kämpfe/Verfolgungen, sichtbare XP-Buchungen und unverteilte Beute;
  deren offene Zustände bleiben erhalten. Abbruch erhält die Abschlussnotiz.
  Ein ausgefallener Chronikread
  sperrt diese Aktionen, lässt die laufende Gruppe und ihre Notizen nutzbar.
- **Entwürfe behalten:** Momentfelder bleiben innerhalb des laufenden Prozesses
  bei ihrer Gruppe, Rückblicknotizen bei ihrer Campaign. Submit bindet Wortlaut, Folgespur und Fokus vor dem Flush;
  ältere Bestätigungen leeren keine neueren Eingaben. Campaignwechsel/Fresh
  besitzen noch keine dauerhafte Sicherung dieser Rohfelder.
- **Kopieren:** Unabhängige Kopien binden strukturelle Gruppen-, Figuren- und
  Folgespurverweise an ihre kopierten Inhalte; freie Prosa bleibt unverändert.

## Vom bestätigten Moment zur Vorbereitung (16.10.2026)

Nach dem Bestätigen einer Quest oder eines Gerüchts öffnet die Ergebniszeile
mit „Quest öffnen…“ beziehungsweise „Gerücht öffnen…“ genau die angelegte
Originalnotiz. Das erneute Suchen ihres Titels entfällt. Der Einstieg bleibt an
die bestätigte Folgespur und die damalige Gruppe gebunden; ein Gruppenwechsel
oder eine neuere Ergebniszeile entzieht der alten Schaltfläche ihre Autorität.
Ein ausgefallener nachträglicher Wissensread nimmt die Speicherbestätigung
nicht zurück. Ein fehlgeschlagenes Öffnen lässt dieselbe Originalnotiz erneut
öffnen, ohne einen weiteren Moment anzulegen.

Im vorhandenen Notizeditor können Beziehungen ergänzt werden. Seine
„Notizmappe öffnen…“ übernimmt ausgewählte Originalnotizen direkt in einen
bestehenden oder neuen Besuch. Damit braucht auch diese Zuordnung keine zweite
Titelsuche. Bestehende Besuchsnotizen und die Originaltexte bleiben eigenständig.
Der native Prüfweg `node tools/test-desktop-moment-follow-up.mjs --out=<Ordner>`
führt Erfassung, Beziehung, Besuchszuordnung, reguläres Beenden sowie frisches
Wiederfinden und Weiterbearbeiten mit isolierten Daten durch. Die
Gegenstückprüfung derselben Aufgabe und menschliche Abnahme bleiben eigene Belege.

## Belege und offene Grenzen

[Storeprüfung](../../../tests/desktop-chronicle-store.test.mjs),
[Fenstergrenzen](../../../tests/desktop-chronicle-window.test.mjs),
[UI-Suche](../../../tests/desktop-chronicle-search.test.mjs),
[Momentkontext](../../../tests/desktop-live-moment-context.test.mjs) und
[Gruppenkopie](../../../tests/desktop-party-history-copy.test.mjs) prüfen reale
Speicher-/Controllerpfade, Replay, Rollback, Fresh, Kopie, Filter und verspätete
Antworten. Der [native Suchnachweis](../../reference/gm-ux-qa/2026-10-13-chronicle-search.md)
umfasst einen älteren Treffer hinter 2.000 Ereignissen, gefilterte Markdownausgabe,
Fresh und kontrollierten IPC-Lesefehler. Er belegt keine vollständige Historie,
Hard-Crash-Wiederaufnahme oder native Abnahme der neuen Folgespur/Spielabendgrenzen.

Rückblick und Übergabe an den nächsten Spielabend sind getrennte Texte am
bestätigten Endmarker. Die Übergabe ist suchbar und Teil der Markdownausgabe;
ihre Rohfelder bleiben bei Dialog- und Kampagnenwechsel sowie neuer Eingabe
während einer Bestätigung erhalten. Offene Punkte liefern einen editierbaren
Vorschlag, keine automatische XP- oder Beutebuchung.

## Nächste ausführbare Lieferung

1. **Fehlende Fachfolgen erschließen.** Tatsächliche Live-/World-/Progression-/
   Shop-/Autonomiecommands gegen den Pflichtumfang prüfen. Fehlende Fakten im
   autoritativen Commit publizieren; Fachwirkung, History und Receipt bleiben
   atomar. Vorhandene Events lesen, keine zweite Eventarchitektur bauen.
   Abnahme je Nutzerweg: Fresh, Replay, kontrollierter Rollback, keine Duplikate.
2. **Korrekturen und Weltzeit verbinden.** Vorhandene `correctionOf`-Verträge
   sowie Scene-/Weltzeit im Reader und UI darstellen. HP-/XP-/Lootkorrekturen und
   rückdatierte Folgen erhalten ihre ursprünglichen Records; Reise-Undo folgt
   seinen eigenen erlaubten Wirkungen.
3. **Navigation und vollständige Ausgabe schließen.** Stabile Cursor, begrenzte
   Kontextqueries und deterministische Zusammenführung liefern weitere Seiten.
   Kontextmaps laden derzeit ganze Kampagnentabellen. Kampfawardgruppen dürfen
   an Seitengrenzen keine Beteiligten verlieren. Vollständiger Export benötigt
   denselben Snapshot, begrenzte Portionen, Abbruch und Fortschritt.
4. **Live-Wiederaufnahme schließen.** Moment- und Rückblickrohfelder vor Fresh
   dauerhaft sichern. Einen unbekannten Commandausgang am gleichen Command prüfen,
   keine neue ID als automatischer Retry. Native IME, Gruppenwechsel, Folgespur-
   Navigation und neue Eingaben während Speichern/Refresh prüfen.
5. **Daten- und Bedienabschluss.** Kopie erhält alle strukturellen Quell-/
   Korrekturverweise und Snapshotbytes. Erasure entfernt eigene Fakten; fehlende
   Ziele bleiben erkennbar, archivierte Eigentümer historische Referenzen.
   Native Tastatur, Skalierung und Markdownausgabe separat abnehmen.

## Desktop-Arbeitsstand 0.120: vollständige Chronikseiten und Ausgabe

Die neue Seitenabfrage zeigt 100 passende Ereignisse und einen stabilen Cursor aus Zeitpunkt, Quellenreihenfolge und ID. Ein eigener schreibgeschützter SQLite-Lesestand hält Fakten und Namen während des Blätterns fest; neue Ereignisse erscheinen erst nach Aktualisieren. Suche/Bereich beginnen einen neuen Lesestand, Verlassen schließt ihn. Der Reader behält je Quelle nur die nächste begrenzte Kandidatenmenge und liest benötigte Kontextnamen in einem kleinen Cache. Awardgruppen werden vor der Seitenauswahl vollständig zusammengeführt. Die bestehende Kurzabfrage bleibt für andere Produktleser verfügbar.

Markdown ausgeben verwendet einen eigenen festen Lesestand und schreibt sämtliche Treffer portionsweise in eine temporäre Nachbardatei. Fortschritt und Abbruch sind sichtbar; erst der vollständige synchronisierte Inhalt ersetzt die gewählte Zieldatei. Ein Abbruch oder Fehler erhält vorhandene Ausgaben. Weder Blättern noch Export schreiben Kampagnenfakten. Der Export scannt verbleibende Quellen bei jeder Portion erneut; große Langzeitlasten bleiben zu messen, der Ergebnisspeicher wächst nicht mit der Ereigniszahl.
