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
ableitung, sämtliche Quellenbindungen sowie native UI/Prozessabbruch bleiben offen.
Die inzwischen ergänzte Prüfung geänderter Annahmegrundlagen folgt unten. Insbesondere werden magische Werte im
Gold-only-Modus aktuell monetär berücksichtigt, im kombinierten Modus dagegen
nach Seltenheit. Diese Moduskopplung braucht eine ausdrückliche Fachentscheidung
gegen das versionierte Profil, bevor bestehende Vorschläge umgedeutet werden.

## Aktuelle Grundlage vor Vorschlagsannahme

`SessionLootGuidance.basis` enthält jetzt die beobachteten IDs/Revisionen der
vergebenden Ledgerwurzeln und ihrer aktuellen Definitionen. Kauffakten und
Transferempfang erzeugen keinen neuen Rewardcredit und invalidieren die Grundlage
nicht allein durch ihre Aufnahme. Bestehende Leser prüfen deren Integrität weiter.
Die Grundlage ist ein strukturierter Teil des vorhandenen Sessionruns, kein
zusätzlicher Ledgerstand und kein opaker ID-Hash. Campaignkopien remappen ihre
Referenzen über die vorhandenen Slots; beim Vergleich werden ungeordnete
Referenzlisten normalisiert.

`assertSessionRewardBasisCurrent` bindet eine neue Annahme an die aktuelle
Planungspartyrevision und, bei automatischem Ausgleich, an den erneut gelesenen
Fortschritts-/XPstand, die effektiven Credits/Magiezahlen, Preset und
aufgezeichnete Ledger-/Definitionsrevisionen. Die tatsächlich ausgewählten
Rewardreferenzen müssen noch derselben verfügbaren Katalogrevision entsprechen.
Ein ausdrücklich gewählter Magiebeutepool wird ebenfalls vollständig mit
`checkedMagicPool` erneut geprüft. Das betrifft auch aktuell nicht verteilte
Poolgegenstände: geänderte Revision oder Papierkorb invalidiert diese
Quellenauswahl, statt sie bei der Annahme stillschweigend zu verkleinern.
Die Prüfung läuft vor Timeline-/Gruppen-/Reward-/Acceptancewirkungen im
bestehenden Writer. Sie ersetzt keine Items, ändert keine Budgets und schreibt
keine älteren Vorschläge um. Bestätigungsreplay und bereits angenommene Inhalte
behalten den ursprünglichen Ergebnisweg. Ältere geführte Runs ohne prüfbare
Grundlage bleiben lesbar; ihre neue Annahme verlangt eine neue Vorschau.
Es gibt keine Migration und keine automatische Neubindung an heutige Revisionen.

Ergänzende Storeproben in `desktop-session-reward-integrity.test.mjs` belegen
XP-/Beute-/gleichwertige Mengen-/Seltenheits-/Planungspartykonflikte ohne
Teilwirkung, eine geänderte zusätzlich gewählte Katalogdefinition sowie gültige
Annahme nach Fresh und unabhängiger Kopie. Receipt-Replay nach späterer
XPänderung, unbeeinflusste andere Figuren/Käufe und der ungeführte manuelle
Vorschlag bleiben wirksam. Ein eigener Gegenbefund am neuen Prüfweg zeigte
zunächst unnötige Invalidierung durch einen Kauf; die Eingabebasis zählt jetzt
nur Rewardwurzeln. Native Interaktion und gesamte Guidanceabnahme bleiben offen.

Drei zusätzliche Poolproben belegen Zurückweisung geänderter oder entfernter,
aktuell nicht verteilter Poolquellen ohne Teilwirkungen sowie gültige Annahme
mit unverändertem Pool nach Fresh und unabhängiger Kopie. Zwei Gegenproben
scheiterten vor diesem Integrationsanschluss an der fehlenden Zurückweisung.

Die Integration des Pools zeigte zusätzlich einen offenen SQLite-Iterator,
der bereits bei erfülltem Ziel ohne Kandidatenbedarf erzeugt wurde. Er blockierte
den Commit des Sessiongenerators. `fitMagicItems` öffnet den Iterator jetzt erst
innerhalb des tatsächlichen Kandidatenwegs. Die bestehende gültige
Generator-/Annahmeprobe deckt diesen Fall mit bereits ausreichender Beute ab.
Die festen Pool- und Vorschlagsformulare liegen in `index.html`; die Picker/
Editoren binden Verhalten und Katalogergebnisse daran, statt ganze Formulare
und Dialoge nachträglich zu erzeugen.
Bestehende Storeproben werden unverändert mitgeprüft. Die Session-DOMfixture
benötigt inzwischen die echten Aktionsbeschriftungen statt alter Buttonpositionen
und die hinzugekommenen NPC-/Quellenreader in ihrer Storefacade. Eine externe
Testkopie ergänzt ausschließlich diese Anschlüsse; die bestehenden Assertions
und die fremde ursprüngliche Testdatei bleiben erhalten. Dies qualifiziert den
aktuellen lokalen Ablauf, nicht einen unverändert grünen Gesamttestlauf oder
eine native Bedienabnahme.

## Nächste ausführbare Schritte

1. **Vollständige Guidance qualifizieren.** `storage/session-rewards.ts`,
   `storage/session.ts` und die Session-UI gegen das versionierte D&D-2014-Profil
   prüfen: tatsächlich sämtliche bestätigten XP, effektive erhaltene Beute,
   Forecast, unbekannte Werte und konsistente Rundung. Regel-/Profilversion,
   XP-Basis, erwartete/tatsächliche Beute und Defizit gemeinsam erklären.
   Die aktuelle Annahme prüft externe Eingänge; `regenerateSessionProposal`,
   `regenerateSessionReward` und manuell geändertem Vorschlags-XP fehlt weiterhin
   ein vollständig abgestimmter Forecast-/Budgetabschluss. Projizierte Gesamt-XP
   und Rundung nach Einzeländerung neu erklären, akzeptierte Inhalte und andere
   manuell bearbeitete Vorschläge unverändert erhalten. Keine stille
   Neubudgetierung fremder Vorschläge. Die derzeit gemeinsame Progressrevision
   benötigt außerdem eine Bedienprobe mit reiner HP-/Reständerung, damit keine
   sachfremden Pflichtregenerationen entstehen.
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
