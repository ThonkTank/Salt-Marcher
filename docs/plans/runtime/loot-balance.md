# Gemeinsame Beutewertung für Ledger und Bilanz

Stand: 14.10.2026. Ergänzt den [Katalog-/Rewardvertrag](../../../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md#nächster-anschluss-für-abschluss-rewards-und-handel).

## Fachregel und ausführbarer Stand

Die gepinnten Program Capabilities, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, L495–535, unterscheiden vergebene
Beute und gekaufte Gegenstände. Verkauftes und Weitergegebenes bleibt der
ursprünglichen Belohnung zugerechnet; tatsächlicher Verkaufserlös ist maßgeblich.
Korrekturen erhalten erklärende Geschichte. Der Quellenhash entspricht
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e` im Register.

`storage/progression.ts` verwendet für `readLedger` und `readLootBalance`
dieselbe `ledgerRewardValue`-Berechnung innerhalb einer Lesetransaktion:
aktuelle geprüfte Itemdefinition, tatsächlicher Erlös bei Verkauf und bestehende
Herkunftskette bei Weitergaben. Die beim Erstgrant vergebene Gutschrift wird
auch über mehrere Besitzer und Teilmengen genau einmal bewertet. Käufe und
Transferempfang begründen keine neue Belohnung. Profile kommen aus dem bereits
geprüften Charakterreader; ungeprüfte Profiltexte gelangen nicht in die Bilanz.

Gegenproben fanden alte Itempreise, ignorierte unbekannte/beschädigte aktuelle
Definitionen und ungeprüfte Profile in der zuvor gesonderten Bilanzberechnung.
Ein kontrollierter DOM-Test zeigte außerdem, dass eine verspätete A-Bilanz in
Kampagne B erschien. Bilanzreads binden nun Aktivierung, Token und Lesereihenfolge.
Bei offenen Werten zeigt die UI Teilwerte und einen offenen Vergleich; eine
Empfängerempfehlung bleibt aus. Eine fehlende Bewertung wird nicht als null
ausgegeben. `copper` ist bei `unknownEntries > 0` ausdrücklich nur der bekannte
Teilbetrag; `gapCopper` darf dann nicht als vollständiger Abstand dargestellt werden.

Fünf SQLite-Prüfungen (`desktop-loot-balance.test.mjs`) decken aktuelle Preise,
mehrfache/partielle Weitergabe mit Verkauf, Fresh, Purchaseausschluss, Nullstapel,
beschädigte und wertlose Definitionen sowie Profilintegrität ab. Zwei kontrollierte
DOM-Prüfungen (`desktop-loot-balance-dom.test.mjs`) belegen Kontextschutz und die
offene Anzeige. Zusammen mit 42 bestehenden Shop-/Ledgerprüfungen bestanden
49 Tests und der Desktop-Typecheck. Das ist lokale Store-/DOM-Evidenz; eine
native Bedienabnahme oder vollständige Rewardqualifikation folgt daraus nicht.

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

## Nächste ausführbare Schritte

1. **Vollständige Guidance qualifizieren.** `storage/session-rewards.ts`,
   `storage/session.ts` und die Session-UI gegen das versionierte D&D-2014-Profil
   prüfen: tatsächlich sämtliche bestätigten XP, effektive erhaltene Beute,
   Forecast, unbekannte Werte und konsistente Rundung. Regel-/Profilversion,
   XP-Basis, erwartete/tatsächliche Beute und Defizit gemeinsam erklären.
   Abnahme: unterschiedliche XP-Stände, korrigierte/weitergereichte/verkaufte
   Grants, fehlender Wert, individuelle Vorschlagsänderung und Neustart;
   keine automatische Änderung bestehender Awards. `session-magic.ts` zusätzlich
   mit verkauften/weitergegebenen/verbrauchbaren magischen Grants und korrigierten
   Definitionen prüfen: einmalige Herkunftswertung, kumulative Seltenheitsrundung,
   endlicher zulässiger Katalogpool und explizit fehlende Definition. Seed,
   Preset-/XP-/Katalogbasis sowie manuelle Itemänderung bis Annahme/Fresh binden;
   keine stillen Ersatzitems außerhalb bindender Quellenvorgaben.
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
