# Autorenverweise und unabhängige Kopien

Stand: 15.10.2026. [SRC-F02](../../SCOPE.md) verlangt leicht manuell auflösbares
Weltwissen und unabhängige Kampagnenkopien. Textverweise ergänzen vorhandene
Notizen und Ortsabschnitte; sie führen keine Quest-, Kampf- oder Spielerwirkung aus.

## Vorhandener Ablauf und Datenvertrag

„Textverweis einfügen“ hält vor dem Flush Originaltext, Auswahl und Editorowner.
Ein bestätigter Flush darf die Revision erneuern, aber keine andere Autorenstelle
freigeben. Campaign, Aktivierung, Notiz/Ort, Abschnitt und Editorgeneration
bleiben über Auswahl und Quellprüfung gebunden. Der vorhandene Vorbereitungs-
entwurf speichert den eingefügten Text; der Picker hat keinen eigenen Writer.

Der Picker liest Suchseiten und die gewählte Quelle. Die Bestätigung bindet
Zielart/-ID, angezeigte Revision und Anzeigenamen. Neue Suche oder Auswahl
entwertet alte Controls und Antworten; während eines Quellreads eingegebene
Namen bleiben erhalten. Wiederholtes Bestätigen löst keinen zweiten Read aus.
Abbruch, Schließen und geänderter Editorowner liefern kein Einfügeergebnis.

Die Syntax lautet `[Anzeigename](dungeon-ref:note/<URI-kodierte-ID>)`;
weitere Zielarten sind `location`, `creature`, `item`, `encounter`.
Anzeigenamen, Escapes, freie Prosa, CRLF und externe Markdown-/Vaultlinks bleiben
Autorenbytes. Reader dürfen Namen als bedienbare Verweise anzeigen; diese
Projektion darf keine gespeicherte GM-Prosa ersetzen. Schnellsuche, Ortsmappe und
Spielabendstart übergeben Originaltext an den bestehenden Liveentwurf.

Reader, SQLite-Aliassuche, Graph und Kampagnenkopie verwenden dieselbe Grammatik.
Codebeispiele, Fences, eingerückte Codezeilen, escaped Linkanfänge und Bilder
sind keine aktiven Ziele. Verschachtelte Listen/Blockquotes, HTML-Code und
komplexe Linkverschachtelung sind noch keine allgemeine Markdown-Parität.
Unabhängige Kopien ändern nur aktive Zielsegmente: Kampagnenziele bekommen neue
IDs; Creature-/Itemziele behalten den zugehörigen Katalog-/Definitionsbezug.
Quelle, Snapshot und opaque Erweiterungsbodies bleiben erhalten. NPC-Rohentwürfe
und ungeklärte Commands folgen ihrem bestehenden Recoveryvertrag.

## Vorhandene Quellen im Raum-Key verknüpfen

Verknüpfte Notizen und Inhalte stehen direkt beim GM-Raumtext. Die ausklappbare
Suche findet vorhandene Notizen, Orte und Spielabende; höchstens acht Treffer
bleiben gleichzeitig als Auswahl sichtbar. Ein Treffer oder Enter verknüpft das
Original über den vorhandenen Key-Writer. Bereits gebundene IDs werden nicht
nochmals angeboten. Der Suchbegriff bleibt beim Raumwechsel, wird beim Wechsel
der Kampagnenaktivierung geleert; entfernte Treffer haben keine Schreibautorität.
[Native Aufgabe und Obsidian-Gegenprobe](../../reference/gm-ux-qa/room-rule-reuse-20261018/README.md)
prüfen zentrale Korrektur, beide Raumverwendungen, individuelle Ergänzung und Fresh.
Ein aus der eingeblendeten Quelle geöffneter Raum kehrt zur Quelle beim ursprünglichen
Raum zurück. Der Atlas bleibt dabei offen. Während der Quellenbearbeitung besitzt
der vorhandene Notizeditor die Detailfläche; „Zum Raumtext“ bleibt beim Scrollen
sichtbar und gibt die Raumfelder wieder frei. Aus der Wissensansicht begonnene
Raumverwendungen behalten deren bisherigen Rückweg.

## Markierte Texte als Weltwissen übernehmen

Eine nichtleere Auswahl im GM- oder Vorlesetext zeigt die Übernahmeaktion direkt
am jeweiligen Textfeld. Sie ist mit Tab erreichbar und bleibt oberhalb der
festen Musikleiste sichtbar; in einer geöffneten Mappe folgt sie deren Scrollbereich.
Der Dialog sucht zuerst nach dem Originalnamen. Ein gewähltes Original behält
seine Art; nur eine neue Notiz verlangt die Artwahl. Der unveränderte Quelltext
und beide Herkunftsbeziehungen bleiben beim bestehenden Writer.

Die nativen Prüfungen `tools/test-desktop-note-excerpts.mjs` und
`tools/test-desktop-note-existing-excerpts.mjs` prüfen Neuanlage, Ergänzung,
Spielabendverwendung, normales Prozessende, frisches Wiederfinden und
Weiterbearbeitung. `GM_QA_ZOOM=2` prüft denselben Ablauf vergrößert.

## Beziehungspaare beim Kampagnentransfer

Paarhistory und offene Paaraufträge verwenden `sourceId` als lokale World-Notiz.
Die Kopie bindet diese beiden bekannten Payloadformen zusammen mit ihren SQL-
Ownern, Gegenrichtungen, Command- und Draftkennungen an die neue Kampagne.
Externe Quellenkennungen und opaque Inhalte behalten ihre bisherige Bedeutung.
Freie Prosa mit alten ID-Zeichenfolgen wird dadurch nicht umgeschrieben.

Ein erhaltener Pendingauftrag darf einen vorhandenen Beleg nur weiterführen,
wenn Campaign, beide Notizen und der tokenlose Originalfingerprint vorher
zusammenpassen. Erst danach wird dieser Beleg an die kopierten Kennungen
gebunden. Historische Belege ohne erhaltenen Auftrag werden nicht neu autorisiert.
Die Kopie erhält keine ursprüngliche Tokenfreigabe und führt nichts automatisch
aus. Undo/Redo wirken auf die kopierten Notizen; Quelle und Snapshot bleiben gleich.
Es gibt keine Schema- oder Autorenmigration.

Die Storegegenproben in `world-links-storage.test.ts` öffnen eine neue Storeinstanz,
prüfen kopierte History und nicht angewandte/angewandte Originalaufträge sowie
Ablehnung einer fremden Belegbindung. Das ist keine native Recoveryabnahme.
Die Statusklärung im `WorldLinksWorkbench` bindet jede Antwort an den ursprünglichen
Dialogaufruf, Campaigntoken und Paarauftrag. Bei `applied` prüft sie den vorhandenen
Entwurf erneut und entfernt nur dessen passende Write-ID. Bereits entfernte
Entwürfe sind abgeschlossen; eine verlorene Bereinigungsantwort darf erneut
lesend geklärt werden. Ein anderer gespeicherter Paarentwurf bleibt erhalten; bei unveränderten
Formulareingaben wird er zur eigenen Prüfung geladen. Bei zugleich neueren lokalen
Eingaben bleiben beide Varianten erhalten und die Übernahme ist gesperrt.
„Eingabe verwerfen“ verwirft dann nur die lokalen Eingaben und lädt den
gespeicherten Entwurf; dessen persistierte Write-ID wird nicht gelöscht. Neuere Formulareingaben werden nicht durch die
Bestätigung des früheren Commands ersetzt; die aktuelle Basis kann anschließend
gezielt gelesen werden. Während der Prüfung und des anschließenden Refreshs ist
das Paarformular gesperrt. Statusklärung führt keinen weiteren Beziehungscommand
aus und überschreibt keine inzwischen bearbeitete GM-Prosa.

`world-links-recovery.test.ts` verbindet den echten Workbench mit dem echten Store:
erhaltene/entfernte und tatsächlich kopierte angewandte Aufträge, neuere Eingaben,
eine andere Write-ID, spätere GM-Prosa, verlorene Bereinigungsantwort und verspätete
Antwort nach Kontextwechsel. Das ist ein kontrollierter Store-/DOMbeleg; native
Dialog-, Fokus-/IME-, Crash- und vollständige Kampagnenwechselabnahme bleiben offen.

## Statusklärung gerichteter Beziehungen und Paarhistory

Auch einzelne Beziehungs- und Paarhistoryaufträge binden die Statusantwort an
Workspace, Token, ursprünglichen Command und Dialogaufruf. Erneutes Öffnen mit
demselben Token gibt einer früheren Antwort keine Schreib- oder Anzeigeautorität.
Die Prüfung führt weder den Beziehungscommand noch Undo/Redo erneut aus.

Ein bereits angewandter Einwegauftrag entfernt nur seinen zugehörigen
Vorbereitungsentwurf mit der vorhandenen Write-ID-Prüfung. Fehlender Draft ist
abgeschlossen; verlorene Bereinigungsantworten bleiben lesend klärbar. Ein anderer
Editorentwurf wird erhalten und als offene Arbeit ausgewiesen. Treffen zugleich
neuere lokale Eingaben ein, bleibt die Übernahme gesperrt; ausdrückliches
„Eingabe verwerfen“ lädt den gespeicherten Entwurf ohne dessen Löschung.
Nach `not-applied` endet die Statusprüfung, und eine weitere Übernahme ist eine
neue ausdrückliche Aktion auf der passend geprüften Basis. Historykonflikte
verlangen Standlesen statt eines automatischen zweiten Undo/Redo.

Neuere Beschriftungen bleiben bei bestätigter History oder Einzeländerung offen.
Der gespeicherte Quellstand wird nur bei unverändertem Formular neu geladen;
spätere GM-Prosa bleibt maßgeblich. Nach bestätigter Neuanlage wird nur deren noch
unveränderter Name geleert; ein bereits eingegebener nächster Name bleibt stehen.
Der bestehende DOM-/Storetest löst Statusklärung über den verbundenen Button aus
und prüft zusätzlich erhaltene/fremde Drafts, Klärungswiederholung, gleiche
Aktivierung nach Wiederöffnung und ausdrücklich fortsetzbare Konfliktbedienung.
Native Fokus-, IME-, Crash- und komplette Workspaceabnahmen bleiben offen.

## Herkunftsprüfung und Grenzen alter Kopien

Bereits mit falschen Historybesitzern erzeugte ältere Kopien sind damit nicht
rückwirkend repariert. `campaign_origin.original_database` enthält heute einen
kompakten Herkunftsvermerk mit Hash der angenommenen Datei, keine ursprüngliche
Datenbank. Seine `checksum` prüft nur diese Bytes; `local_map` ist dadurch nicht
gegen Umzuordnung abgesichert. Beim Weiterkopieren wird der Herkunftsvermerk für
den letzten Kopierschritt ersetzt. Er ist kein vollständiges Herkunftsarchiv.

`campaign-data.ts` prüft vor dem Remap den Hash der opaque Herkunftsbytes und die
Form von `local_map` als Objekt mit Stringwerten. `store.ts` verwendet denselben
Check für Preview, Annahme, Snapshot und Backup. Fehler ersetzen keine vorhandene
gute Ausgabedatei und verändern weder Quelle noch Zielkampagne. Gültige historische
Blobformate und freie Herkunftskennungen bleiben erhalten; keine Schemaänderung.
Die Prüfungen in `campaign-origin.test.ts` decken diese Grenzen und drei aufeinander-
folgende Kopien samt Paarhistory ab. Form- und Hashprüfung beweisen keine sachliche
Zuordnung der alten Notizen.

Eine spätere Altkopien-Wiederherstellung benötigt deshalb einen separat erhaltenen
Originalsnapshot, dessen Identität und die vollständige ID-Zuordnung unabhängig
bestätigt werden können. Der heutige Herkunftsvermerk allein reicht dafür nicht.
Vorher Originalbytes sichern; dann Original-/Kopienidentitäten, Historypayloads,
Receiptbindung und zwischenzeitliche Revisionen auf einer Arbeitskopie vergleichen.
Bei fehlendem Beleg bleibt die Reparatur offen. Keine Freitext-/Labelheuristik oder
stille Umschreibung möglicherweise absichtlich ungebundener Verweise. Eine
Reparaturabnahme muss mehrstufige Kopien, spätere Notizänderungen, Trash,
manipulierte Zuordnungen, gleiche Anzeigenamen und atomare Ablehnung einschließen.

## Offene Arbeit

- Native GM-Notiz und Ortsabschnitte: Auswahl, CRLF, IME, Wechsel A → B → A,
  Abbruch, Quelländerung und Recovery/Fresh mit Originalbytes vergleichen.
- Lange Quellen: Reader/Alias-SQL begrenzen auf 200 Verweise, der Graph auf
  40 Kanten. Überlauf sichtbar machen und spätere Treffer auffindbar halten.
  Vor Index-/Pagingänderungen echte Kampagnen messen.
- Quellintegrität: Neben geprüften Zielchecks auch Quell-Rowidentität, Revision
  und Papierkorb prüfen. Beschädigte Quellen als unbekannt ausweisen.
- Dieselben Autorenbytes durch NPC-Dossier, Ortsmappe, Liveentwurf,
  Spielabendmappe/Markdown und unabhängigen Export verfolgen. Native Closure
  und vollständige Portabilität bleiben separat abzunehmen.
- Komplexe Originaltexte und große Klammer-/Backtickfolgen prüfen; eine weitere
  Parserbibliothek oder Indexmigration braucht einen konkreten Nutzen.

Kontrollierte Store-/DOMtests prüfen Parser, Auswahl, Kopierziele und Teile der
Wiederaufnahme. Sie ersetzen keine native Editor-, Markdown- oder Produktabnahme.
Es gibt keine Schema-/Autorenmigration und keinen zweiten dauerhaften Graph.
Früher veränderte Kopien lassen sich ohne Original nicht automatisch reparieren.

Suche und eingehende Kanten berücksichtigen alle aktiven Textverweise. Begrenzte
Leser zeigen einen Hinweis auf weitere Ziele; einzelne beschädigte Quellen
werden als unvollständig gemeldet, gesunde Treffer bleiben erreichbar.

Die Ortsmappe zeigt Quellabschnitte, Textverweise, Karten und Material unabhängig
von der Gruppenantwort. Nur die Übergabe eines Abschnitts als Vorlesetext braucht
eine bestätigte Fokusgruppe. Eine fehlgeschlagene Gruppenabfrage meldet diesen
Teil lokal als nicht verfügbar; spätere Antworten eines verlassenen Ortes bleiben
wirkungslos. DOM-Gegenproben und ein nativer Tastaturlauf prüfen diese Grenze.

## Autorenabsicht vor und während der Übernahme

Der Zielread für Anlegen/Lösen eines Paars gehört zu genau einem geladenen
Quellkontext: Workspace, Dialogrequest, Detailrequest und Inhaltsobjekt.
Gleiche Quell-ID und gleicher Aktivierungstoken allein genügen nach erneutem
Öffnen nicht. Zielauswahl, Bezeichnungen, Paarmodus und Familientyp erhalten
eine lokale Änderungsgeneration. Ändert sie sich während des Zielreads,
entsteht kein Draft und kein Command; die neue Eingabe verlangt eine erneute
ausdrückliche Übernahme. Beide Beschriftungen und der Typ stammen aus der
ursprünglich bestätigten Eingabe, die Zielrevision aus deren geprüftem Read.

Entwurfsbestätigung und Einzel-/Paar-/Historywriter behalten denselben
Quellkontext über Drain, Persistenz und Antwort. Eine alte Antwort darf weder
Write-ID noch Prüfauftrag, Formular, Status oder Busyzustand eines neuen
Dialogaufrufs übernehmen. Der bereits gespeicherte Draft beziehungsweise
Receipt bleibt für dessen normale Wiederaufnahme erhalten. Reset wartet
nicht auf einen alten Draftcallback und gibt ihm keine neue Autorität.
Wiederholtes Bestätigen während der Entwurfs-/Zielprüfung ist gesperrt;
die Sperre endet erst nach dem eigenen Refresh oder passenden Fehler.

Neuere Eingaben während der eigentlichen Schreibantwort bleiben erhalten;
der unveränderte ursprüngliche Command wird nicht umgedeutet oder erneut
ausgeführt. Vor einer weiteren Übernahme muss die gespeicherte Basis gelesen
werden. Ein neu eingegebener nächster Inhaltsname wird vom Erfolg des vorherigen
Anlegeauftrags nicht geleert. Keine Schema-/Prosamigration und kein neuer Writer.
Die Store-/DOMgegenproben in `world-links-recovery.test.ts` halten Zielreads,
Draftantworten und Erfolge/Fehler der drei Writer kontrolliert zurück. Sie
prüfen tatsächliche SQLitewirkungen, neue Eingaben, gleiches Token beim
Wiederöffnen, wiederholtes Bestätigen und weiter bedienbare Erfolgsformulare.
Rebase, ausdrückliches Verwerfen und Moduswechsel haben weitere asynchrone
Fortsetzungen; diese sind damit nicht vollständig qualifiziert. Als nächster
Schritt sind dort dieselben Kontextwechsel samt bedingter Draftlöschung zu
prüfen. Native Fokus-/IME-/Crash- und vollständige Produktabnahmen bleiben offen.
