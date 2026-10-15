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

Ableitungsgrenzen sind weiterhin verschieden: Textreader und Alias-SQL liefern
höchstens 200 Verweise je Dokument, `documentReferences` liest 201 als Überlauf-
Sentinel, der Graph zeigt bis zu 40 Kanten. Remap verarbeitet alle aktiven
Verweise, auch außerhalb dieser Seiten. Der derzeitige Aliasport meldet die
Dokumentkappung noch nicht; ein fehlender Treffer beweist bei langen Quellen
keine fehlende Verknüpfung. Suche auf großen Campaigns untersucht aktuell die
Prosa im SQL-UDF; eine LIMIT-Seite begrenzt die Antwort, nicht den Quellenread.

## Nächste Lieferungen und Abnahmen

| Schritt | Code, Datenregel und Endnachweis |
| --- | --- |
| Native Editorweg | `preparation.ts`, Picker, vorhandener Draftwriter: Tastatur/Modalcancel/200 %, IME, ausgewählter CRLFtext → expliziter Verweis → Autosave → Close/Fresh; verzögerter Flush mit neuer Prosa und A→B→A. Quelle während Bestätigung ändern/archivieren; unverfügbare Quelle bleibt erkennbar. |
| Ehrliche lange Quellen | `storage/text-references.ts`, `scene-desk.ts`, `quick-reference-ui.ts`, Graph: den 201-Sentinel als sichtbare Begrenzung durch den bestehenden Readport führen; echte Treffer hinter 200 müssen auffindbar werden, ohne alle Bodies zum Renderer zu schicken. Vor Indexdesign reale Campaign mit langen/kurzen Notizen messen; gemeinsame Einzelquelle/kein zweiter Autorengraph. |
| Quellintegrität | Alias-SQL und `referenceEntry`: Die integrierte Zielprüfung validiert jetzt Checksum/Payload-/Rowidentität. Quell-Rowidentität, Revision und Papierkorb so prüfen wie direkte Detailreads; defekte Quelle ausdrücklich unbekannt, keine gesunde leere Treffermenge. Fehlende Ziele erhalten Alias und stabile ID. Gleicher Name führt nie zu stiller Neuzuordnung. |
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
Fünf weitere Integrationsfälle prüfen Ortsabschnitt-Flush und entfernte Controls,
Notebook-Wortlaut/alte Auswahlen und weiterhin benutzbare Ortsdirectory.
Diese lokalen Belege ersetzen weder die native Editorprobe noch vollständige
Markdown-, Portabilitäts-, Performance- oder Gesamtproduktabnahme.
