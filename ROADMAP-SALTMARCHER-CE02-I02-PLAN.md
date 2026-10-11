# CE-02-I02-P01 – Itemkatalog: Provenienz, Datenvertrag und Umsetzung

Stand: 9. Oktober 2026

Art: Fachplan für Items; keine Item-Implementierung und keine CE-02-Freigabe

### Aktuelle Quellenlieferung

S01 bleibt bis vollständigem Korpus und unabhängigem S01-R01 ausdrücklich
unvollständig. Der direkte Nutzerauftrag vom 10. Oktober verlangt sinnvolle
Produktbeiträge ohne künstliche Einzeleintrags-/Kleinstpaketbeschränkung.
W23 liefert die zusammenhängende Armor-/Arrow-Gruppe (A–Z 10–13,
physische/gedruckte Seiten 208–209) einschließlich Resistenz-d10-Tabelle,
Fluchtext und Slaying-Regeln. Ein kompletter Heading-zu-Heading-XML-Abgleich
prüft Prosa und physische Tabellenreihenfolge statt nur vorhandener Substrings.
W23-N01 ersetzt nach dem unabhängigen P1-Befund die feste Footer-Y-Grenze:
Nur der exakte SRD-Footer mit belegter Seitennummer wird entfernt, nie eine
Bodyregion nach Koordinaten. Getrennte kursive Wort-/Satzzeichenläufe erhalten
das Fehlen von Grenzleerraum aus den XML-Quellwerten; echte Leerzeichen und
Interpunktion bleiben unangetastet. Ein hashgebundener echter Poppler-25.03-
XML-Ausschnitt, verschobene/hohe Koordinaten, Footer-/Body-Adversarien und ein
expliziter PDF-Integrationstest schützen diese Grenze. Der lokale echte PDF-
Lauf ist kein behaupteter Poppler-25.07- oder fremder Host-PASS. Der unabhängige
W23-N01-P1-Re-Review auf `8dfa06ac859acf84df1e35d481893cf289e062e3`
bestätigt inzwischen den echten Poppler-25.07-PDF-Pfad als PASS
([PR #48, Review 5479968350](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/48#pullrequestreview-5479968350));
das ist keine vollständige S01-/Produktabnahme.

W24 ergänzt die gesamte Bags-Gruppe (A–Z 14–17, Seiten 209–211): Beans,
Devouring, Holding und Tricks. Alle zwölf d100-Effekte einschließlich `00`
und der seitenübergreifenden Eierregel sowie alle drei farbgebundenen
d8-Kreaturentabellen mit jeweils acht Zeilen bleiben vollständig erhalten.
Tabellenlabels und Würfelergebnisse bleiben den jeweiligen Zellen zugeordnet;
die drei Farben sind keine zusätzlichen Detailheadings oder erfundenen
Variantenrecords/Merges. Beans-Gewichtsformel und Holding-Kapazität bleiben
als vollständiger Quellwortlaut erhalten, nicht als erfundene numerische
Umrechnung. Die optionalen strukturierten Kosten-/Gewichts-/Kapazitätsfelder
werden in diesem Quellenabschnitt nicht ergänzt.

Der Verifier verwendet dieselbe inhaltliche Footer-/Quellwhitespace-Policy wie
W23-N01 und prüft jeden vollständigen Heading-Block einschließlich Tabellen,
Seitenübergängen und der nächsten Überschrift. Eine unveränderte echte
Poppler-25.03-XML-Ausgabe der drei kompletten Seiten mit Hash-/Lizenzreceipt
liegt unter `tests/fixtures/items-srd51-bags-poppler-25.03.*`; sie macht die
prüfentscheidenden Rohdaten offline zugänglich, behauptet aber keinen neuen
PDF-/GUI-Lauf. Negative Goldens erhalten auch bei unverändertem
Kreaturen-Multiset die Farb-/Würfelzuordnung. W24 wurde unabhängig auf
`42a69b63a69fbf310f1ba4eb4b7128cee2e5c700` geprüft
([Review 5480292230](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/56#pullrequestreview-5480292230))
und regulär auf Shared `843562ac256eb293f1b8c95f10077a9a7a7c1a1b`
integriert; kein Full-S01-/Produkt-/Host-PASS.

W25 liefert den vollständigen verbleibenden B-Abschnitt, A–Z 18–32, Bead of
Force bis Broom of Flying, physische/gedruckte Seiten 211–213. Alle Header,
Prosa, Aufzählungen, bedingten Regeln, Recharge-Angaben und der
seitenübergreifende Berserker-Fluch bleiben erhalten. Belt of Giant Strength
hat fünf physische Tabellenzeilen mit fünf ordinalgebundenen Raritätschoices;
die Quelle nennt sechs Varianten, fasst Stone/frost aber in einer Zeile
zusammen. Diese Zeile bleibt kombiniert; die sechs Varianten und ihr
unterschiedliches Aussehen/gleicher Effekt bleiben im vollständigen Fließtext.
Keine erfundenen zusätzlichen Occurrences, Records oder Merges. Header
`Weapon (any axe)` ergänzt das geschlossene Draft-v1-Subcategory-Enum um
`weapon`; es wird nicht unbelegt als einfache/martiale Einzelwaffe klassifiziert.
Gewicht, Kapazität und temperaturabhängige Regeln bleiben Quellenwortlaut,
keine erfundenen Kosten oder Einheitenumrechnungen.

`tools/items-srd51-b-section.mjs` vergleicht die vollständigen Blöcke bis zur
Folgeüberschrift, einschließlich Tabellenzelleneigentum und Seitenwechsel.
Originale drei vollständige Poppler-25.03-XML-Seiten samt Hash-/Lizenzreceipt
liegen unter `tests/fixtures/items-srd51-b-section-poppler-25.03.*`.
Negative Goldens schützen Variant-IDs/Rarität/Strength-Zellen, Fluchende,
Aufzählungen, echte Minuszeichen, Recharge und Bedingungsgrenzen. W25 ist
unabhängig auf `8772d950301b899c22f8bc4588e35bd2a5fe6dde` als PASS geprüft
([Chronik-Review 5480446444](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/64#pullrequestreview-5480446444))
und regulär auf Shared `ebb480eaac0c11640b843b4fa4297f541951d4ad` integriert
([Stewardabschluss](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/64#issuecomment-6101348349)).
Das schließt weder Full-S01 noch ein Produkt-/Hostgate.

W26 ergänzt den vollständigen kohärenten C-Abschnitt A–Z 33–47, Candle of
Invocation bis Cubic Gate, physische/gedruckte Seiten 213–215: alle Header,
Prosa, Aufzählungen, bedingten Regeln und Seitenfortsetzungen. Die neun
Candle-Alignmentzeilen, vier Carpet-Zeilen (Größe/Kapazität/Geschwindigkeit),
sechs Cube-Faces mit Charges/Effekt und fünf Spell-/Item-Charge-Loss-Zeilen
behalten Reihenfolge und Zelleigentum. Der vollständige Table-Wortlaut bleibt
auch an seiner Position zwischen den Prosaabsätzen erhalten. Crystal Ball
bleibt eine Occurrence mit vier quellgeordneten Raritätschoices: typischer
Ball very-rare; Mind Reading, Telepathy und True Seeing legendary. Keine
erfundenen Unterheadings, Records oder Merges; alle variantenspezifischen
Regeln und Scrying-/Konzentrations-/Rechargegrenzen bleiben vollständige Prosa.

`tools/items-srd51-c-section.mjs` vergleicht jeden vollständigen Headingblock
einschließlich Table-Position und Seitenwechsel bis zur Folgeüberschrift.
Originale komplette drei Poppler-25.03-XML-Seiten und Hash-/Lizenzreceipt
liegen unter `tests/fixtures/items-srd51-c-section-poppler-25.03.*`.
Negative Goldens schützen Table-/Variant-IDs, Rarität, Würfelbereiche,
Kapazität, Charge-Loss, Fließtextbedingungen und Aufzählungen. Kein Schema-
oder Produktvertrag wurde erweitert; der W25-Korpuscount-Test prüft nun die
Inventarlänge statt den historischen Zwischenstand 252, ohne Quellenfakten
oder W25-Orakel abzuschwächen. W26 ist unabhängig auf
`67daede8eb4c5debafa98115f12b6e516c54e3be` geprüft
([Stadt-Review 5480616259](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/66#pullrequestreview-5480616259))
und regulär auf Shared `9e3a6c1bbd6484a356c00c268083b147cd7cc6ae` integriert
([Stewardabschluss](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/66#issuecomment-6101632238)).

W27 ergänzt den vollständigen D-Abschnitt A–Z48–62, Dagger of Venom bis
Dwarven Thrower, physische/gedruckte Seiten215–220. Alle Header und Prosa,
einschließlich Dancing-Sword-Seitenfortsetzung, Fluch, Recharge und
bedingtem Dwarf-Attunement bleiben vollständig. Deck of Illusions behält
33 physische Tabellenzeilen (Jokers(2) ist eine Zeile), Deck of Many Things
alle22 Tabellenzeilen, die13-vs22-Fußnote und sämtliche22 Kartenwirkungen.
Der vollständige eingebettete Avatar-of-Death-Statblock bleibt in der
Quellreihenfolge unter Skull, ohne zusätzliche Item-Occurrence oder Änderung
des Monsterkorpus. Dragon Scale Mail bewahrt zehn Drachen-/Resistenzzellen
und ihre fünf physischen gepaarten Zeilen. Karten-/Drachentypen sind keine
erfundenen Raritätsvarianten oder Detailheadings; optional strukturierte
Kosten/Gewicht/Kampfwerte werden nicht aus Prosa erfunden.

`tools/items-srd51-d-section.mjs` prüft vollständige Headingblöcke bis zur
Folgeüberschrift. Originale sechs vollständige Poppler25.03-XML-Seiten samt
Hash-/Lizenzreceipt liegen unter `tests/fixtures/items-srd51-d-section-poppler-25.03.*`.
Goldens schützen Karten-/Suit-/Resistenzzuordnung trotz gleicher Wertemengen,
Fußnote, alle Kartenregeln, Statblock, Einschränkungen und Quellinterpunktion.
W27 ist unabhängig geprüft
([Review5480792943](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/70#pullrequestreview-5480792943))
und regulär auf Shared7ba2bf4 integriert
([Stewardbeleg](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/70#issuecomment-6102297681)).
Schema, Attribution, Produktcode und alte Quellen-/Verifiergoldens bleiben unverändert.

Der aktuelle nächste Quellenumfang ist der vollständige E-Abschnitt A–Z63–70,
Efficient Quiver bis Eyes of the Eagle, Seiten220–221. Efreeti-d100-Effekte
einschließlich `91–00`, alle vier Gem→Elemental-Zuordnungen und vollständige
Sicht-/Recharge-/Windbedingungen werden headinggebunden geprüft; Eyes of
Charming bleibt einschließlich Seitenfortsetzung erhalten. Tabellenwirkungen
erzeugen keine zusätzlichen Itemidentitäten oder Raritätsvarianten. Die
originalen zwei XML-Seiten/Receipt und das Quellenorakel liegen unter
`tests/fixtures/items-srd51-e-section-poppler-25.03.*` beziehungsweise
`tools/items-srd51-e-section.mjs`. Aktueller Ausführungs-/Prüfstand ausschließlich
in den fachlichen Abnahmen und [Aufgabenissue58](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/58).
Stand: 290 Occurrences /289 Records,71/239 A–Z-Headings
(70 standalone plus Potion-of-Healing-Merge);168 A–Z-Headings plus Orb offen.
Der Gesamtquellenauftrag endet nicht an diesem Zwischenstand; nächster
kohärenter Abschnitt beginnt bei Feather Token. I01 bleibt vor unabhängigem
vollständigem S01-R01 gesperrt.
Der erwartete vollständige Occurrence-Count ist 459 (219 Ausrüstung +
239 A–Z + Orb), nicht der jeweilige Zwischenstand; bekannte Mergezahl bisher 1,
weitere Merge-/Helperprüfung bleibt offen. `complete:false` bleibt gesetzt.
Der vollständige PDF-Test wird mit
`SRD51_SOURCE_PDF=/pfad/SRD_CC_v5.1.pdf node --test tests/items-srd51-source.test.mjs`
aktiviert. Ohne diese Quelle ist er ausdrücklich skipped; Offline-XML-Fixtures
ersetzen keinen erneuten echten PDF-Lauf bei Quellenänderungen.
Der Quellenstand und die direkten Review-/Veröffentlichungsbelege bleiben in
`acceptance.saltMarcherCatalogEncounter`
und [Issue #9](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/9).
Die nächsten Lieferungen folgen zusammenhängenden Quellabschnitten; die
vollständigen Schema-/Provenienz-/Produkt-/Hostgates unten bleiben erhalten.

## Ziel und Grenze

`Items` wird der erste echte Bereich nach `Monster` in der vorhandenen
siebenfachen Katalog-Shell. Er liefert einen lokalen, nur lesbaren
2014-Referenzkatalog für Ausrüstung und magische Gegenstände. Maßgeblich sind
`ROADMAP-SALTMARCHER-CE02-PLAN.md` und SaltMarchers
`docs/items/requirements/requirements-items-catalog.md` sowie
`docs/items/domain/domain-items.md` am gepinnten SaltMarcher-Commit
`9de85c1a26f526acbc1af332ac5962e185c0aab2`. SaltMarchers
SQLite-/HTTP-Importvertrag beschreibt das beobachtbare Verhalten, erzwingt aber
keine SQLite- oder Laufzeit-Importarchitektur für dieses Plugin. Der Loot-Index
ist keine Item-Detailquelle.

## Gepinnte Quelle und Freigabe vor Datenübernahme

Die normative Inhaltsquelle ist Wizards of the Coast, *System Reference
Document 5.1*, die 2014er Fassung unter
<https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf>. Der am
9. Oktober 2026 abgerufene PDF-Byte-Hash ist
`2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0`
(SHA-256; 3.158.713 Bytes, 403 PDF-Seiten). Seite 1 nennt CC BY 4.0 und den
verlangten Attributionstext. `CE-02-I02-S01` kopiert genau den auf PDF-Seite 1
als Attribution Statement ausgewiesenen Wortlaut unverändert in das kanonische
Asset `src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md`. S01 prüft den
Wortlaut und Asset-Hash gegen PDF-Seite 1; erst I01 prüft seine Präsenz im
Build und im sichtbaren Inspector. Hinweise zur
Itemprojektion stehen getrennt davon; keine weitere Wizards-Attribution wird
angehängt. Keine 2024-/SRD-5.2-Daten.

`CE-02-I02-S01` ist ein eigenes, vor jeder Produktumsetzung abgeschlossenes
Provenienz-/Schema-Paket. Es legt `src/features/catalog/data/items-srd51-inventory.json`
mit genau einer Zeile je Ausrüstungs-Tabellenzeile, eigenständigem Magic-Item-
Tabelleneintrag und alphabetischem Magic-Item-Detailabschnitt an. Jede Zeile
trägt Abschnitt/Feed, erste und letzte physische PDF-Seite, sichtbare SRD-Seite,
Quellenüberschrift bzw. Tabellenkennung, Zeilen-/Abschnittsordinal,
Variantenkennung und explizite Merge-Referenz oder `null`. Das Manifest enthält
Abschnittsgrenzen und erwartete Counts für Ausrüstungstabellen, Magic-Item-
Tabellen und A–Z-Details sowie eine Summe vor und nach expliziten Merges.
Ein zweiter Prüfer vergleicht alle PDF-Seiten an den Abschnittsgrenzen und die
vollständige Zeilen-/Überschriftenfolge gegen das Inventar; Stichproben allein
reichen nicht. Er dokumentiert PDF-Hash, Inventarhash, Count-Abgleich und
Ausnahmen auf einem exakten Commit als `CE-02-I02-S01-R01 PASS` oder
`CHANGES REQUIRED`. S01 erstellt vor diesem Review auch das vollständige
Quelltranskript, das versionierte Schema und den PDF→Transkript-Beleg. Ohne
PASS entstehen weder generiertes Produktartefakt noch Provider oder UI; I01
beginnt nicht.

Ein 5e-bits-Datensatz darf als Extraktionshilfe dienen,
aber nicht ungeprüft zur zweiten Wahrheit werden: jede übernommene Tatsache
muss im SRD 5.1 verortbar sein. Nicht belegte oder außerhalb der SRD liegende
Einträge werden abgewiesen. Die 5e-bits-MIT-Lizenz für Repository-Code ersetzt
keine Prüfung der Inhaltslizenz.

## Quellprojektion und Schema

Das in S01 erstellte Inventar ist die Identitätsgrundlage des Quelltranskripts. Eine
Erscheinung erhält die ID `srd51:<equipment|magic-item>:<abschnitt>:<ordinal>`;
Abschnitt und Ordinal stammen ausschließlich aus der festgehaltenen physischen
PDF-Reihenfolge. Anzeigenamen, Slugs, Unicode und Interpunktion erzeugen keine
Identität. Für gleichnamige Varianten gibt es je eigener Tabellenzeile oder
Überschrift eine eigene Erscheinung und eine explizite Variantenkennung.
Eine Merge-Liste weist Tabellenerscheinungen und A–Z-Details per ID genau
einem kanonischen Eintrag zu; niemals durch automatisch gleichen Namen. Die
kanonische ID ist die erste Erscheinung in PDF-Reihenfolge. Mehrdeutigkeit,
Kollision, unbelegter Merge oder abweichende Fakten stoppen den Generator.
Ein abweichender SRD-Quellenstand erfordert neues Manifest und eigenen Review.

Das Transkript speichert je Fakt die Inventar-ID und PDF-Seite. Mechanische
Textextraktion normalisiert Unicode nach NFC, Ligaturen zu Buchstaben,
geschützte Leerzeichen zu normalen Leerzeichen und PDF-Zeilenumbrüche zu
Leerzeichen; echte Wortbindestriche und Zeichensetzung bleiben erhalten.
Weiche Trennstriche an Zeilenenden dürfen nur bei nachgewiesenem Umbruch
entfallen. Jede andere Korrektur steht als explizite Vorher-/Nachher-Zeile mit
PDF-Beleg im Transkript. `S01` legt die kontrollierten Kategorie-/Unterkategorie-
Werte und die Zuordnung jeder Quellentabelle fest. Golden-Fälle prüfen
Gleichnamigkeit, Varianten, Tabellen-/Detailmerge, Ligatur, Trennstrich,
Interpunktion und bytegleiche Projektion.

S01 legt den verbindlichen Vertrag als
`src/features/catalog/data/items-srd51-schema-v1.json` (JSON Schema Draft
2020-12, `schemaVersion: 1`) und das Transkript als
`src/features/catalog/data/items-srd51-transcript.json` ab. Der unabhängige
S01-Review bindet die SHA-256-Hashes von PDF, Inventar, Schema, Transkript und
Attribution sowie die Schema-Validierung sämtlicher Einträge. Das Schema
verbietet zusätzliche Felder und schließt Kategorie, Unterkategorie, Raritätswerte,
Einstimmung und Einheiten als Enums. Seine Mindestform ist:

- `id` und `name`: nichtleere NFC-Strings; `category`: `equipment` oder
  `magic-item`; `subcategory`: optionaler Wert aus einem in S01 durch das
  vollständige Inventar festgelegten, geschlossenen Enum samt Zuordnung jeder
  Quellentabelle; `magic`: Boolean; `rarity`: optionales diskriminiertes Objekt:
  `{kind: "fixed", value}` oder `{kind: "varies", sourceText, choices}`.
  `value` und jedes `choices[].value` gehören zum Enum `common`, `uncommon`,
  `rare`, `very-rare`, `legendary`, `artifact`. Eine Choice ist
  `{variantId, label, value, occurrenceId}` mit nichtleeren Strings und
  Inventarbeleg; `choices` ist geordnet und darf leer sein, wenn die Quelle
  zwar „rarity varies“ nennt, aber keine eindeutige Variante→Rarität-Zuordnung
  liefert. `sourceText` bewahrt dann den vollständigen Quellenwert;
- `attunement`: genau `required`, `not-required` oder `unspecified`;
- `cost`: optionales Objekt `{sourceText, copperPieces?}` mit nichtleerem
  Quelltext und nichtnegativem Safe-Integer in Kupferstücken. Umrechnung ist
  nur für eindeutige Einzelwerte zulässig: `cp=1`, `sp=10`, `ep=50`, `gp=100`,
  `pp=1000`; Bereiche, Formeln und unbezifferte Kosten behalten allein
  `sourceText`;
- `weight`: optionales Objekt `{sourceText, pounds?}`; `pounds` ist eine
  kanonische positive Dezimalzeichenfolge ohne Exponent, nur bei eindeutigem
  Quellenwert in Pfund; andere Einheiten bleiben allein `sourceText`;
- `properties`: geordnete Liste aus `{name, description?, occurrenceId}`;
  `description`: geordnete Liste aus `{text, occurrenceId}`. Alle Strings sind
  nichtleer und `occurrenceId` verweist auf genau eine Inventarerscheinung;
- `damage`: optional `{diceText, typeText, versatileDiceText?}` und `armor`:
  optional `{armorClassText, dexterityRuleText?, strengthRequirementText?,
  stealthRuleText?}`. Diese Felder sind ausdrücklich nichtleere,
  quellengetreue Textwerte, keine numerischen Kampfwerte. Fehlt ein Pflichttext,
  bleibt der strukturierte Teil weg und der Wortlaut in `description`;
- `source`: `{document: "SRD 5.1", pdfUrl, pdfPages, printedPages,
  occurrenceIds}` mit der gepinnten URL, nichtleeren geordneten
  Integer-Seitenlisten und existierenden Inventar-IDs. Der Generator prüft
  Seiten, Abschnitte und faktbezogene Erscheinungen gegen das Inventar.

Optionale fehlende Quellenfelder werden ausgelassen, nicht durch `null` oder
Nullwerte ersetzt. Insbesondere werden für magische
Gegenstände keine Preise, Gewichte oder Einstimmungen aus anderen Quellen
erfunden. `attunement` unterscheidet `required`, `not-required` und
`unspecified`: Bei einem vollständig geprüften Magic-Item-Header setzt die
`requires attunement`-Klausel `required`, ihr belegtes Fehlen `not-required`.
Bei unvollständigem/mehrdeutigem Header und nichtmagischer Ausrüstung gilt
`unspecified`; das ist kein behauptetes Nein. `S01` prüft positive, negative
und unklare Header als Golden-Fälle. Geldwerte werden ohne Rundung als
ganzzahlige kleinste Einheit
normalisiert; nicht eindeutig umrechenbare Quellwerte bleiben reine Anzeige
und nehmen am numerischen Kostenfilter nicht teil. Sortierung behandelt fehlende
Werte deterministisch am Ende, unabhängig von der Richtung. Für Rarität gilt:
ein konkreter Filterwert trifft `fixed.value` oder eine belegte
`varies.choices[].value`; ein eigener Filterwert `varies` trifft alle
variablen Einträge. Die Sortierung ordnet feste Raritäten nach der genannten
Enum-Reihenfolge, dann `varies`, dann fehlende Werte; Richtung kehrt nur die
festen Raritätswerte um, fehlende bleiben am Ende. Der Inspector zeigt bei
`varies` den `sourceText` und jede belegte Choice; er macht keine einzelne
Rarität für den gesamten Eintrag geltend. Ein Variantenschlüssel ist
`<occurrenceId>#variant:<ordinal>` mit dem Ordinal der Variantenfolge im
gepinnten PDF, unabhängig von Label oder Slug. S01-Golden-Fälle decken
mindestens `rarity varies` und einen kombinierten `+1/+2/+3`-Header vollständig
von Inventar über Transkript und Schema bis zur Filter-/Inspector-Projektion
ab. Der Inspector
kennzeichnet fehlende Fakten, statt sie mit Nullwerten zu verwechseln.

## Reproduzierbarer Build und Fail-closed-Lader

Ein enger Generator unter `tools/` liest ausschließlich das reviewte Inventar,
Quelltranskript und Manifest mit PDF-URL/-SHA-256, Inventarhash,
Schema-Version, Lizenz und Attribution. Er benötigt keinen Netzwerkzugriff.
Ein separater Quellen-Verify-Lauf lädt die PDF in den QA-Cache, prüft ihren
Hash und vergleicht die vollständige Seiten-/Zeilen-/Überschriftenfolge mit
dem Inventar und den Transkriptbelegen. Er liefert den unabhängigen
PDF→Transkript-Vollständigkeitsbeleg. Der Offline-Generator validiert jede
Inventar-ID, jede Faktquelle, eindeutige Schlüssel, alle Merge-Regeln und
Counts, serialisiert in fester Ordnung und schreibt ein Artefakt samt SHA-256.
Wiederholung muss bytegleich sein. `npm run build` prüft das eingecheckte
Artefakt gegen Manifest und generierte Bytes, ohne die PDF erneut aus dem Netz
zu holen; der getrennte Quellen-Verify-Lauf ist Pflichtgate von S01 und jeder
Quelländerung. Quell-PDF und große Protokolle liegen im QA-Cache.

Der Runtime-Lader prüft Schema-Version, Manifest/Artefakt-Hash und Struktur vor
der ersten Veröffentlichung des gesamten Korpus. Die Daten werden erst nach
vollständiger Prüfung als ein unveränderlicher Snapshot sichtbar. Fehler geben
keine Teilmenge oder veraltete Detailantwort als aktuelle Wahrheit aus:

- fehlendes Asset bzw. noch kein vollständiger Import: `unavailable`;
- neuere/andere Schema-Version: `incompatible`;
- Hashabweichung, ungültiger Datensatz, Duplikat oder indizierter Datensatz
  ohne versprochenes Detail:
  `corrupt`;
- ungültige Filter-/Pagingwerte: `invalid`;
- Laufzeit-/Ladefehler: `error` mit isoliertem Retry.

Diese Fehler betreffen nur `items`. `creatures` und die fünf weiterhin
`unavailable`-Provider behalten ihren Zustand. Kein Katalogklick startet
Netzwerk, Import, Vaultwrite, Loot-, Inventory- oder Encounter-Mutation.

## Provider und sichtbares Verhalten

`I01` erweitert den vorhandenen Providervertrag ausdrücklich: Capability
behält `available|missing|unavailable`; Query erhält neben `ready|empty|
invalid|missing|unavailable|error` die Status `incompatible|corrupt`; Detail
erhält neben `ready|missing|unavailable|error` ebenfalls `incompatible|corrupt`.
Loader-Schemafehler gehen auf beide `incompatible`, Integritätsfehler auf
`corrupt`; ungültige Query auf `invalid`. Eine unbekannte oder inzwischen
entfernte Detail-ID ist `missing`, ein im geprüften Index gelisteter Eintrag
ohne Detail ist `corrupt`. Nur `error` und nach erneuter lokaler Validierung
`corrupt` bieten Retry; `incompatible` verlangt einen passenden Build und
`missing` eine neue Auswahl. Registry, Shellstatus, Itemansichten und Tests
erhalten diese Union gemeinsam; Monsterverhalten bleibt unverändert. Ein
fehlgeschlagener Refresh entwertet den aktuellen Item-Snapshot, sodass Retry
oder spätere Query keine alte Liste als aktuellen Erfolg ausgeben.

Der Itemprovider implementiert diesen CE-02-read-only-Vertrag mit
immutable Row-/Detail-DTOs, begrenzter Ergebnispage und `AbortSignal`.
Stabile IDs werden auch in Auswahl und Wiederherstellung genutzt. Query und
Detail verwenden denselben geprüften Snapshot. Generations-/Abortschutz der
Shell verhindert, dass verspätete Itemantworten nach Suche oder Bereichswechsel
einen anderen Bereich überschreiben.

Die Items-Oberfläche nutzt den gemeinsamen 200-ms-Draft-/Enter-Flush-,
Chip-/Reset-, Sortier-, Paging-, Tastatur- und Inspector-Pfad. Filter sind Name,
Kategorie, Unterkategorie, Rarität, Magiestatus, Einstimmung und Kostenbereich;
Sortierung ist Name, Kategorie, Rarität und Kosten, jeweils mit stabiler
ID-Nachordnung. Rarität und Kosten zeigen fehlende Werte offen an; der
Kostenbereich matcht nur tatsächlich bezifferte Kosten. Auswahl zeigt
Beschreibung, Eigenschaften, Kosten, Gewicht, Rarität, Einstimmung,
Schadens-/Rüstungsfakten soweit vorhanden, Quellenstellen und Attribution.
Es gibt explizite Loading-, Empty-, Invalid-, Unavailable-, Incompatible-,
Corrupt- und Error-/Retry-Ansichten, ohne verdeckte Produkt-Placeholder.

Die Workspace-Schemaversion steigt von `1` auf `2`. Die v1→v2-Migration
übernimmt `activeSection` und Monster sowie die fünf anderen Section-States
werttreu durch ihre bisherigen Restorer. Beim bisherigen Item-Placeholder
übernimmt sie `search`, `searchDraft`, `direction`, `page`, `selectedId` und
beide Scrollpositionen; `filters: []` wird zum leeren typisierten Itemfilter,
`sort: name` bleibt erhalten. Neue Item-Filter und Sortierfelder beginnen mit
Defaults. Nur beschädigte Itemwerte werden auf Itemdefaults normalisiert.
Unbekannte künftige Workspaceversionen bleiben wie bisher insgesamt
fail-closed. Der real typisierte Itemzustand hält eigenen Draft/angewandte
Suche, Filter, Sortierung, Seite, Auswahl und beide Scrollpositionen. Tests
prüfen v1→v2, beschädigtes Item bei intaktem Monster, unbekannte Zukunft,
Item→Monster→Item und frischen Prozess-Restore.

## Besitz, Läufe und Prüfgates

`CE-02-I02-S01` besitzt Inventar, Identitäts-/Merge-Ledger, vollständiges
Quelltranskript, `items-srd51-schema-v1.json`, Kategoriezuordnung, kanonische
Attribution, PDF→Transkript-Quellen-Verify und Golden-Fälle, aber noch kein
generiertes Produktartefakt, keinen Provider und keine UI. Ein unabhängiger
Prüfer muss S01 auf einem exakten Commit mit vollständigem Count-, Schema- und
Hashbeleg freigeben.

`CE-02-I02-I01` besitzt erst danach neue Itemdaten-, Generator-, Manifest-,
Attributions-,
Provider- und Item-View-Dateien unter `src/features/catalog/` und `tools/`,
gezielte Item-Deskriptor-/State-Ergänzungen in der bestehenden Katalog-Shell,
passende Tests und nur nötige Katalog-CSS. Monsterdaten, die fünf anderen
Provider, Encounter-/World-Planner-Owner, Atlas, Dungeon und Vaulttexte bleiben
außerhalb dieses Pakets. Ein verändertes Bundlebudget wird nur anhand gemessener
Buildgröße, Lazy-Load und echtem Hostverhalten entschieden.

Nach bestandenem `CE-02-I02-P01`-Planreview folgen `S01`, dessen unabhängiger
`S01-R01`-Review und nur bei PASS die getrennte Umsetzung `CE-02-I02-I01`,
unabhängiger Code-/Datenreview und gegebenenfalls Reparatur. Die
Umsetzung führt `npm run check`, `npm test`, `npm run build` und gezielte
Generator-/Provider-/DOM-Tests aus. Pflichtfälle sind: Source-Hash und
Attribution; Korpusvollständigkeit und bytegleiche Regeneration; doppelte
Schlüssel und widersprüchliche Feldquellen; fehlende optionale Werte;
deterministische Filter/Sortierung/Paging; Auswahl und Inspector; sämtliche
Fehlerzustände und Retry; Abort-/Stale-Antwort; Bereichs-/Neustartzustand;
kein Netzwerk oder Ownerwrite beim Browsing. Der I02-Review bindet sauberen
Quell-SHA, bytegleiche installierte `main.js`/`manifest.json`/`styles.css` und
einen echten isolierten Obsidian-Hostlauf. Sichtbar geprüft werden bei
900×650 und 1150×700 Itemfilter, Chips/Reset, Sortierung, Paging, Auswahl,
Inspector, Attribution und fehlende optionale Felder. Ein Bereichswechsel
während einer ausstehenden Query darf Item/Monster nicht überschreiben;
beide Zustände müssen unabhängig durch Wechsel und frischen Prozess erhalten
bleiben. Der Prozess endet normal. Corrupt/Incompatible/Error/Retry werden
zusätzlich mit deterministischen Fixture-/Harness-Gates geprüft. Automatisierte
Hostbelege werden nicht als physische Tastatur-/Maus-, Screenreader- oder
Plattformabnahme ausgegeben. CE-02-H01 wiederholt die gemeinsame Prüfung nach
allen sieben Providern.

Eine Itemfreigabe schließt weder die fünf anderen Provider noch CE-02, CE-01-
Physikeingabe, Screenreader oder weitere Plattformen. Diese Gates bleiben
ausdrücklich offen.
