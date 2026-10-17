# Ältere und neuere Aussagen vor dem nächsten Spielabend prüfen

Die GM-Aufgabe beginnt mit den sieben Originalnotizen und zwei Spielabendplänen
nach dem zweiten Grauen-Ufer-Protokoll. Siv behauptete zunächst, ihr Bruder sitze
im Leuchtturm fest; die zweite Nacht berichtet vom freiwilligen Weggang. Der neue
Schrank-Auftrag nennt eine Schatulle ausdrücklich nur als Vermutung. Beide
Aussagen werden anhand der Rohquellen geprüft, die Einordnung an den bestehenden
Originalen ergänzt und nach normalem Neustart über Inhaltssuche wiedergefunden.
Die alte und neue Abendmappe müssen die aktuellen Originale verwenden. Rohtexte,
Identitäten, Beziehungen und Plan-/Besuchsbindungen bleiben erhalten.

## Tatsächlicher Vergleich

- SaltMarcher-Ausgangsprobe auf sauberem Main
  `5b97917842800d7e7952277743aff303a611e357`: drei Quellenaufrufe ersetzen den
  Editor, drei Auszug-Rückverweise führen zurück. Beide Korrekturen, zwei normale
  Prozessenden mit Exit 0, Inhaltssuche und beide Abendverwendungen bestanden.
- Dieselbe Aufgabe tatsächlich in Obsidian 1.14.4, offizielles zuvor geprüftes
  AppImage SHA-256
  `6362ddbeeeebb7bbccb48fae009572cf2284ef92f5c919c1332aba48de6ffeaa`, eigener
  isolierter Vault mit gleichen Ausgangstexten, Quellenlinks und zwei bestehenden
  Abenddokumenten mit Live-Einbettungen. Strg-Hover zeigt die Rohquellen, ohne den
  aktuellen Editor zu ersetzen. Beide Korrekturen, tatsächlicher normaler
  Neustart, Inhaltssuche und beide Abendverwendungen bestanden. Die bearbeitete
  Siv-Datei erhielt LF statt ihres gemischten CRLF-Präfixes; Rohprotokolle,
  andere Dateien und Abenddokumente blieben bytegleich. Keine direkte Reparatur.
- Strg+Q beendete Obsidian hier nicht. Ein weiterer Start war nur eine
  Single-Instance-Weitergabe und zählt nicht als Fresh. Erst der sichtbare
  Fensterschließer beendete den ersten Prozess mit Exit 0; danach erfolgte der
  tatsächliche Neustart. Alle beobachteten Obsidian-Hauptprozesse endeten normal.
  Locator-/Transportfehler bleiben im Trace, keine erfundene Produktstörung.
- SaltMarchers bestehende Notizmappe wurde zusätzlich geprüft: Sie gruppiert die
  Texte bereits, wiederholt aber vor den Quellen das ganze aktuelle Original
  und enthält Sammel-/Vorbereitungsaktionen. Für die gezielte kurze Prüfung ist
  der direkte Einstieg in den vorhandenen Referenzleser die einfachere Ergänzung.

## Verbesserung und Wirkungsprüfung

`Ansehen…` an ausgehenden und eingehenden Beziehungen öffnet dieselbe kanonische
Quelle im vorhandenen Referenzleser. Der normale Editor, Inhaltssuche und
Textauswahl bleiben erhalten. Die bisherigen Navigationsaktionen bleiben
verfügbar; eingebettete Notizmappen-Editoren verwenden ihren bestehenden Leser.
Direkte Quellenaufrufe beginnen mit dem Dokument. Die Suche ist über
`Andere Quelle suchen…` erreichbar und wird erst dann ausgeführt. Keine zweite
Lesekomponente, neue Persistenz oder Migration.

Der erste vollständige native Wiederholungslauf bestand funktional, wurde aber
nach Sichtprüfung bei 200 % nicht als fertige UX angenommen: Die große Suchleiste
verdrängte den Quelltext. Daraufhin wurde der direkte Leseeinstieg ergänzt.
Die zweite vollständige native Wiederholung bei 200 % bestand einschließlich
vier Quellenprüfungen, erhaltener Editor-/Such-/Textauswahl, normalem Neustart,
Inhaltssuche und beider Abendverwendungen. Beide Prozesse endeten normal mit
Exit 0; keine UI-Fehler. Rohprotokolle, unveränderte Notizen, Originalpräfixe,
Beziehungen und beide Plan-/Besuchsbindungen wurden exakt geprüft. Sichtprüfung
zeigt die ältere Aussage direkt und die Schatullen-Vermutung nach Scrollen.
114 Kontextprüfungen und 13 Leserprüfungen bestanden. Eine fehlende
`select()`-Browserfunktion im DOM-Testdouble wurde ergänzt; der vorherige
fehlgeschlagene Lauf bleibt erhalten. Exakte Candidate-/Main-Qualifikation
sind separate Gates. Die Aufgabe bekommt keine behauptete menschliche
Verständlichkeits-, Paket- oder Gesamtproduktabnahme.

Lokale Belege im Chat-Arbeitsverzeichnis: `evidence/source-verification-own-before`,
`evidence/obsidian-case26`, `evidence/source-verification-own-map-before`,
`evidence/source-verification-own-after` (erster funktionaler Lauf, visuell
verworfen) und `evidence/source-verification-own-after-r2` (vollständig
wiederholt und visuell geprüft). `tools/test-desktop-note-source-inspection.mjs` wiederholt die ganze
GM-Aufgabe über native Fenster mit Klicks und Tastatureingaben; nur Ausgangsfixture
und nachträgliches Audit lesen SQLite direkt. Die Ausgangsfixture muss zuvor
vollständig und normal geschlossen worden sein.

Eine bestehende zusätzliche Leseprüfung aus dem vorigen Lauf wurde durch einen
Helferaufruf mit dessen Standard-Ausgabe versehentlich überschrieben. Die neue
Ausgabe liegt separat unter `evidence/source-verification-existing-reader-probe`;
der verlorene ergänzende Altbeleg wird nicht weiter beansprucht. Vollständige
frühere Candidate-/Main-GM-Proben bleiben erhalten.

Restgrenze: Die Quellenansicht liest das ganze aktuelle Original; direkte
Passagenanker und menschliche Bedienbelege werden dadurch nicht behauptet.
