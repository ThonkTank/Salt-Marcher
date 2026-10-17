# Doppelte NSC-Notizen gemeinsam bereinigen

Fall 22, vollständige reale GM-Aufgabe in SaltMarcher und Obsidian 1.14.4.
Zwei Nera-Notizen widersprechen sich beim Sold; die ältere Quelle enthält die
zusätzliche Nebelregel. Ein verbleibendes Original, nachvollziehbare Redaktion,
beide Räume und beide Besuche des vorhandenen Plans müssen anschließend
zusammenpassen. Die frühere Quelle bleibt wiederherstellbar. Nach normalem
Schließen muss dieselbe Nera weiterbearbeitbar sein und die Ergänzung aus beiden
Besuchen gelesen werden können.

## Beobachtung und Änderung

Der [passende eigene Ausgang und tatsächliche Obsidian-Vergleich](../note-room-plan-return-20261017/README.md)
zeigten den größeren Unterschied: SaltMarcher erforderte einzelne Lösch- und
Hinzufügehandlungen am Raum und Besuch. Obsidian stellte durch „Merge entire
file with…“, Auswahl des Originals, „Merge“ und „Just once“ tatsächlich zwei
Links in zwei Dateien um und erhielt die alte Datei bytegenau im Papierkorb.
Die Aussagen zum Sold und die örtliche Raumprosa mussten in beiden Abläufen
redaktionell geklärt werden. Die vorherige Rückwegkorrektur allein löste die
verteilte Verweisarbeit noch nicht.

„NSC-Notizen zusammenführen…“ zeigt jetzt Quelle, verbleibendes Original, beide
Originaltexte, vorgeschlagene öffentliche/private Texte und betroffene aktuelle
Verweisstellen. Erst nach Textprüfung und ausdrücklicher Bestätigung werden
Notiz, unterstützte Verweise und Quellablage gemeinsam gespeichert. Der
verbleibende Eintrag behält seine ID. Die vollständigen Quelltexte bleiben im
Papierkorb lesbar und wiederherstellbar; der Zieltext wird anschließend geöffnet.
Ein lokaler redaktioneller Entwurf kann geschlossen und wiederaufgenommen werden.

Beide Revisionen und ein Manifest der aktuellen Verweisstellen begrenzen den
Auftrag. Veränderte oder hinzugekommene Verweise erfordern eine neue Vorschau.
Die bestehenden Writer ändern Notizen/Orte, Key-Inhalte samt History und
Besuchsquellen innerhalb einer Transaktion. Ein später Fehler rollt alle
Teile einschließlich Receipts zurück. Gesicherte unklare Aufträge werden
abgefragt; sie werden nicht automatisch erneut gesendet.

Der erste native Nachlauf fand nach erfolgreicher Umstellung einen weiteren
Fehler: Ein später geladener Raumtreffer zog nach Raum → Plan → Notiz den
Ausschnitt vom Notizanfang weg. Der [unterbrochene Nachweis](first-native-attempt.json)
bleibt erhalten. Bei der Rückkehr zum Original lädt die Raumliste jetzt ohne
eigenen Fokus-/Scrollwechsel nach. Ihre bisherige selbständige Wiederherstellung
mit Seiten und Tastaturfokus bleibt verfügbar und ist weiter geprüft.

## Ergebnis und getrennte Nachweise

- [Vollständiges natives Ergebnis](result.json), Produktquelle
  `81d9a0f09318dd30f45e242c6ac589770ee4c804`, fünf Buildhashes;
  Start am sauberen Arbeitsbaum, dieselben unveränderten Produktdateien bei der
  Fortsetzung. Eine Bestätigung, automatische Wachstuben-/Besuchsumstellung,
  redaktionelle Raumkorrektur, beide Besuche, sichtbare Rückkehr, reguläres
  Schließen, Fresh und weitere Eingabe am selben Original bestanden.
- Nach Fresh versuchte der Helfer am bereits letzten Besuch nochmals „Weiter“.
  Dieser [Navigationsfehler des Helfers](failure.json) ist getrennt erhalten.
  Die Aufgabe wurde im selben Profil fortgesetzt: beide bestehenden Besuche
  ausdrücklich ausgewählt und die gespeicherte Ergänzung gelesen. Keine weitere
  Zusammenführung und keine doppelte Textänderung. Drei normale Exits 0,
  kein Signal, alle eigenen Hauptprozess-PIDs abwesend, keine UI-Fehler.
- Abschließend beide Raum- und Besuchsverweise mit derselben kanonischen ID
  geprüft. Alte Nera-Texte, Tarek, Hinweisquelle und ursprüngliche CRLF-Raumabschnitte
  exakt erhalten. Die Quelldaten wurden erst nach Schließen aller Writer geprüft.
- Lokal: 171 betroffene Speicher-/UI-/Vorbereitungs-/Notizkontexttests bestanden.
  Danach je eine zusätzliche Export-/Import-, verspätete Vorschau- und beschädigte
  Auftragsregression bestanden. Nach dem nativen Rückwegfund alle elf
  Raumverweis-DOM-Tests bestanden, darunter die neue verspätete Fokusregression.
  Beide Typprüfungen, Repository-Prüfung und Desktop-Build bestanden.
  Transaktionsrollback, stale Vorschau, Replay/lost ack, Entwurfserhalt,
  Profil-/Familienblockade, unabhängiges Backup und Import sind technische Belege.
- Reproduktion: `npm run build:desktop`, dann
  `node tools/test-desktop-note-merge.mjs --out=/tmp/npc-merge-check`.
  Der Helfer wählt nach Fresh beide Besuche anhand ihrer bestehenden IDs.
- Exakte Kandidaten-CI, SQUASH-Main-Integration und native Prüfung des tatsächlichen
  Main werden separat im Chat-Checkpoint dokumentiert. Dieser Bericht ersetzt
  weder menschliche Abnahme noch Paket-/Installationsabnahme.

## Begrenzung

Die Aktion führt NSC-Wissensnotizen zusammen. Ein eigenes Profil, eine laufende
Figur, Standort-/Gebäudebindung, andere Kreatur oder typisierte Familienpaare an
der Quelle verhindern die Zusammenführung, bis diese Identitäten getrennt
geklärt sind. Betroffene offene Notiz-/Ortsentwürfe bleiben erhalten und sperren
den Vorgang. Dies ist keine automatische Zusammenlegung laufender Figuren.

Unterstützt sind ausdrückliche NSC-Keyverweise und aktuelle Besuchsquellen sowie
freie Notizbeziehungen und deklarierte Textverweise in Notizen und Ortsabschnitten.
Wörtliche Erwähnungen und Code bleiben wörtlich. Historische Aufzeichnungen
behalten die alte Identität mit lesbarer archivierter Quelle. Widersprüche und
örtliche Raumprosa werden weiterhin bewusst redigiert. Große Kampagnen,
physische IME-Eingabe und menschliche Bedienpräferenzen sind nicht belegt.

![Beide Originale und die betroffenen Verweise](both-originals-and-affected-references.png)

![Nach Raum und Plan bleibt das Original sichtbar](canonical-note-after-room-plan-return.png)

![Nach Fresh: Ergänzung im Torhallenbesuch](fresh-both-visits-Torhalle.png)

![Dieselbe Ergänzung im Wachstubenbesuch](fresh-both-visits-Wachstube.png)
