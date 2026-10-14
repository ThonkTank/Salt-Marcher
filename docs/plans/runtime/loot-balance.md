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

## Nächste ausführbare Schritte

1. **Vorhandene Guidance vollständig qualifizieren.** `storage/session-rewards.ts`
   verbindet bestätigte Roster-XP, die versionierte Presetkurve und geprüfte
   Ledgerwerte zu einer gespeicherten Rechnung: Erwartung vor/nach dem
   Spielabend, erhaltene Beute, Differenz, Ziel und Szenenanteile. Erzeugung,
   Lesen und Sicherung verwenden dieselbe Prüfung für Summen, Figuren und
   Presetidentität. Spätere XP-, Ledger- oder manuelle Rewardänderungen schreiben
   diese ursprüngliche Rechnung nicht um. [Vorschlagsprüfungen](../../../tests/desktop-session-proposal-store.test.mjs)
   decken beschädigte Rechnung/Quellledger, Überschuss, unabhängige Kopie und
   unveränderte Sicherungen ab. Noch offen: Magie-Seltenheitskontingente,
   vollständige Regelherleitung und native Qualifikation des Gesamtverlaufs.
2. **Historie und Transfer schließen.** Treasury-, Ledger- und Quest-/Encounter-
   Herkunft in `storage/treasury.ts`, `storage/campaign-data.ts` und `chronicle.ts`
   gemeinsam prüfen. Nach unabhängiger Kopie müssen Preise, Belohnungscredit und
   erklärende Korrekturen stimmen; freie Prosa und Quellpaketbytes bleiben erhalten.
   Abnahme: gesplitteter, zweimal weitergereichter und teilweise verkaufter Grant,
   Definitionkorrektur, Fresh und unabhängige Kopie mit unverändertem Gesamtcredit.
3. **Bedienung und Aufwand qualifizieren.** Native Kampagnenwechsel während eines
   Reads, unbekannte Preise und Itemkorrektur bis Fresh prüfen. Die Bilanz scannt
   weiterhin das gesamte Ledger und kann pro Weitergabe eine Herkunftsquery
   ausführen. Erst am realen Mengenfall messen; gegebenenfalls Bewertungsdaten
   pro Lesetransaktion teilen. Kein zweiter persistierter Bilanzstand ohne
   nachgewiesenen Bedarf.
