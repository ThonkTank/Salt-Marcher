# HEX-00: begrenzte Nachbesserung des Referenzkatalogs

**Arbeitslauf HEX-00-N-P01 – Nachbesserungsplanung.** Start: 2026-10-09T03:08:39+02:00. Ausgangscommit: `5eca8d66c948f90fbcfe9d2e7d55a4f9077142d9`. Ergebnis ist dieser konkrete Plan; Datenmigration, Originalmessungen, Prüferänderung und Fachreview sind folgende eigene Arbeitsläufe.

Grundlagen: [Roadmap](ROADMAP-HEX-ATLAS.md), [HEX-00-Plan](ROADMAP-HEX-00-PLAN.md), [Originalvergleich](WONDERDRAFT-PARITY.md), `acceptance.json.wonderdraftParity.coverageReview` und der [R01-Review](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/commit/5eca8d66c948f90fbcfe9d2e7d55a4f9077142d9). Die vollständigen HEX-00 bis HEX-28 und CITY-00 bis CITY-09 bleiben das Ziel. Welt, Stadt und Dungeon bleiben durch Zoom erreichbar und ohne getrennte Bearbeitungsmodi geplant.

## Ausgangspunkt und Abschlussgrenze

R01 belegt die 13 vorgeschriebenen Startbereiche im frühen Umfang. Seine 29 neuen Frames gehören zu zwei vollständig beendeten Originalprozessen. Der lokale native Inventarteil mit 576 Einträgen besteht die Herkunftsprüfung. Das vollständige Inventartor bleibt offen: sechs Pflichtbefunde, 59 aktive UI-Kennungen ohne lokalen JSON-Direktbeleg, 33 begrenzte Listen-/Palettenkandidaten und vier nicht eingeordnete Paketrollen. Der Vollprüfer meldet außerdem 111 erhaltene Importbelegfehler und 170 offene Meldungen. Diese Zahlen messen weder Parität noch Oberflächenvollständigkeit.

Die konkreten Eingabelisten stehen im unveränderten Reviewverzeichnis `/home/aaron/.cache/dungeon-native-qa/hex-00/review-20261009-024123/`: `review.json`, `catalog-scope-audit.json`, `group-index-audit.json` und `catalog-before.json`. Die abgeschlossenen Originalfolgen und gespeicherten Karten werden wiederverwendet. Neue Messungen betreffen ausschließlich eine nachweislich fehlende Oberfläche, Option oder Zuordnung.

Dieser Plan schließt keinen Befund. Fachfreigabe verlangt weiterhin vollständige frühe Oberflächenzuordnung, belegte Startfolgen und einen eigenen Review ohne Pflichtlücke. HEX-01 beginnt erst nach zusätzlichem Aufräumreview. Tiefe Varianten bleiben vor dem Produktcode ihrer jeweiligen Werkzeugphase verpflichtend. CITY-00 bleibt ein eigener früher Ergebnisreferenzlauf vor CITY-01.

## Sechs Pflichtbefunde und konkrete Änderungen

| Befund | Begrenzte Umsetzung | Prüffähiges Ergebnis |
|---|---|---|
| **HEX00-R01-01** | Frühe Pflichten und spätere Fragen ausdrücklich typisieren; eigenen frühen Probenvertrag ergänzen; Validator und Bedienhinweise daran ausrichten. | Jede bestehende Frage bleibt nachvollziehbar. Eine spätere Wirkungsfrage blockiert ihr zuständiges Tor; eine unbekannte Oberfläche oder unbelegte Startfolge blockiert weiterhin HEX-00. |
| **HEX00-R01-02** | Die 13 im Review sichtbaren Pick-Color-Bereiche ergänzen; Kanalregler und Zahleneingabe als getrennte Eingabewege erfassen. | Modaler Dialog, Inline-Ground-Picker und Coastline-Popup besitzen explizite Kontextzuordnung und passende Originalbelege. Keine ungeprüfte Übertragung ihrer Wirkung. |
| **HEX00-R01-03** | Genau die 33 benannten Optionskandidaten abgleichen; bereits vollständige Belege übernehmen, fehlende Listen gezielt öffnen. | Optionen, sichtbarer Ausgangswert und Kontext sind belegt; dynamische Listen nennen geladenes Set/Profil und erfassten Umfang. Stale offene Hinweise sind begründet aufgelöst. |
| **HEX00-R01-04** | Für die 59 aktiven Importkennungen passende native Belege zuordnen oder deren Originalquelle tatsächlich verifizieren; historische und aktive Belege getrennt prüfen. | Jede aktive Kennung hat einen auffindbaren passenden Direktbeleg. Fehlende Altquellen bleiben mit ihrer Kennung und Aussage sichtbar; sie zählen nicht als aktuelle Abnahme. |
| **HEX00-R01-05** | Nur `area_creator_dialog`, `inspect_dialog`, `news_dialog`, `update_dialog` klären. | Jede Rolle ist als Funktion, Helfer oder Programmservice begründet eingeordnet; Paketfolgerung und tatsächliche UI-Beobachtung bleiben unterscheidbar. |
| **HEX00-R01-06** | Gruppenindizes aus Fallzuordnung ableiten und validieren; bewusste Querverweise separat begründen. | Neue UI-Einträge fehlen nicht im Gruppenindex; verwaiste, doppelte oder unbegründete zusätzliche Verweise führen zum Prüffehler. |

### R01-01: expliziter Daten- und Prüfvertrag

`acceptance.json.wonderdraftParity` erhält einen versionierten `scopeContractVersion: 1`. Bestehende IDs, Proben, `original.state`, breite `plannedOriginalProbe`, `gap` und offene Ziel-/Host-/Reviewfelder bleiben erhalten. Die Migration ist keine neue Originalmessung und setzt keine Fachfreigabe.

**Offene Fragen:** Die bestehenden `observationLimits` bleiben als ursprünglicher Wortlaut erhalten. Für jede ihrer aktuell 164 Aussagen an 160 UI-Einträgen werden eine oder bei gemischter Bedeutung mehrere stabile Fragen in `observationQuestions` ergänzt: `id`, `sourceIndex`, `sourceText`, `kind`, `caseIds`, `duePhase`, `reason`, `state`, `evidence`. Der Prüfer verlangt vollständige Zuordnung zum unveränderten Ausgangstext; eine nicht zugeordnete oder widersprüchliche Aussage bleibt blockierend. Weitere bereits ausdrücklich offene Fallfragen erhalten ebenfalls einen konkreten Pflichtbezug.

Zulässige Arten und ihre Wirkung:

- `inventory`: erreichbare Oberfläche, verfügbare Optionen, sichtbarer Default, unmittelbare Eingabevalidierung oder Kontext noch unbekannt; fällig in HEX-00.
- `initial_sequence`: ein Teil der nachfolgenden frühen Originalfolge fehlt; fällig in HEX-00.
- `original_effect`: eine tiefere Kartenwirkung ist noch unbekannt; fällig **vor Produktcode** der frühesten betroffenen Werkzeugphase. `caseIds`, `duePhase`, konkreter Messablauf und begründete Abgrenzung zur Oberfläche sind Pflicht.
- `host_pair`: das zugehörige Original-/Editorpaar ist noch nicht abgenommen; fällig im Fachphasentor.
- `physical_input`: Maus-/Touchpadprüfung bleibt gesondert fällig im zugeordneten Bedien- beziehungsweise Endabnahmetor. Synthetische RFB-Eingaben können sie nicht schließen.

Sammelaussagen müssen bei gemischter Bedeutung in benannte Teilfragen zerlegt werden, ohne den Ausgangstext zu verlieren. Eine Klassifikation darf nicht allein aus Begriffen wie „Wirkung“, aus einer späten `ui.phase` oder aus dem Wunsch nach einem grünen Tor entstehen. Nicht belegte Auswahlmöglichkeiten, fehlende Zahlenvalidierung und fehlende UI-Kontexte bleiben frühe Inventarpflichten. Ein aufgelöster alter Hinweis braucht direkten Beleg und Begründung; er wird nicht gelöscht. Wird dabei eine zusätzliche konkrete Oberflächenlücke entdeckt, wird sie mit betroffener Kennung und begrenzter Probe als neuer Pflichtbefund festgehalten.

**Frühe Proben:** Jeder der 13 Einträge in `inventoryGate.initialProbeCases` erhält `original.initialProbe` mit `state`, `scope`, `requirements`, `evidence`, `savedEffects`, `reopen` und `review`. `requirements` ordnet jede konkrete Teilpflicht ihren tatsächlichen Vorher-/Nachher-/Abbruchframes zu. `savedEffects` enthält Dateipfad und SHA-256 jeder erforderlichen Rohkarte; `reopen.evidence` verweist auf eine andere vollständig neue Originalsitzung. Die bestehenden Belege werden einzeln übernommen, keine Zeichenkette oder R01-Statusmarkierung ersetzt den eigentlichen Frame-/Kartenbeleg. Wo zusätzliche I03-/R01-Karten maßgeblich sind, muss deren eigene Prüfsumme verwendet werden; das alte gemeinsame A-File ist kein Beleg für alle späteren Themen oder Änderungen.

| Fall | Verbindlicher früher Umfang | Sichtbar verbleibende spätere Pflicht |
|---|---|---|
| WD-001.01 | Neue Karte, Abbruch, Kontrollkarte speichern und frisch öffnen. | Breite spätere Zielparität bleibt offen. |
| WD-001.02 | Zehn Größen-Vorlagen, Dimensionen, Dialoggrenzen, Ausrichtung/Kopplung, Profilwerte nach Neustart. | Wirklich große Karte und vollständige Ausgabe-/Vorgabenwirkung in HEX-26. |
| WD-002.01 | Mitteltasten-/Space-Pan, Zoomanker, Zoomdialog mit Tab, Fit/100-Prozent-Shortcuts. | Physische Maus-/Touchpadprüfung. |
| WD-002.02 | Erste Eingabe nach Laden, Pan und Werkzeugrückkehr mit sichtbarem Endzustand. | Frühere Aussetzer erhalten; keine erfundene Fokusursache oder Regel „ersten Klick ignorieren“. Physische Eingabe gesondert. |
| WD-003.01 | Save, Save As, Abbruch, gewöhnliches Save und frische Öffnung. | Konflikt-, Fehler- und unterbrochene Speicherfolgen in HEX-07. |
| WD-003.02 | New-/Exit-Save, Discard, Cancel; normale Ausgänge; echte automatische Sicherung manuell frisch öffnen. | Crash-/Fehler-/Recoveryfälle in HEX-07; manuelle Sicherungsöffnung beweist keine Crash-Recovery. |
| WD-003.03 | A/B/A und kalte Öffnung: Inhalt/Stil, Groundwerte, eigene Palette, Symbolscale und Einzelassetwahl einzeln einordnen. | Weitere Werkzeug-/Assetfamilien in HEX-07/19; keine pauschale lokale/globale Zuständigkeit. |
| WD-004.01 | Klick, Zug und Mehrpunktbefehl als History-Grenzen; Werkzeugvorgabe außerhalb Kartenhistory. | Befehlsgrenzen weiterer Werkzeuge vor deren Produktcode. |
| WD-004.02 | Escape bei Zug, ruhender Vorschau, Pfadentwurf und Dialog; Werkzeugwechsel getrennt. | Weitere Abschluss-/Abbruchgesten vor deren Produktcode. |
| WD-005.01 | Landzug, Größenwechsel/-grenzen, gespeicherte Geometrie und Neuöffnung. | Vollständige Küsten-/Effektvarianten in HEX-11/24; ergänzende I03-Messungen bleiben belegt. |
| WD-007.01 | Farbauftrag/-mischung/-radierung, Commit, Undo/Redo, Neuöffnung; gemessene Pinsel, Zahlenvalidierung, Fill/Groundfilter und Palette. | Deutliche Opacity-/Velocity-Wirkung, Mehrfachwahl und positive Instanzfilter in HEX-11/24. |
| WD-021.01 | Hex/RGBA-Abschluss, ungültige Eingabe, Farbfläche/Pipette, Escape/Außenklick und modales Cancel/OK in ihren Kontexten. | Weitere Farbfeldfamilien vor ihrer Fachphase. Unbeschrifteter RGBA-Darstellungsschalter ist kein gemessenes HSV-Zahlenfeld. |
| WD-026.01 | Alle neun New-Themen: Kontrollgeometrie, Water/Ground/Coast, Save und Prozessneustart. | Vollständige Themenkomponenten und Wechsel an bestehender Karte in HEX-24. |

`initialScopeReview` bleibt der R01-Befund; `original.initialProbe.review` erhält erst im erneuten eigenen Fachreview die abschließende Entscheidung. Breite Fälle können trotz belegtem frühem Umfang weiter `partial_direct_probe` bleiben.

**Validator:** `validate-inventory.mjs` erweitert seinen Bericht um `blocking`, `deferred` und `historicalEvidenceIssues`; bestehende Herkunfts-/Mappingfehler bleiben prüfbar. `pending` darf als Gesamtliste erhalten bleiben. `--require-complete` verlangt das vollständig reviewte HEX-00-Inventartor und keine frühe Pflichtlücke, nicht das Ende aller Fachphasen. Ein gezielter `--phase HEX-xx`-Aufruf prüft zusätzlich die für diese Phase fälligen Originalpflichten; ein fehlender oder unbekannter Pflichttyp/Phasenbezug führt zum Fehler. Der Phasenbericht unterscheidet Pflichten vor Umsetzung von Pflichten für die Fachabnahme: Ein noch fehlendes Hostpaar setzt keine fehlende Originalprobe außer Kraft und wird nicht vor seiner Umsetzung als bestanden verlangt. Reihenfolge aus der Roadmap, keine lexikografische Phasenordnung und keine pauschale Vertagung bis HEX-28. Offene Host-/physische Pflichten bleiben im Bericht und blockieren ihre Fachfreigabe; sie geben keine fehlende Originalkenntnis vor Produktcode frei.

`inventoryComplete` bedeutet weiterhin vollständiges frühes Referenzinventar, nicht vollständige Produktparität. Es darf nur bei passed A/B/C, eigener Reviewentscheidung und erfüllten frühen Pflichten gesetzt werden. Der Validator entscheidet keine visuelle Vollständigkeit und schreibt keine Torzustände. Ein alter Katalog ohne neuen Vertrag bleibt als Teilstand lesbar; er kann keine vollständige Freigabe behaupten.

### R01-02/03: genau benannte Oberflächen vervollständigen

Der modale Pfad ist `Land > Ground Color Brush > Color Palette > + > Pick Color`. Zu ergänzen sind Pipette, Sättigungs-/Helligkeitsfläche, Hue-Leiste, R/G/B/A, numerischer Darstellungsschalter, HTML, inneres Paletten-Plus, Cancel, OK und Schließen. Jeder RGBA-Kanal besitzt Regler- und Zahlenweg; beide werden getrennt zugeordnet. Neue IDs werden nach Integration an die aktuelle letzte Kennung angehängt, bestehende IDs nicht umnummeriert. Zugehörige Fälle: WD-021.01/.02 und WD-007.01; weitere beteiligte Fachphasen bleiben explizit zugeordnet. Bereits gemessene Modal-/Escape-/Cancel-/OK-Frames verwenden, weitere Kontextwirkung nur bei tatsächlicher Lücke messen.

Die 33 Optionskandidaten sind verbindlich begrenzt:

`WD-UI-0055, 0058, 0123, 0125, 0256, 0287, 0315, 0319, 0322, 0376, 0382, 0418, 0419, 0422, 0435, 0440, 0448, 0449, 0450, 0458, 0463, 0467, 0468, 0480, 0481, 0485, 0491, 0509, 0540, 0563, 0575, 0579, 0582` (jeweils vollständiger Präfix `WD-UI-`).

Vor einer neuen Originalsitzung alle vorhandenen relevanten Optionsframes lesen. Insbesondere Toolbar Display Mode besitzt bereits einen Listenframe, Blend Mode die Werte Normal/Additive, Coastline Style sieben beobachtete Optionen. Fehlende Listen wie Set, Box Style, Frame Style, Numbers Display und Themes bis zum sichtbaren Ende erfassen. Ein geschlossenes Dropdown beweist nicht alle Optionen; eine gescrollte Palette nennt Anfang/Ende und geladenes Set/Profil. Fonts, Assets und eigene Paletten bleiben dynamische Listen, keine erfundene abgeschlossene globale Menge. Je Kandidat gibt es einen belegten Abschluss oder eine konkret offene Inventarpflicht; nicht 33 pauschal angenommene Defekte. Wirkungs-/Undo-/Speicherproben jeder einzelnen Stilvariante bleiben in der Fachphase.

### R01-04: aktive Nachweise und historische Quellen auseinanderhalten

Die 59 Kennungen sind `WD-UI-0001` bis `WD-UI-0050` und `WD-UI-0059` bis `WD-UI-0067`. Jede benötigt einen tatsächlich passenden Originalkontext. Vorhandene native Frames dürfen mehrere sichtbare Controls belegen, wenn deren exakter Pfad und Zustand gelesen und beschrieben wurden. Eine ähnlich benannte neue Kennung ersetzt die alte nicht automatisch. Mehrdeutige historische Namen erhalten eine ausdrückliche Identitäts-/Kontextentscheidung; ihre ursprüngliche Aussage bleibt erhalten.

Importierte `original_gui_screenshot`-Einträge bleiben an ihrem bisherigen Ort mit Quellenpfad, Version, Kennung, Aussage und bisherigen Fehlern erhalten. Ein neuer expliziter Belegverwendungsnachweis benennt pro betroffener Quelle und Besitzer den Status `historical_unverified`, die Begründung und die konkreten aktiven Ersatzbelege. Der Prüfer kontrolliert diesen Zusammenhang; ein globales „Importfehler ignorieren“ ist ausgeschlossen. Nur bei vollständig geprüftem aktuellen Ersatz kann der Altquellenfehler in `historicalEvidenceIssues` getrennt berichtet werden. Fehlt der Ersatz, ist die aktive Kennung weiter blockierend. Fehlende oder geänderte aktive Bilder, falsche Sitzung/Hashes und ungeprüfte historische Belege bleiben Fehler.

Eine tatsächlich zugängliche Altquelle kann stattdessen mit ihren Original-Prozess-/Frameunterlagen geprüft werden. Es werden keine JSON-Sitzungen rückwirkend erfunden. Die 67 historischen Einträge und ihre Aussagen dürfen nicht verschwinden, auch wenn sie vollständig neue Direktbelege erhalten. Ein neuer Clone ohne externe Originaldaten darf weiterhin keine Direktabnahme ausgeben.

### R01-05/06: Paketrollen und Indizes abschließen

Für die vier verbleibenden Rollen vorhandene Fehlversuche, lokale Paketinformationen und tatsächliche Eintrittspfade zuerst lesen. Nur gezielt den fehlenden Originalkontext oder eine belegte Aktivierungsbedingung prüfen. Bedingt sichtbare Nachrichten-/Updateservices brauchen einen nachvollziehbaren Bedingungs-/Quellenbezug; ihr Ausbleiben bei Neustart beweist keine Nichtexistenz. Eine Einordnung anhand des Paketnamens und der beobachteten Oberfläche bleibt ausdrücklich eine begründete Paketfolgerung, keine instrumentierte Codezuordnung oder UI-Abnahme. Unaufgelöste Mehrdeutigkeit bleibt blockierend. Nach zwei erfolglosen Versuchen beziehungsweise 45 Minuten derselben Hypothese Befund und nächsten begrenzten Klärungsschritt dokumentieren.

`groups[].uiInventoryIds` wird als sortierte eindeutige Vereinigung der UI-IDs berechnet, deren `caseIds` einen Gruppenfall enthalten. Bewusste zusätzliche Verbindungen stehen separat als begründete `crossReferenceUi` mit `uiId`, `reason` und Beleg. Der Prüfer verlangt vollständige Gleichheit des kanonischen Indexes, gültige Fälle/IDs und nachvollziehbare Querverweise. Insbesondere 0630–0632 in WD-001, 0633–0635 in WD-003 und die zwei bisherigen WD-036-Zusatzverweise prüfen. Keine Kennung oder fremde Daten umnummerieren.

## Eigene folgende Arbeitsläufe

| Lauf | Fokus und begrenzte Dateien | Ergebnis / Prüfung |
|---|---|---|
| **HEX-00-N-I01** | R01-01/06: Vertrag und Migration in `acceptance.json.wonderdraftParity`; `tools/wonderdraft/validate-inventory.mjs`, `tests/wonderdraft-inventory.test.mjs`, `tools/wonderdraft/README.md`. | Jede Ausgangsfrage erhalten und eingeordnet, 13 frühe Proben mit tatsächlichen Belegen, konsistente Gruppen. Gezielte Negativtests; offene R01-02..05 blockieren weiterhin. Kein Original- oder Produktcodeersatz. |
| **HEX-00-N-I02** | R01-02/03: vorhandene Belege lesen; modale Controls und 33 Optionen gezielt vervollständigen. | Direktbelegte Kontext-/Optionszuordnung. Neue Frames nur für verbleibende benannte Lücken; Originalprofile/Rohkarten geschützt. |
| **HEX-00-N-I03** | R01-04/05: 59 alte aktive Kennungen und vier Paketrollen abschließen. | Passende aktive Originalprovenienz, historische Belegfehler sichtbar, alle Rollen begründet. Bei verbleibender Lücke gezielter Nachbesserungslauf mit konkreter Hypothese. |
| **HEX-00-N-I04** | R01-05: drei verbliebene Rollen über begrenzte tatsächliche Aufrufwege klären. | Community Links im Original mit und ohne Karte geöffnet; News-Rolle begründet zugeordnet. Inspect-Aufruf besitzt expliziten Debug-Guard und F9 öffnet im installierten Original keinen Dialog; interne Rolle, unabhängiger Review ausstehend. Fingierter privater Update-Cache erzeugt native Statusmeldung, zwei Klicks im Startkontext ohne sichtbaren Dialog; Update bleibt offen. Keine Release-/Updatebehauptung aus dem Cache. |
| **HEX-00-N-I05** | R01-05: einzige verbliebene Update-Rolle; neue Aufruf-/Profilbedingung gezielt prüfen. | Geladene Karte im kopierten Profil genügt nicht; eigener Prozessbeleg zeigt `xdg-open` ohne nichtleeres Ziel, genaue Argumentanzahl bleibt unbelegt. Ein frisches privates Minimalprofil ohne `private_url` erreicht dagegen tatsächlich „Update Download“ schon am Startbildschirm. Linkfeld, unmittelbare OK-Aktivierung sowie Cancel/X/Escape direkt gemessen; 0659–0663 ergänzen das Inventar. Frühere Negativproben bleiben erhalten. Keine OK-Bestätigung, kein Download/Update; alle Rollen bleiben für R02 zu reviewen. |
| **HEX-00-N-I06** | R01-02/03: sechs konkrete Optionsreste, modale Rohzahlen/HTML und verbliebene frühe Oberflächenfragen anhand vorhandener Belege schließen. | Fünf Optionsreste und sechs Modalfragen direkt geklärt: Einzelwahl der Farbpaletten mit begründeter Paketbindung, sechs Box-/17 Frame-Namen und beide Scale-Fontnamen; modale Rohzahlen RGB0..255/Alpha0..1, gemessene Dezimal-/Pfeilanzeige, Fehltext und AARRGGBB. Initiale Pfadmarkierung nach Laden bleibt unklar; Paketinitialisierung ersetzt keinen Runtime-Beleg. 125 frühe Fragen bleiben offen. Keine Paritäts-/Reviewfreigabe. |
| **HEX-00-N-I07** | Verbliebene frühe Inventarfragen begrenzt nach Kontextgruppen bearbeiten: zuerst vorhandene New-/Zoom-/Ground-Zahlenbelege zuordnen, dann nur deren tatsächliche Lücken messen. Pfad-Ausgangsstil durch gespeicherten nativen Pfad vor jeder expliziten Style-Wahl klären. | Kein weiterer gleicher Hover-/Klickversuch für die unmarkierte Pfadinitialisierung. Keine Übertragung modaler RGBA-Regeln auf Inline-/Popup-Picker. Nach jeder zusammengehörigen Gruppe Originalfolge, Zuordnung und Benutzerwirkung unterscheiden und den prüfbaren Stand veröffentlichen; unbekannte Oberfläche bleibt HEX-00-Pflicht. |
| **HEX-00-R02** | Eigener Abgleich des endgültig integrierten Standes gegen alle sechs Befunde, Roadmap und Original. | Kritische Startfolge im Original wiederholen, Oberfläche und Belege lesen, Prüferbericht kontrollieren. Nur dieser Review kann die Pflichtbefunde und A/B/C freigeben. |
| **HEX-00-CLEAN-P01/I01/R01** | Eigener Aufräumplan, Umsetzung und Review. C01: RFB-Eingabe-/Screenshot-Preflight vor Verbindung und Eingabe. | Reproduzierbarkeit, eigene Prozessfreigabe, erhaltene Belege und Kernweg. Erst bestandenes Aufräumreview erlaubt HEX-01. |

Die ersten drei Läufe sind Nachbesserungsumsetzung, keine neue allgemeine Inventur. Eine neue Pflichtlücke bekommt ID, Beleg, begrenzte Maßnahme und eigenen Nachbesserungs-/Reviewlauf. Der geprüfte frühe Benutzerablauf bleibt das Zentrum; vollständige Fachvarianten und Stadt-Ergebnisvergleich verschwinden nicht aus der Roadmap.

## Prüfungen und Veröffentlichung

Gezielte Validatorprüfungen müssen insbesondere Folgendes nachweisen:

1. Unklassifizierte, verschwundene, falsch zugeordnete oder grundlos vertagte Fragen blockieren; eine belegbar zugeordnete spätere Wirkungsfrage darf HEX-00 nach eigenem Review offen passieren, wird aber vor ihrer Fachphase verlangt.
2. Vollständiger früher Umfang kann trotz breitem `partial_direct_probe` gelten; fehlende Teilpflicht, falscher Frame, gleiche Neustartsitzung oder geänderte Rohkarte verhindern die Behauptung. Das bloße Feld `initialScopeReview.state` reicht nicht.
3. Historische Fehler bleiben sichtbar; fehlender aktiver Ersatz, falscher Kontext-/Besitzerverweis und bloßes Umbenennen einer Altquelle geben keine aktuelle Abnahme. Neue aktive Herkunftsfehler bleiben harte Fehler.
4. Fehlender/zusätzlicher Gruppenindex, verwaiste ID und unbegründeter Querverweis werden abgewiesen. Neue Modal-IDs müssen in allen betroffenen Gruppen auffindbar sein.
5. Vollständige Freigabe ohne Vertrag, eigene Reviewentscheidung oder bestandene A/B/C ist unzulässig. Teilprüfung, HEX-00-Tor und späterer Phasenaufruf berichten ihren jeweiligen Umfang ausdrücklich.

Umsetzung prüft gezielte Tests sowie `npm run check`, `npm test`, `npm run build`; veröffentlichte und fremd veränderte lokale Testquellen bleiben getrennt. Die drei bekannten Fehler im sauberen Testbaum durch zwei fehlende externe Asset-Fixtures werden weder entfernt noch als bestanden gemeldet. Passende Basis-/Hostregressionen bei Änderung ihrer gemeinsamen Grundlage ausführen. Bei unverändertem Produktbuild vorhandene direkte Kern-Hostbelege mit ihrer Herkunft weiterführen; keine neue Hostabnahme behaupten. Fachreview und Aufräumen prüfen ihren vorgeschriebenen Kernweg zusätzlich. Physische Eingabe, Großkarte und Installation bleiben eigene Abnahmen.

Jeder Lauf dokumentiert Start, Fokus, Ergebnis und nächsten Schritt in `checkpoint.hexAtlasExecution`. QA-Daten bleiben außerhalb des Repos im festen Laufverzeichnis; kein neues paralleles Statussystem. `checkpoint.parityRoadmap`, sämtliche anderen Abnahmewurzeln, fremde Tests und `localTestInstall` bleiben erhalten. Vor Arbeit und Veröffentlichung Upstream abrufen/integrieren, nur eigene Dateien beziehungsweise JSON-Wurzeln committen, pushen und den exakten Remote-Commit prüfen. Kein Vault-Installationsschritt in diesen Referenznachbesserungen.
