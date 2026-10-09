# GM-UX-N-005: Raum-Keys während der Spielsitzung finden

Planlauf `GM-UX-N-005-P01` vom 09.10.2026 zum
[GM-Produkttest](ROADMAP-GM-PRODUCT-TESTING-PLAN.md) und zum
[Testerauftrag](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6085234573).
Im isolierten Cloud-Testdungeon „GM-UX-01 Nebelwacht“ lieferte Obsidian für den
gespeicherten Raum-12-Hinweis bei drei Suchabfragen keine Treffer. Der Hinweis
war erst nach Kartenöffnung, Geschosswechsel, Raumauswahl und Öffnen des
Inhaltsbereichs sichtbar. Die Testkarte blieb dabei bytegleich. Das ist ein
reproduzierter P2-Kandidat aus einem Endanwenderlauf; weder eine allgemeine
Fehlerquote der Obsidian-Suche noch Produktlatenz oder Nutzungshäufigkeit bei
weiteren GMs ist belegt.

Der Dungeon-Strang hat ausschließlich diesen Planlauf auf Shared-Head
`5fc9f7f6a6a8b20fb8470ad865cd5b84be16c7c1` übernommen. Vor dem Claim bestanden
die Prüfungen auf offene PRs, gleichnamige Remote-Branches und fremden Besitz.
Dieser Plan ändert noch kein Produkt und erteilt keine Implementierungs-, Host-
oder Fachfreigabe.

## Fachliche Grenze

- Die Suche gehört sichtbar in die Inhaltsgruppe des bereits geöffneten
  Dungeon-Editors. Sie ersetzt nicht Obsidian Core Search und scannt nicht das
  Vault nach proprietären Dateien.
- Quelle sind ausschließlich die strukturierten V4-Raum-Keys der aktuellen
  `Session`. V2/V3-Notizdateien, andere Dungeons und vaultweite Volltextsuche
  sind durch GM-UX-005 nicht belegt und werden nicht spekulativ ergänzt.
- Suchabfrage, Ergebnisliste, Trefferfokus und Scrollposition sind flüchtige
  UI-Zustände. Sie werden weder im Kartendokument noch in Tooldefaults, Draft,
  History oder Plugin-Daten gespeichert.
- GM-UX-N-003, DD-036-O01a, Atlaspersistenz, Hex-, City- und H03-Arbeiten bleiben
  eigene Besitzerpfade. Insbesondere öffnet ein Treffer keinen zweiten
  Persistenzweg und ändert keine Atlasplatzierung.
- Nutzerkarten, Raumtexte, Abschnitts- und Fremdkennungen bleiben unverändert.
  Planung und spätere Verifikation arbeiten ausschließlich im isolierten
  Testvault auf der bestehenden synthetischen Nebelwacht-Reproduktion.

## Ein gemeinsames read-only Suchmodell

Ein kleiner hostneutraler Baustein unter `src/room-key-search.ts` projiziert aus
der aktuellen `Session` für jeden strukturierten Raum:

- stabile Raum-, Geschoss- und Abschnittskennung,
- sichtbaren Geschossnamen, Raumnummer und Raumnamen,
- den über den vorhandenen `sectionMarkdown`-Weg abgeleiteten sichtbaren
  Abschnittstext ohne interne Feature-Grenzmarker.

Damit bleiben Markdown-Abschnitte, generierte Durchgangstexte und verwaltete
Featureabsätze dieselbe Inhaltsquelle wie Key-Dock und Raumansicht. Es entsteht
keine zweite Indexdatei, Datenbank oder persistierte Textkopie. Ergebnistext wird
nur als `textContent` ausgegeben; Key-Markdown wird in der Suchliste nicht als
HTML gerendert.

Die Abfrage wird getrimmt, Unicode-normalisiert und ohne Beachtung der
Groß-/Kleinschreibung als zusammenhängender Teiltext gegen den sichtbaren
Abschnittstext geprüft. Eine leere Abfrage zeigt genau einmal jeden
strukturierten Raum als Übersicht. Eine nichtleere Abfrage zeigt jeden passenden
Abschnitt mit kurzem Textausschnitt; Raum und Geschoss sind in jeder Trefferzeile
ausgeschrieben. Die Reihenfolge ist deterministisch: Geschossreihenfolge des
Dokuments, numerische Raumnummer, Raumkennung, Abschnittsreihenfolge. Gleiche
Raumnummern oder gleiche Texte werden nicht zusammengelegt.

Beschädigte oder während einer Aktualisierung verschwundene IDs erzeugen keinen
stalen Treffer: Die Projektion wird aus der aktuellen Sessionrevision neu
gebildet. Ein nicht strukturiertes Dokument zeigt einen ehrlichen
Nicht-verfügbar-Hinweis und wird weder migriert noch verändert.

## Sichtbarer Ablauf im bestehenden Editor

1. Die Inhaltsgruppe erhält den Eintrag „Raum-Keys durchsuchen“. Dessen Panel
   besitzt ein eindeutig beschriftetes Suchfeld, eine Leeren-Aktion, einen
   sichtbaren Ergebniszähler mit Statussemantik und normale fokussierbare
   Ergebnisbuttons. Öffnen allein zeigt die geordnete Raum-/Geschossübersicht.
2. Tippen aktualisiert die Treffer aus der aktuellen Session ohne Enter.
   Leeren – über Schaltfläche oder leere Eingabe – entfernt alle alten Treffer
   und stellt dieselbe Übersicht wieder her. Es bleiben weder versteckter Filter
   noch markierter alter Treffer zurück.
3. Aktivierung validiert Raum, Geschoss und Abschnitt erneut. Sie verwendet den
   bestehenden Geschosswechsel, die normale Auswahl, `MapRenderer.focus` und den
   vorhandenen `StructuredKeyPanel`; keine eigene Kamera, Auswahl oder Key-
   Ansicht. Danach ist das richtige Geschoss sichtbar, der Raum gewählt und
   fokussiert, der Key-Dock offen und der passende Abschnitt angesprungen.
4. Die Navigation darf keinen offenen Key-Entwurf stillschweigend übernehmen
   oder verwerfen. Ist der aktuelle `StructuredKeyPanel` dirty, bleibt der
   Trefferwechsel blockiert und fordert sichtbar „Übernehmen“ oder „Verwerfen“.
   Ohne offenen Entwurf erzeugt Aktivierung keinen Befehl und keinen Save.
5. Nach erfolgter Aktivierung bleibt „Raum-Keys durchsuchen“ direkt erreichbar.
   Die Suchabfrage darf beim Wechsel im selben Editorprozess flüchtig erhalten
   bleiben; nach Editor-Neuöffnung startet die Übersicht leer. Das ist UI-
   Komfort, keine Kartenpersistenz.

## Unveränderlichkeits- und Abnahmeorakel

Vor Suche und nach Trefferaktivierung werden aus derselben Session geprüft:

- kanonisch serialisiertes `session.document()`,
- `session.dirty`, `session.historySize`, Undo-/Redo-Verfügbarkeit,
- sämtliche Raum-, Geschoss-, Abschnitts-, Feature- und Fremdkennungen,
- der exakte Markdown-Wortlaut des Raum-12-Hinweises.

Nur flüchtige Ansichtswerte dürfen sich ändern: aktives Geschoss, Auswahl,
Kamera, offener Key-Abschnitt und Suchzustand. Dokumentserialisierung,
History-/Dirty-Werte und Text müssen vor/nach Suche und Aktivierung identisch
sein. Ein anschließender Save einer zuvor sauberen Karte bleibt ein No-op; die
Dateibytes bleiben gleich. Nach Schließen und frischer Neuöffnung findet dieselbe
Abfrage denselben Hinweis mit denselben stabilen IDs. Damit belegt Save/Reload
die Erhaltung des Hinweises, nicht die Persistenz der Suchabfrage.

Der bereits beschriebene Reparaturablauf ist bindend und wird nicht explorativ
erweitert:

1. isolierte Nebelwacht öffnen und die gespeicherte Basis hashen,
2. „blaue Fackel“ eingeben,
3. Treffer nennt „Raum 12“ und „Geschoss 1“,
4. Treffer aktivieren: Geschoss 1, Raum 12 und dessen Key-Abschnitt sind sichtbar,
5. Dokument-/History-/Dirty-Orakel bleibt unverändert,
6. Suche leeren: vollständige Raum-/Geschossübersicht kehrt zurück,
7. speichern, regulär schließen und frisch neu öffnen,
8. denselben Begriff erneut finden und den wortgleichen Hinweis bestätigen.

## Umsetzungspakete und Gates

| Lauf | Umfang | Gate |
| --- | --- | --- |
| `GM-UX-N-005-I01` | Reine V4-Projektion und Suche auf der bestehenden Sessionquelle | Gezielte Unitfälle für leere Übersicht, eindeutigen Begriff, Unicode/Großschreibung, mehrere Geschosse, doppelte Nummern, mehrere passende Abschnitte, Passage-/Featuretext und beschädigte Ziele. Keine Sessionmutation. |
| `GM-UX-N-005-I02` | Inhaltsgruppen-Panel und Aktivierung über vorhandene Geschoss-/Auswahl-/Kamera-/Key-Wege | DOM-/Editorregressionen für Tippen, Leeren, Tastaturfokus, Ergebnisstatus, dirty Key-Draft-Blockade und exakte Dokument-/History-/Dirty-Gleichheit. Keine parallele Raumansicht. |
| `GM-UX-N-005-R01` | Unabhängiger Produktreview | Datenquelle, Navigation, Accessibility, geschützte Texte/IDs und Nichtmutation auf dem exakten Implementierungscommit prüfen; Pflichtlücken vor Hostlauf nachbessern. |
| `GM-UX-N-005-H01` | Genau der veröffentlichte Nebelwacht-Reproduktions- und Abnahmeablauf im isolierten Cloud-Obsidian-Host | Sauberer Build/Tripel, sichtbare Schritte, Vorher-/Nachherhash, normaler Exit und frische Neuöffnung. Synthetische Fernsteuerung bleibt keine physische Eingabeabnahme. |
| `GM-UX-N-005-GM-R01` | Unabhängiger Produkttester-Nachtest | Der Tester wiederholt ausschließlich seine beschriebene Suche. Erst dieser Nachtest darf das Folgeaufgabenticket schließen. |

Jedes Umsetzungspaket erhält fokussierte Regressionen sowie `npm run check`,
`npm test` und `npm run build`. Produktreview, Hostlauf und Produkttester-Nachtest
sind getrennte Arbeitspakete. Kein Lauf beansprucht Dungeondraft-Parität, globale
Obsidian-Suche, GM-UX-N-003, Atlas-/City-Freigabe oder Gesamtfreigabe.

## Prüfung dieses Plans

Der Planstand wird durch JSON-, Verweis- und Diffprüfung sowie einen
unabhängigen read-only Review des exakten Commits geprüft. Der Reviewer gleicht
ihn gegen Issue-#1-Kommentar `6085234573`, den GM-Produkttest, die aktuellen
Session-/Room-/Key-/Editorpfade und die Nichtmutationsgrenze ab. Ein PASS öffnet
nur `GM-UX-N-005-I01`; es ist keine Implementierungs-, UX-, Host- oder
Fachfreigabe. Bei Pflichtbefund folgt ein eigener Planreparaturcommit und ein
erneuter unabhängiger Review.
