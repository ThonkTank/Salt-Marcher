# Autorenverweise: Wortlaut, Auswahl und unabhängige Kopien

Die GM-Notiz bleibt ein frei bearbeitbarer Text. Ein eigener Anzeigename kann
auf eine konkrete Notiz, einen Ort, ein Creature-/Itemdefinitionziel oder eine
Encountervorlage verweisen. Gleiche Namen bezeichnen weiterhin verschiedene
Identitäten. Die [Originalanforderung SRC-F02](../../SCOPE.md) verlangt leichte
manuell auflösbare Wissensinhalte und unabhängige Campaignkopien; Verweise
führen keine Questauflösung, Kampfaktion oder Spielerfreigabe aus.

## Aktueller ausführbarer Weg

`preparation.ts` erfasst in GM-Notiz und Ortsabschnitt Wortlaut und markierte
Autorenstelle vor dem Flush.
Der Flush darf die Notizrevision bestätigen, aber die Position nicht auf einen
zwischenzeitlich anderen Text übertragen. Nach dem Flush und dem Picker gelten
Campaignobjekt, Token/ID, Aktivierung, Notiz-/Abschnitteditorgeneration, Notiz-/Orts-/Abschnitt-ID und der
ursprüngliche Wortlaut. Ein Wechsel A → B → A erhält dadurch keine alte
Einfügeberechtigung. Die vorhandenen Preparationdraft-/Autosaveregeln speichern
den eingefügten Text; der Picker führt keine eigene Speicherung ein.

`text-reference-picker.ts` liest Suchseiten und die gewählte Quelle. Die letzte
Bestätigung bindet Zielart/-ID, angezeigte Revision und Alias; ein verzögerter
Read darf eine inzwischen andere Auswahl nicht genehmigen. Neue Aliase während
des Detailreads bleiben erhalten. Cancel, Schließen oder entwerteter Kontext
liefern kein Ergebnis und keine alte Fehlermeldung an den neuen Editor.
Wiederholte Bestätigung während desselben Reads startet keinen weiteren Read.

Der deklarierte Textvertrag lautet
`[Anzeigename](dungeon-ref:note/<URI-kodierte-ID>)`; die übrigen Zielarten sind
`location`, `creature`, `item`, `encounter`. Anzeigename, Escapezeichen, freie
Prosa, CRLF und externe Markdown-/Vaultlinks bleiben Autorenbytes. Die lesende
Kurzreferenz darf echte Verweise als Anzeigenamen mit Aktion darstellen;
diese Projektion darf nicht in gespeicherte GM-Prosa zurückgeschrieben werden.

`text-references.ts` wird von Readerprojektion, SQLite-Alias-/Graphableitung und
Campaignremap gemeinsam verwendet. Inline-Code mit gleich langen Backtickruns,
Backtick-/Tildefences einschließlich ungeschlossener Fences, eingerückte
Codezeilen, escaped Linkanfänge und Bilder erzeugen keine kontrollierten Ziele.
Beim Kopieren bleibt deren Text vollständig wörtlich. Das ist die gezielte
Verweisgrammatik, keine vollständige CommonMark-/HTML-/Obsidianimplementation.
Verschachtelte Listen/Blockquotes, HTML-Code und komplexe Linkverschachtelung
müssen an eigenen Originalaufgaben geklärt werden, bevor allgemeine Markdown-
Ergebnisgleichwertigkeit behauptet wird.

`storage/campaign-data.ts` ersetzt bei unabhängiger Kopie nur deklarierte aktive
Zielsegmente: Campaignziele erhalten neue IDs, Creaturedefinitionen behalten
ihren Katalogbezug, Itemziele folgen der gewählten Definitionszuordnung.
Quelltext, Sicherungsdatei und opaque Extensionbodies bleiben geschützt.
NPC-Rohentwürfe und ungeklärte Commands verwenden denselben Remap; ihre
Receipt-/Draftintegrität bleibt am bestehenden Recoveryowner.

Die inzwischen integrierte Ortsmappe (`location-notebook-ui.ts`) gibt nur den
gewählten Abschnitt mit vollständigen Autorenbytes an den GM-Sceneentwurf
weiter. Ihre Inhaltsbuttons binden ihre ursprüngliche Mappe und Inhaltsauswahl;
Directorybuttons behalten dagegen die Autorität der Suchseite, sodass ein
Ortswechsel die gesunde Verzeichnisnavigation nicht sperrt. Der Renderer prüft
den ursprünglichen Campaignowner nochmals nach Live-Reads und vor dem
Vorlesehandoff. Native/Fresh-Closure dieses neuen Consumers bleibt offen.

## Datenstand und Grenzen

Keine Schema- oder Autorenmigration: Alias und Kanten werden aus Text abgeleitet,
kein zweiter dauerhafter Graph wird eingeführt. Bestehende Quellen werden nicht
umgeschrieben. In bereits früher erzeugten Kopien veränderte Beispiele lassen
sich ohne Original nicht zuverlässig rekonstruieren; keine automatische
Rückersetzung anhand vermeintlicher IDmuster.

Suche und eingehende Kanten untersuchen inzwischen alle aktiven Verweise einer
validierten Quelle. Die API liefert weiterhin höchstens40 Treffer sowie eine
zusammengefasste Quellenwarnung; `next` ist eine Seite, kein Autorenlimit.
Ungültige Prüfsumme, Schema, Notiz-ID/-Revision oder Orts-ID erzeugen einen
sichtbar unvollständigen Stand. Gesunde Quellen bleiben erreichbar. Fehlende
oder defekte Ziele bleiben als nicht verfügbar erkennbar; sie liefern keine
fremden Payloadnamen. Sourcefehler erzeugen weder Reparaturwrite noch einen
bestätigten Negativbefund.

Detailreader zeigen zusammen höchstens200 Inlineaktionen und melden weitere
Verweise ausdrücklich; deren Originaltext bleibt vollständig lesbar und die
Ziele über Verknüpfte Begriffe auffindbar. `documentReferences` liest standardmäßig
201 als Sentinel für diesen Reader, Suchableitung und Remap verarbeiten alle
aktiven Verweise. Der Graph bleibt bei40 eingehenden/ausgehenden Verbindungen mit
Hinweis auf weitere. Eine Detailabfrage prüft jedes wiederholte gleiche Ziel nur
einmal; folgende Detailabfragen lesen dessen aktuellen Stand erneut.

Die SQL-Ableitung ist nur innerhalb der Anweisung materialisiert. Der UDF prüft
vor jedem Cachetreffer den tatsächlichen Payloadhash; Key enthält Quellenart,
Row-ID, Rowrevision und Checksum. Nur bereits validierte nichtleere Ableitungen
werden pro Datenbankverbindung flüchtig gehalten: höchstens4MiB serialisierte
Werte und1024 Einträge, zusätzlich deren Map-/Schlüsseloverhead. Keine
Originaltexte, aktuellen Zielmetadaten, negativen Fehlerresultate oder zweite
dauerhafte Graphdatenbank werden gecacht. Papierkorb/Erasure/Campaignfilter
stehen vor der Funktion; ein Cacheeintrag kann keinen fehlenden Record ersetzen.
Andere Kampagnen mit gleichen IDs lesen ihre eigenen aktuellen Ziele.

Die erste Messfixture enthält170 Dokumente,30.000 Verweise und2,48MB Sourcebytes.
In einem gepaarten Guarded-Job brauchte die uncachierte gleiche Ableitung126–155ms;
wiederholte Cacheabfragen72–98ms, Coldstart136ms. Es werden weiterhin pro
Suchseite alle170 Quellenhashes geprüft und alle Sourcebytes gelesen. Die
Antwortgrenze ist keine Querykostengrenze. Ein2MiB-Prototyp verdrängte in diesem
Korpus fortlaufend und brachte kaum Nutzen;4MiB ist eine gemessene lokale Wahl,
keine allgemeine p95-/Native-/RAMqualifikation. Größere echte Campaigns,
Cacheverdrängung und SQLtemp-Kosten bleiben abzunehmen.

## Nächste Lieferungen und Abnahmen

| Schritt | Code, Datenregel und Endnachweis |
| --- | --- |
| Native Editorweg | `preparation.ts`, Picker, vorhandener Draftwriter: Tastatur/Modalcancel/200 %, IME, ausgewählter CRLFtext → expliziter Verweis → Autosave → Close/Fresh; verzögerter Flush mit neuer Prosa und A→B→A. Quelle während Bestätigung ändern/archivieren; unverfügbare Quelle bleibt erkennbar. |
| Nächste Skalierung | `storage/text-references.ts`, `scene-desk.ts`, `quick-reference-ui.ts`, Graph: Die Suchkappung ist entfernt, Readerbegrenzung und Sourcefehler sind sichtbar. Nun echte große Campaigns, Cold-/Warm-/Verdrängungsfälle, Graphdoppelreads und Cancel im tatsächlichen Worker messen. Erst danach persistenten abgeleiteten Index oder Cursorvertrag entscheiden; Hash-/Rebuild-/Erasuregrenze im selben kleinen Anschluss erhalten. |
| Quellintegrität und Wiederaufnahme | Alias-SQL, Reader und Zielmetadaten prüfen jetzt Checksum/Schema/Rowidentität; defekte Sources werden nicht leer gemeldet. Warmcache nach manipulierter Bytefolge, Rowrevision, Reparatur und Trash geprüft. Als Nächstes tatsächliche Worker-Neustarts während großem Read und vollständige unabhängige Export-/Erasureclosure; fehlende Ziele behalten ihren Alias statt Namensersatz. |
| Verbraucherclosure | Vorlesetext, Ortsabschnitte, NPC-Dossier, Spielabendmappe/Markdownausgabe und unabhängiger Export: ein Wortlautorakel durch alle konsumierenden Wege; Readerprojektion bleibt nur Anzeige. Vor Erweiterung der Einfügeflächen gemeinsame Autorenstelle/Ownergrenze verwenden. Passive Playerfreigabe bleibt eigenständig. |
| Markdown und Skalierung | Echte Obsidian-/Originaltexte mit verschachtelten Literalen und Fremdlinks als geschützte Kopie untersuchen. Umfang der kontrollierten Syntax entscheiden, dann gemeinsame Parsergegenbelege erweitern. Wiederholte offene Klammern/Backtickruns und große Quellen messen; keine neue Parserbibliothek oder Indexmigration ohne nachgewiesenen Nutzen. |

## Lokaler Nachweis vom 15.10.2026

`tests/desktop-text-references.test.mjs` prüft den tatsächlichen Parser/Picker und
den Preparationeventconsumer mit verzögerten Ports. Vor der Korrektur scheiterten
14 von 17 Parser-/Pickerfällen; vor der Autorenstellenkorrektur zusätzlich drei
von vier Consumerfällen. Ein anfänglicher Probe-Bundlefehler (Zuweisung an einen
Import) war ein Fixturefehler und ist kein Produktgegenbeleg.

`tests/desktop-text-reference-store.test.mjs` verwendet den realen SQLite-Store:
Alias-/Graphableitung, identische Namen mit verschiedenen IDs, unabhängige
Campaignkopie und erneutes Öffnen des Zielstores; nur aktive Zielbytes ändern
sich, Literalbeispiele/CRLF/Vaultlinks und Quelle/Snapshotbytes bleiben erhalten.
Weitere Integrationsfälle prüfen Ortsabschnitt-Flush und entfernte Controls,
Notebook-Wortlaut/alte Auswahlen und weiterhin benutzbare Ortsdirectory.
Diese lokalen Belege ersetzen weder die native Editorprobe noch vollständige
Markdown-, Portabilitäts-, Performance- oder Gesamtproduktabnahme.

Die Folgeprüfung verbindet Sourcechecksum/-Identität/-Revision, Alias239,
83 eindeutige Ziele in Seiten, tatsächliches Fresh, reparierte/trashte Quellen
nach Warmcache und identische IDs in verschiedenen Kampagnen. Der echte
Schnellsucheconsumer erhält Rohprosa beim Vorlesehandoff, kennzeichnet teilweise
lesbare Ergebnisse und ignoriert entfernte alte Aktionen. Eine zuerst fehlende
Fixture-Kopfzeile war ein Setupfehler; die bereinigte ursprüngliche Readerquelle
zeigte anschließend die tatsächlichen zwei Gegenbefunde. Abgeleitete
Cache-/Querymessung und inhaltliche Richtigkeitsproben bleiben getrennte Belege.
