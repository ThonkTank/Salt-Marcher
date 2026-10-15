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
