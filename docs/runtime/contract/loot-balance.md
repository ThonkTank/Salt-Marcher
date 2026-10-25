# Gemeinsame Beutewertung für Ledger und Bilanz

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 14.10.2026. Ergänzt den [Katalog-/Itemvertrag](../../catalog/requirements/catalog-encounters-4.md#itemquellen-und-provider).

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

[Storeprüfungen](../../../tests/runtime/desktop-loot-balance.test.mjs) decken aktuelle
Preise, Weitergaben mit Verkauf, Fresh, Käufe, Nullstapel, unbekannte Werte und
Profilintegrität ab. [DOM-Prüfungen](../../../tests/runtime/desktop-loot-balance-dom.test.mjs)
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
kein zusätzlicher Ledgerreader. [Vorschlagsprüfungen](../../../tests/campaign/desktop-session-proposal-store.test.mjs)
und [Rewardprüfungen](../../../tests/runtime/desktop-session-reward-integrity.test.mjs)
belegen beschädigte Daten, atomaren Generatorrollback, Weitergaben mit Verkauf,
Käufe, Definition-/Mengenkorrekturen, Überschuss, Fresh und unabhängige Kopie.
Quellpaket und vorhandene Sicherungen bleiben unverändert.

Vollständige Regel-/Profilherleitung, vollständige Quellenbindungen
und native Bedien-/Prozessabbruchprüfung bleiben offen. Magische
Werte werden im Gold-only-Modus monetär, im kombinierten Modus nach Seltenheit
berücksichtigt. Diese Moduskopplung braucht eine ausdrückliche Fachentscheidung
gegen das versionierte Profil, bevor bestehende Vorschläge umgedeutet werden.

## Aktuelle Grundlage vor Vorschlagsannahme

`SessionLootGuidance.basis` speichert die beobachteten IDs/Revisionen der
vergebenden Ledgerwurzeln und ihrer Definitionen. Käufe und Transferempfang
begründen keinen neuen Rewardcredit. Campaignkopien remappen strukturierte
Referenzen; der Vergleich normalisiert ungeordnete Listen.

`assertSessionRewardBasisCurrent` prüft vor der Übernahme Planungspartyrevision,
**bestätigte XP**, effektive Credits/Magiezahlen, Preset, Ledger-/Definitionsbasis
und gewählte Rewardreferenzen. Ein eigener Magiebeutepool wird vollständig mit
`checkedMagicPool` geprüft, auch seine aktuell nicht verteilten Gegenstände.
Reine HP-, Heilungs- und Raständerungen der Party-Figuren invalidieren die
Beutegrundlage nicht. Die
aufgezeichneten Fortschrittsrevisionen bleiben als historische Metadaten erhalten.

Die Prüfung läuft vor Timeline-, Gruppen- und Rewardwirkungen. Sie verändert
keine Budgets oder Autoreninhalte. Bestätigungsreplay und bereits angenommene
Inhalte behalten den ursprünglichen Ergebnisweg. Ältere geführte Runs ohne
prüfbare Grundlage bleiben lesbar; eine neue Übernahme verlangt eine neue Vorschau.

[Storeprüfungen](../../../tests/runtime/desktop-session-reward-integrity.test.mjs) belegen
geänderte XP, Beute, Katalog-/Poolquellen und Planungsparty ohne Teilwirkung,
Annahme nach unabhängiger Kopie/Fresh, Replay sowie gültige Übernahme nach
Schaden, Heilung und kurzer/langer Rast. [Vorschlagsprüfungen](../../../tests/campaign/desktop-session-proposal-store.test.mjs)
prüfen Integrität und erhaltene Sicherungen. Native Gesamtabnahme bleibt offen.

`fitMagicItems` öffnet den Katalogiterator erst bei tatsächlichem Kandidatenbedarf.
Die festen Pool- und Vorschlagsformulare stehen einmalig in `index.html`; ihre
Picker und Editoren binden Verhalten und Ergebnisse an diese Vorlage.

## Gezahlter Kaufpreis bei Teilmengen

`paidCopper` ist der gesamte bestätigte Kaufpreis dieser Ledgerteilmenge;
fehlend bedeutet unbekannt, null Kupfer wird als `"0"` aufgezeichnet. Käufe
buchen keine Münzen automatisch ab und erzeugen keinen Rewardcredit.

`partitionLedgerPaidPrice` verteilt beim Split, Shop-/manuellen Teilverkauf,
Geschenk und Charakterweitergabe `floor(gesamt × teilmenge / vorherige menge)`;
der ganzzahlige Rest bleibt auf dem verbleibenden Stapel. Writers prüfen Mengen
und Quellen vorher und schreiben Preis/Menge/Receipt gemeinsam. Merge addiert
bekannte Preise und leert den Quellpreis; ein unbekannter Beitrag macht den
Gesamtpreis unbekannt. Bei Charakterweitergabe steht der Anteil auf der
Abgabezeile, der Empfang erzeugt keine weitere Zahlung. Verkaufserlös bleibt
separat maßgeblich für Beute. Alte Kaufereignisse/Receipts bleiben unverändert;
früher falsch vervielfachte Anteile werden nicht rückwirkend repariert.

[Tradeprüfungen](../../../tests/runtime/desktop-trade-paid-price.test.mjs) verwenden echte
SQLitewrites: 101-Kupfer-Rundung, vollständiger Verkauf, Split/Merge, Geschenk,
Weitergabe, unbekannter Preis, null und großer exakter Betrag. Fresh, Replay,
Lootausschluss und ein Fehler nach den Ledgerwrites prüfen Rollback und
Statusklärung. Native IPC-/Handelsabnahme bleibt offen.

## Nächste ausführbare Schritte

1. **Guidance vollständig qualifizieren.** Regel-/Profilversion, XP-/Preset-/
   Katalogbasis, erwartete/tatsächliche Beute und Defizit gemeinsam erklären.
   Native Abnahme: unterschiedliche XP-Stände, korrigierte, weitergegebene,
   verkaufte und verbrauchbare Grants, fehlende Werte/Seltenheiten, kumulative
   Rundung, endlicher Katalogpool, individuelle Vorschlagsänderungen, Annahme
   und normaler Neustart. Keine stillen Ersatzitems oder Änderungen bestehender
   Awards.
   Einzelregeneration und manuell geänderte XP benötigen weiterhin einen
   konsistenten Forecast-/Budgetabschluss ohne Neubudgetierung anderer Entwürfe.
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


## Persönliche Stapel bearbeiten

Die persönliche Beute unterscheidet Weitergabe, Teilen und Zusammenführen über
„Aktion“. Empfänger erscheinen nur bei Weitergabe; beim Zusammenführen steht
statt einer Teilmenge der passende angezeigte Quellstapel. Die Vorschau nennt
Restbestand beziehungsweise die zusammengeführte Gesamtmenge, ohne zu buchen.
Die bestehenden Progress-Writers erhalten Herkunft und ursprüngliche Gutschrift.
Ein Teilverkauf bleibt eine getrennte ausdrückliche Buchung mit tatsächlichem
Gesamterlös. `tools/test-desktop-loot-stacks.mjs` führt Teilen, Teilverkauf,
Zusammenführen und normales erneutes Öffnen mit eigenen Daten aus.
