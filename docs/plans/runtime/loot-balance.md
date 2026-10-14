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

## Neuer Sessionanschluss vom 14.10.2026

`storage/session-rewards.ts` verbindet jetzt bestätigte Roster-XP, effektive
Ledgerwerte und die Fortschrittskurve des wirksamen Presets mit dem erwarteten
Session-XP. `applyLootGuidance` verteilt daraus Vorschlagsbudgets;
`fitRewardItems` erhält passende Tabellenitems und füllt den Rest mit Münzen.
Der Sessionwriter/Editor trägt die Quellenbasis weiter. Dieser integrierte
Anschluss ersetzt die frühere Aussage, es gebe noch keinen XP-basierten Code.
Er ist noch kein Beleg für vollständige D&D-2014-Guidance, Transfer-/Korrektur-
semantik oder sämtliche editierbaren und wiederaufgenommenen Vorschläge.

Der ebenfalls integrierte `storage/session-magic.ts` berechnet optionale
kumulative Seltenheitsquoten vor/nach erwartetem XP, zieht erhaltene magische
Beute ab und verteilt den offenen Zielbetrag auf Vorschläge. `fitMagicItems`
erhält passende Tabellenitems und ergänzt revisionierte Katalogdefinitionen;
fehlende Seltenheiten bleiben mit Warnung offen. Sessioneditor und Writer tragen
`SessionMagicGuidance` weiter. Diese Aussage ist Codebefund, keine vollständige
Magie-/Quellen-/Bedienqualifikation.

## Gemeinsame Integritätsprüfung am Session-Rewardanschluss

Der neue Sessionreader verwendete eine eigene Prüfsummen-/JSONleseoperation.
Dadurch passierten korrekt gehashte Ledgerpayloads mit ungültigem Status,
Herkunft oder Mengentyp sowie widersprüchlicher ID, Figurenidentität oder
Revision. Sie konnten Gold-/Magieziele beeinflussen und einen Sessionrun erzeugen.
`sessionLootGuidance` verwendet nun `progression.ts.checkedLedgerRow`, denselben
Reader wie Ledger, Bilanz und Backup. Die vorhandenen Wert-/Herkunftsregeln
bleiben maßgeblich; keine neue Validatorvariante, Migration oder Datenreparatur.

Neun Storeprüfungen in `desktop-session-reward-integrity.test.mjs` belegen die
sechs beschädigten Formen in beiden Guidancewegen. Der echte Sessiongenerator
rollt seine vorher erzeugten Teilruns bei beschädigter Beute zurück; nach
Wiederherstellung gültiger Fixturebytes gelingt die Generierung und ihr Run
bleibt nach Fresh identisch. Mehrfache/partielle Weitergabe mit Verkauf zählt die
magische Menge genau einmal zur Erstvergabe, Käufe nicht. Aktuelle Definitions-
und Mengenberichtigungen ändern die Guidance ohne Umdeutung der aufgezeichneten
Ledgerrevision. Fresh und unabhängige Campaignkopie erhalten Credit/Mengen und
unveränderte Quellpaketbytes. Die isolierten Guidanceproben besitzen keinen
zusätzlichen Produktwriter; der Generatorrollback ist ausdrücklich separat geprüft.

Das schließt diesen Integritätsanschluss lokal. Vollständige Seltenheits-/Profil-
ableitung, sämtliche Quellenbindungen, Annahme nach geänderter Ledgerbasis und
native UI/Prozessabbruch bleiben offen. Insbesondere werden magische Werte im
Gold-only-Modus aktuell monetär berücksichtigt, im kombinierten Modus dagegen
nach Seltenheit. Diese Moduskopplung braucht eine ausdrückliche Fachentscheidung
gegen das versionierte Profil, bevor bestehende Vorschläge umgedeutet werden.

## Nächste ausführbare Schritte

1. **Vorhandene Guidance vollständig qualifizieren.** `storage/session-rewards.ts`
   verbindet bestätigte Roster-XP, die versionierte Presetkurve und geprüfte
   Ledgerwerte zu einer gespeicherten Rechnung: Erwartung vor/nach dem
   Spielabend, erhaltene Beute, Differenz, Ziel und Szenenanteile. Erzeugung,
   Lesen und Sicherung verwenden dieselbe Prüfung für Summen, Figuren und
   Presetidentität. Spätere XP-, Ledger- oder manuelle Rewardänderungen schreiben
   diese ursprüngliche Rechnung nicht um. [Vorschlagsprüfungen](../../../tests/desktop-session-proposal-store.test.mjs)
   decken beschädigte Rechnung/Quellledger, Überschuss, unabhängige Kopie und
   unveränderte Sicherungen ab. Magie-Seltenheitskontingente sind ebenfalls integriert. Noch offen: vollständige Regelherleitung und native Qualifikation des Gesamtverlaufs.
   Native Abnahme: unterschiedliche XP-Stände, korrigierte/weitergereichte/verkaufte Grants, fehlende Werte, individuelle Vorschlagsänderungen und normaler Neustart.
   Weitere Abnahme: verkaufte, weitergegebene und verbrauchbare magische Grants,
   korrigierte Definitionen, einmalige Herkunftswertung, Seltenheitsrundung
   und endlicher Katalogpool ohne stille Ersatzitems.
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
