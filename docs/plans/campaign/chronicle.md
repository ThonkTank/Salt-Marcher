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
- **Entwürfe behalten:** Momentfelder bleiben innerhalb des laufenden Prozesses
  bei ihrer Gruppe. Submit bindet Wortlaut, Folgespur und Fokus vor dem Flush;
  ältere Bestätigungen leeren keine neueren Eingaben. Campaignwechsel/Fresh
  besitzen noch keine dauerhafte Sicherung dieser Rohfelder.
- **Kopieren:** Unabhängige Kopien binden strukturelle Gruppen-, Figuren- und
  Folgespurverweise an ihre kopierten Inhalte; freie Prosa bleibt unverändert.

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
Hard-Crash-Wiederaufnahme oder native Abnahme der neuen Folgespur.

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
4. **Moment-Wiederaufnahme schließen.** Rohfelder vor Campaignwechsel/Fresh
   dauerhaft sichern. Einen unbekannten Commandausgang am gleichen Command prüfen,
   keine neue ID als automatischer Retry. Native IME, Gruppenwechsel, Folgespur-
   Navigation und neue Eingaben während Speichern/Refresh prüfen.
5. **Daten- und Bedienabschluss.** Kopie erhält alle strukturellen Quell-/
   Korrekturverweise und Snapshotbytes. Erasure entfernt eigene Fakten; fehlende
   Ziele bleiben erkennbar, archivierte Eigentümer historische Referenzen.
   Native Tastatur, Skalierung und Markdownausgabe separat abnehmen.
