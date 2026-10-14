# Gemeinsame Beutewertung für Ledger und Bilanz

Stand: 14.10.2026. Ergänzt den [Katalog-/Itemvertrag](../../../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md#itemquellen-und-provider).

## Fachregel und ausführbarer Stand

Die gepinnten Program Capabilities, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, L495–535, unterscheiden vergebene
Beute und gekaufte Gegenstände. Verkauftes und Weitergegebenes bleibt der
ursprünglichen Belohnung zugerechnet; tatsächlicher Verkaufserlös ist maßgeblich.
Korrekturen erhalten erklärende Geschichte. Der Quellenhash entspricht
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e` im Register.

`storage/progression.ts` verwendet für `readLedger` und `readLootBalance`
dieselbe `checkedLedgerRow`-Prüfung und `ledgerRewardValue`-Berechnung innerhalb einer Lesetransaktion:
aktuelle geprüfte Itemdefinition, tatsächlicher Erlös bei Verkauf und bestehende
Herkunftskette bei Weitergaben. Die beim Erstgrant vergebene Gutschrift wird
auch über mehrere Besitzer und Teilmengen genau einmal bewertet. Käufe und
Transferempfang begründen keine neue Belohnung. Profile kommen aus dem bereits
geprüften Charakterreader; ungeprüfte Profiltexte gelangen nicht in die Bilanz.

Bilanzreads binden Aktivierung, Token und Lesereihenfolge. Bei offenen Werten
zeigt die UI Teilwerte und einen offenen Vergleich; eine Empfängerempfehlung
bleibt aus. Vollständige Werte berücksichtigen alle gleichauf zurückliegenden
Figuren; Gleichstand an der Spitze bleibt neutral. `copper` ist bei
`unknownEntries > 0` nur der bekannte Teilbetrag; `gapCopper` darf dann nicht
als vollständiger Abstand dargestellt werden.

[Storeprüfungen](../../../tests/desktop-loot-balance.test.mjs) decken aktuelle
Preise, Weitergaben mit Verkauf, Fresh, Käufe, Nullstapel, unbekannte Werte und
Profilintegrität ab. [DOM-Prüfungen](../../../tests/desktop-loot-balance-dom.test.mjs)
prüfen Kontextwechsel und die offene Anzeige. Native Bedienabnahme und
vollständige Rewardqualifikation bleiben offen.

## Sessionvorschläge

`storage/session-rewards.ts` verbindet bestätigte Roster-XP, geprüfte Ledgerwerte
und die Fortschrittskurve des wirksamen Presets mit den erwarteten Session-XP.
Goldbudgets werden auf die Vorschläge verteilt; passende Tabellenitems bleiben
erhalten, der Rest wird mit Münzen ergänzt. Optional berechnet `session-magic.ts`
kumulative Seltenheitsquoten und ergänzt revisionierte Katalogdefinitionen.
Fehlende Seltenheiten bleiben mit Warnung offen.

Erzeugung, Lesen und Sicherung prüfen dieselbe gespeicherte Rechnung:
Presetidentität, Figuren, Erwartung vor/nach dem Abend, erhaltene Beute, Differenz,
Ziel und Szenenanteile. Spätere XP-, Preis- oder Rewardänderungen schreiben diese
ursprüngliche Rechnung nicht um. Die Quellledger verwenden `checkedLedgerRow`;
kein zusätzlicher Ledgerreader. [Vorschlagsprüfungen](../../../tests/desktop-session-proposal-store.test.mjs)
und [Rewardprüfungen](../../../tests/desktop-session-reward-integrity.test.mjs)
belegen beschädigte Daten, atomaren Generatorrollback, Weitergaben mit Verkauf,
Käufe, Definition-/Mengenkorrekturen, Überschuss, Fresh und unabhängige Kopie.
Quellpaket und vorhandene Sicherungen bleiben unverändert.

Vollständige Regel-/Profilherleitung, Quellenbindungen, Annahme nach geänderter
Ledgerbasis und native Bedien-/Prozessabbruchprüfung bleiben offen. Magische
Werte werden im Gold-only-Modus monetär, im kombinierten Modus nach Seltenheit
berücksichtigt. Diese Moduskopplung braucht eine ausdrückliche Fachentscheidung
gegen das versionierte Profil, bevor bestehende Vorschläge umgedeutet werden.

## Nächste ausführbare Schritte

1. **Guidance vollständig qualifizieren.** Regel-/Profilversion, XP-/Preset-/
   Katalogbasis, erwartete/tatsächliche Beute und Defizit gemeinsam erklären.
   Native Abnahme: unterschiedliche XP-Stände, korrigierte, weitergegebene,
   verkaufte und verbrauchbare Grants, fehlende Werte/Seltenheiten, kumulative
   Rundung, endlicher Katalogpool, individuelle Vorschlagsänderungen, Annahme
   und normaler Neustart. Keine stillen Ersatzitems oder Änderungen bestehender
   Awards.
2. **Historie und Transfer schließen.** Treasury-, Ledger- und Quest-/Encounter-
   Herkunft in `storage/treasury.ts`, `storage/campaign-data.ts` und `chronicle.ts`
   gemeinsam prüfen. Nach unabhängiger Kopie müssen Preise, Belohnungscredit und
   erklärende Korrekturen stimmen; freie Prosa und Quellpaketbytes bleiben erhalten.
   Der geprüfte persönliche Session-Guidancepfad erhält Credit/Mengen nach
   Mehrfachweitergabe, Verkauf, Fresh und unabhängiger Kopie. Treasury-/Quest-/
   Encounterherkunft und erklärende Korrekturgeschichte zusätzlich abnehmen;
   dieser lokale Ledgerbeleg ersetzt ihre Owner-/Transferclosure nicht.
3. **Bedienung und Aufwand qualifizieren.** Native Kampagnenwechsel während eines
   Reads, unbekannte Preise und Itemkorrektur bis Fresh prüfen. Die Bilanz scannt
   weiterhin das gesamte Ledger und kann pro Weitergabe eine Herkunftsquery
   ausführen. Erst am realen Mengenfall messen; gegebenenfalls Bewertungsdaten
   pro Lesetransaktion teilen. Kein zweiter persistierter Bilanzstand ohne
   nachgewiesenen Bedarf.
