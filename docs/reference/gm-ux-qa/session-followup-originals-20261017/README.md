# Zweites Protokoll an vorhandene Originale anhängen

## Tatsächliche Aufgabe und Ausgangsstand

Am ersten Abend entstanden Siv, die Bruderschaft, eine Quest und ein Gerücht aus
einem gemischten Rohprotokoll. Am zweiten Abend kommen neue Aussagen zu Siv und
der Bruderschaft sowie eine neue Quest hinzu. Beide Rohprotokolle, frühere
Aussagen, Originalidentitäten und der erste vorbereitete Besuch müssen erhalten
bleiben. Der nächste Abend verwendet dieselben Originale. Nach regulärem
Schließen und frischem Öffnen folgen drei Inhaltsabfragen, weitere Ergänzungen
und die erneute Verwendung im alten und neuen Abend.

Der vollständige Ausgangsablauf wurde auf SaltMarcher
`534177fe9acb8c36dd5bdeffed569f4b195dffed` und danach tatsächlich auf Kanka 3.15,
offizieller Quellstand `79d951798fead551dfbd60d293a6c4695c31c42d`, durchgeführt.
Eigene isolierte Kampagnen, reale Fenster/Klicks/Tastatur, persistente Profile
und normaler Fresh gehören zu beiden Nachweisen. Bei Kanka blieben die
bestehenden Entitäten 11/12 erhalten; Quelle 16, Quest 17 und Journal 18 kamen
hinzu. Journal 15 verwendet die fortgeschriebenen Originale weiterhin.

Auf SaltMarcher bot der Auszugsdialog nur die Anlage neuer Notizen. Der Versuch
wurde vor einer doppelten Anlage abgebrochen. Übernahme in bestehende Originale
brauchte Kopieren, Suche, datiertes Anhängen und eine Quellenbeziehung je Notiz.
Die Übersicht im Rohprotokoll brauchte zusätzlich zwei Rückverknüpfungen.
Kanka erforderte ebenfalls manuelles Kopieren/Anhängen; ein Beziehungsformular
konnte beide Herkunftsrichtungen gemeinsam anlegen. Seine Journal-Einbettungen
hielten alte und neue Verwendungen aktuell, erforderten jedoch die dokumentierte
Erwähnungssyntax samt Entitätskennung.

Die ersten Kanka-Eingaben verbanden im Testhelfer einmal Überschrift und Absatz.
Dies wurde über den sichtbaren Editor vor dem Einfrieren der Quelle korrigiert;
die endgültigen Originalabsätze wurden nach Fresh exakt verglichen. Fehlende
Iconfonts der lokalen Installation und dieser Helferfehler sind keine
Produktbefunde. Vergleichsdateien: `evidence/session-followup-own-before`,
`evidence/kanka-case25` und `evidence/session-followup-paired-result.json` im
zugehörigen Chat-Arbeitsverzeichnis.

## Zusammenhängende Änderung

Der Auszug findet vorhandene Originalnotizen nach Namen. Die Wahl ist
umfassend: Art und Identität stammen vom gewählten Original; dessen bisheriger
Text ist vor dem Anhängen einsehbar. Die unveränderliche Ergänzung zeigt den
Quelltitel im privaten GM-Feld. Öffentlicher Vorlesetext erhält ausschließlich
den markierten öffentlichen Wortlaut, keinen privaten Protokolltitel.

Der kanonische Writer prüft Quelle und Zielrevision, Auswahlbereich, Wortlaut,
Publikum, unveränderten alten Text und sämtliche Metadaten. Ergänzung,
Herkunft in beiden Richtungen, Suchindex und Belege werden gemeinsam geschrieben.
Vorhandene Herkunftskanten werden wiederverwendet. Alte Raum-/Besuchsreferenzen
bleiben an derselben Notizidentität. Ein gleicher Name erzeugt ohne ausdrückliche
Wahl einer getrennten neuen Identität keine zweite Notiz; die Prüfung liegt
auch am Writer, damit ein konkurrierendes neues Original berücksichtigt wird.

Unklare Antworten verwenden den bestehenden Auftragsstatus. Eine bestehende
Ergänzung wird samt vollständigem Auftrag gesichert und niemals als gewöhnlicher
Notizentwurf automatisch erneut gespeichert. Nach sicherem Nicht-Anwenden bleibt
der Wortlaut in der Quelle zur ausdrücklichen erneuten Übernahme. Zusätzliche
Eingaben über einem ungeklärten Auftrag bleiben zur manuellen Klärung erhalten.
Bei der gezielten Prüfung wurde eine veraltete Quellrevision nach verlorener
Antwort erkannt und behoben; der fehlgeschlagene Lauf bleibt als Nachweis erhalten.

## Prüfung und Grenzen

`tools/test-desktop-note-existing-excerpts.mjs` wiederholt dieselbe ganze Aufgabe
über die native Oberfläche auf einer Kopie des normal geschlossenen ersten
Abends. `GM_QA_START_RESULT` bezeichnet dessen Ergebnisdatei; `GM_QA_OUT` das
isolierte Nachweisverzeichnis, `GM_QA_ZOOM` die geprüfte Skalierung. Die Kopie ist
der Anfangsbestand; sämtliche Arbeit des zweiten Abends erfolgt über die UI.
Kanonische Daten werden ausschließlich zum abschließenden Lesen geprüft.

Lokale Prüfungen, tatsächlicher nativer Folgelauf, exakte Candidate-CI,
Main-Integration und die separate Main-Qualifikation werden im Checkpoint an
ihren jeweiligen Quellständen erfasst. Die Implementierung benötigt keine
SQL-Migration; der aktuelle Schemastand ist 46. Menschliche Vorlieben und
Paket-/Installationsabnahme sind durch diese Aufgaben nicht nachgewiesen.
