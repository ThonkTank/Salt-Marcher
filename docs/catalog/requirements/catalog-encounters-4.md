# Itemquellen und Provider

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: catalog
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Itemquellen und Provider

#### Aktuelle Quellenlieferung

Der vollständige S01-Quellenkandidat steht in [PR85](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/85); aktuelle Integration und Itemproduktabnahme stehen im Abnahmeregister. Quellenprüfung vergleicht vollständige Heading-zu-Heading-XML-Blöcke samt Prosa, Tabellenreihenfolge und Seitenfortsetzung.

Armor/Arrow (A–Z 10–13, Seiten 208–209) umfasst Resistenz-d10, Fluchtext und Slaying-Regeln. Entfernt wird ausschließlich der exakte SRD-Footer mit belegter Seitennummer, niemals eine Bodyregion nach Y-Koordinate. Getrennte kursive Wort-/Interpunktionsläufe erhalten fehlenden Grenzleerraum; echte Leerzeichen bleiben erhalten. Poppler-XML-Fixtures, verschobene/hohe Koordinaten, Footer-/Body-Adversarien und der echte PDF-Integrationstest prüfen diese Grenzen; 25.03-/25.07-Belege bleiben getrennt.

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
([Integrationsbeleg](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/64#issuecomment-6101348349)).
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

`tools/items-srd51-c-section.mjs` vergleicht komplette Headingblöcke einschließlich Tabellenposition und Seitenwechsel. Die drei ursprünglichen Poppler-25.03-XML-Seiten mit Hash-/Lizenzreceipt liegen unter `tests/fixtures/items-srd51-c-section-poppler-25.03.*`. Negative Goldens prüfen Table-/Variant-IDs, Rarität, Würfelbereiche, Kapazität, Charge-Loss, Textbedingungen und Aufzählungen. Korpuscount-Tests folgen der tatsächlichen Inventarlänge; ihre Quellenorakel bleiben unverändert.

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
([Integrationsbeleg](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/70#issuecomment-6102297681)).
Schema, Attribution, Produktcode und alte Quellen-/Verifiergoldens bleiben unverändert.

Der E-Abschnitt A–Z 63–70 (Efficient Quiver bis Eyes of the Eagle, Seiten 220–221) prüft Efreeti-d100 einschließlich `91–00`, vier Gem→Elemental-Zuordnungen und vollständige Sicht-/Recharge-/Windbedingungen; Eyes of Charming behält seine Seitenfortsetzung. Tabellen erzeugen keine zusätzlichen Itemidentitäten oder Raritätsvarianten. Quellen: `tests/fixtures/items-srd51-e-section-poppler-25.03.*` und `tools/items-srd51-e-section.mjs`.

Vollständigkeitsziel: 459 Occurrences (219 Ausrüstung + 239 A–Z + Orb), mit ausdrücklich belegten Merges statt Namensgleichheit; der Potion-of-Healing-Merge ist bereits bekannt. Der tatsächlich gelieferte Korpus und offene Abschnitte stehen ausschließlich im Quellenartefakt und `acceptance.json.saltMarcherCatalogEncounter`. Das vollständige Quellen-/Schema-/Provenienzpaket benötigt Prüfung vor Produktartefakt, Provider und UI.

`SRD51_SOURCE_PDF=/pfad/SRD_CC_v5.1.pdf node --test tests/catalog/items-srd51-source.test.mjs` aktiviert den vollständigen PDF-Test. Ohne PDF ist er skipped; Offline-XML ersetzt bei Quellenänderung keinen erneuten echten PDF-Lauf.

### Ziel und Grenze

`Items` wird der erste echte Bereich nach `Monster` in der vorhandenen
siebenfachen Katalog-Shell. Er liefert einen lokalen, nur lesbaren
2014-Referenzkatalog für Ausrüstung und magische Gegenstände. Maßgeblich sind
die [gemeinsamen Providerverträge](catalog-encounters-3.md#gemeinsame-providerverträge) und SaltMarchers
`docs/items/requirements/requirements-items-catalog.md` sowie
`docs/items/domain/domain-items.md` am gepinnten SaltMarcher-Commit
`9de85c1a26f526acbc1af332ac5962e185c0aab2`. SaltMarchers
SQLite-/HTTP-Importvertrag beschreibt das beobachtbare Verhalten, erzwingt aber
keine SQLite- oder Laufzeit-Importarchitektur für dieses Plugin. Der Loot-Index
ist keine Item-Detailquelle.

### Gepinnte Quelle und Freigabe vor Datenübernahme

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

### Quellprojektion und Schema

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

### Reproduzierbarer Build und Fail-closed-Lader

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
