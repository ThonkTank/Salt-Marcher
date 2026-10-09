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

Das Suchpanel abonniert beim Öffnen `Session.subscribe`, projiziert bei jeder
relevanten Raum-, Geschoss- oder Abschnittsänderung die bestehende Abfrage neu
und meldet sich bei Panel-/Editorabbau wieder ab. Eingabetext und Fokus bleiben
bei einem Refresh erhalten; Übersicht, Zähler und Treffer stammen danach nur
aus der neuen Sessionrevision. Ein zwischen Rendern und Klick verschwundenes
Ziel wird bei Aktivierung nochmals geprüft, sichtbar als nicht mehr verfügbar
gemeldet und mutationsfrei verworfen. Ein nicht strukturiertes Dokument zeigt
einen ehrlichen Nicht-verfügbar-Hinweis und wird weder migriert noch verändert.

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
4. Vor **jedem** Geschoss-, Auswahl- oder Abschnittswechsel läuft ein gemeinsamer
   Key-Draft-Guard. `StructuredKeyPanel` stellt dafür seinen heutigen privaten
   Dirty-Befund als reine Abfrage bereit. `DungeonEditor.switchFloor`,
   `selectMany` und `StructuredKeyPanel.focus` verwenden denselben Guard statt
   einen dirty Entwurf durch ihre heutigen impliziten `commitNote()`-/`commit()`-
   Aufrufe zu übernehmen. Bei dirty bleibt der gesamte Navigationsschritt vor
   der ersten Ansichtsmutation stehen, Textarea, Geschoss, Auswahl, Kamera,
   Dokument und History bleiben unverändert; die Textarea erhält Fokus und der
   sichtbare Hinweis fordert „Übernehmen“ oder „Verwerfen“. Nur diese bereits
   vorhandenen ausdrücklichen Aktionen dürfen den Entwurf anwenden oder
   zurücksetzen. Danach löst ein erneuter Trefferklick die normale Navigation
   aus. Bei clean ist der Guard ein No-op; Aktivierung erzeugt keinen Befehl und
   keinen Save.
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
| `GM-UX-N-005-I02` | Inhaltsgruppen-Panel und Aktivierung über vorhandene Geschoss-/Auswahl-/Kamera-/Key-Wege | DOM-/Editorregressionen für Tippen, Leeren, Tastaturfokus, Ergebnisstatus und Session-Subscribe/Unsubscribe. Ein nach Rendern geänderter oder entfernter Zielraum verschwindet beziehungsweise bricht beim Klick sichtbar und mutationsfrei ab. Der erste Trefferklick bei dirty Key-Draft lässt Textarea, Geschoss, Auswahl, Kamera, Dokument, History und Dirty-Status exakt stehen; erst ausdrückliches Übernehmen/Verwerfen erlaubt den zweiten Klick. Keine parallele Raumansicht. |
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

## Umsetzungsstand

`GM-UX-N-005-I01` ist auf dem exakten Reparaturstand
`63f1270f124100b4b73088430584b92debcbd4cd` unabhängig reviewt und ohne
verbleibenden Pflichtbefund bestanden. Die reine V4-Projektion liefert bei
leerer Suche eine deterministische Raum-/Geschossübersicht und bei Textsuche
einen Treffer je passendem Key-Abschnitt mit stabilem Ziel und sichtbarem
Ausschnitt. Unicode-Normalisierung, Groß-/Kleinschreibung einschließlich
kontextabhängigem Sigma, längenändernde Faltungen, lange Treffer, mehrere
Geschosse, doppelte Raumnummern, Passage-/Featuretext und beschädigte Ziele
sind durch Regressionen gedeckt. Dokument, Dirty-Zustand, History und Revision
bleiben unverändert.

Der erste Implementierungsreview verlangte vollständige Ausschnitte für lange
Treffer und eine Offsetabbildung bei längenändernder Unicode-Faltung. Der erste
Reparaturreview fand zusätzlich die kontextabhängige Sigma-Faltung. Beide
Pflichtbefunde sind in den getrennten Reparaturcommits
`b78ea9462d76b1600aa91dd909c7b87f3bc45e21` und
`63f1270f124100b4b73088430584b92debcbd4cd` behoben; der abschließende
read-only Review des exakten letzten Stands bestand.

`GM-UX-N-005-I02` ist auf dem exakten Reparaturstand
`84440f161914b985acbfd23fbd79cb51bd1e6360` unabhängig reviewt und ohne
verbleibenden Pflichtbefund bestanden. Das Inhaltsgruppen-Panel projiziert die
I01-Suche in normale fokussierbare Ergebnisbuttons, aktualisiert Treffer aus der
laufenden Session, verwirft stale Ziele sichtbar und stellt beim Leeren die
Raum-/Geschossübersicht wieder her. Die Aktivierung verwendet den vorhandenen
Geschoss-, Auswahl-, `StructuredKeyPanel`- und `MapRenderer.focus`-Weg. Ein
dirty Key-Entwurf blockiert Geschoss-, Auswahl-, Canvas-, Abschnitts- und
Trefferwechsel vor der ersten Mutation; erst ausdrückliches Übernehmen oder
Verwerfen erlaubt den Wiederholungsversuch.

Der erste unabhängige I02-Review von
`8b484dd17600955fae8cc2023bd457b901126429` fand vorgezogene implizite
Key-Commits und fehlende Editororakel. Reparatur
`b0ede7e51eed0557b51a6896ae3804a28c94bd6c` entfernte diese Übernahme und
ergänzte den gemeinsamen Aktivierungskoordinator samt View-/Sessionorakeln. Der
Nachreview fand noch direkte Einfügen-/Löschen-Auswahlpfade; Reparatur
`84440f161914b985acbfd23fbd79cb51bd1e6360` schloss sie und bestand den
abschließenden read-only Review. Frisch bestanden: sechs fokussierte serielle
DOM-/Editorfälle. Nach Integration des aktuellen Shared-Stands bestanden auf
`b8beed18e7f1553bfd5c37192769f2d43ff65b0b` außerdem `npm run check`,
`npm test` mit 365/365 und `npm run build`.

Der getrennte `GM-UX-N-005-R01` bestand den unabhängigen read-only Produktreview
des exakten I02-Implementierungsstands
`84440f161914b985acbfd23fbd79cb51bd1e6360` ohne Pflichtbefund; dokumentiert
in Issue-#1-Kommentar `6087430151`. Der Reviewer bestätigte auf Shared
`b65937e4fe668e8d60eb148671cdfa2979b3be79`, dass die vier geprüften
Implementierungsdateien seit dem Kandidaten unverändert sind. Datenquelle,
flüchtiger UI-Zustand, Accessibility, Zielrevalidierung, vorhandene
Navigationswege, Dirty-Draft-Guard und Nichtmutation wurden gegen Plan und
Regressionen geprüft.

Damit sind I01, I02 und R01 bestanden. Der exakt beschriebene
Nebelwacht-Cloud-Hostlauf H01 bestand den Kernablauf, belegte aber drei enge
UI-Reibungen (Issue #1 `6087535370`): Filter blieb nach Neuöffnung erhalten,
ein sauberer offener Key-Dock verdrängte die Suche, und die 256-px-Trefferzeile
zeigte Raum/Geschoss nicht sichtbar.

`GM-UX-N-005-N01` wurde auf Base
`7d35591b9ec02034f6ce63dbbbb8f27d7ccc9bf0` exklusiv übernommen und im
Produktcommit `a06703c` umgesetzt. Eine neue Panelinstanz initialisiert den
flüchtigen Filter ausdrücklich leer und ohne Formularwiederherstellung; im
gleichen Editor bleibt die Abfrage weiterhin flüchtig erhalten. Das Öffnen der
Suche schließt einen sauberen Key-Dock über den vorhandenen `toggleKey`-Weg,
während der gemeinsame Dirty-Draft-Guard vor jeder Gruppen-, Panel- oder
Layoutmutation stoppt. Treffer besitzen eine eigene Raum-/Geschoss-Ortszeile,
intrinsische Höhe und einen begrenzten scrollbaren Ergebnisbereich. Acht
fokussierte DOM-/Editorfälle, Typprüfung, 375/375 Tests und Build bestanden vor
der Shared-Integration. Der unabhängige read-only N01-Produktreview bestand den
exakten Commit `a06703c31766a064c6a8e8510a1cb5eaa46ca549` ohne Pflichtbefund:
neue/leere versus gleichinstanzlich flüchtige Suche, Guard-Reihenfolge,
bestehender Key-Dock-Weg und statischer DOM-/CSS-Vertrag wurden bestätigt. Der
exakt gleiche Cloud-GM-Nachtest bleibt getrennt offen; in N01 und Review wurde
kein GUI-Host gestartet.

Die verlinkten Acceptance-Einträge `EB-003` und `NATIVE-21` bleiben
unverändert; N-006 bleibt getrennt. Es folgt keine UX-, Host-, Fach-, Paritäts-
oder Gesamtfreigabe.
