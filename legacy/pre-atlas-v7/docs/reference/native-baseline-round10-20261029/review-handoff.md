# Reviewübergabe, Plan 1, Runde 10

Dieser Stand ist ein transparenter Zwischenstand, keine vollständig behobene
native Regressionsgrundlage. Es gab genau einen Implementierer, keine weiteren
Agenten und keine Integration. Die native Schlussserie lief ausschließlich bei
100 Prozent im aktuellen Checkout; Fremdarbeit wurde nicht verworfen.

## Änderung und Zweck

- `tools/native-probes.mjs`: 165 Einstiegsskripte nach tatsächlichem Inhalt
  eingeordnet, CLI-/Umgebungsvarianten, Abhängigkeiten und zwei kontrollierte
  Fehlerinjektionen erfasst. Der aktive Katalog hat 217 Positionen einschließlich
  ausdrücklich nicht ausgeführter historischer Sonderfälle.
- `tools/native-baseline*.mjs` und bestehender Baseline-Einstieg: vollständiger
  serieller Modus mit getrennten Belegordnern, isolierten Profilen, bestehendem
  2/3-GiB-Ressourcenrahmen und `ui-session.py`. Unabhängige Fachfehler dürfen
  weiterlaufen; fehlender Besitzbeleg oder Quellen-/Buildwechsel stoppt.
  Vollständige Fachabschluss-, frische PNG-, Hash-, Renderer- und
  Prozessbelege sind Voraussetzung für einen positiven Ausgang.
- Probeadapter auf belegte aktuelle öffentliche Bedienwege, Quellenwahl,
  13 Materialkanäle und echte 100-Prozent-Fenster angepasst. Fachliche Assertions
  und Bildschwellen bleiben erhalten. Keine pauschale Timeoutverlängerung.
- Die offizielle Atlasreferenzwelt ergänzt fehlende aktuelle Presetfelder und
  richtet Payloadrevisionen auf die vorhandenen Zeilenrevisionen. 108.076
  Landschaftseinträge und kanonischer Backupcheck bestanden; 189 unbetroffene
  Tabellen identisch. Bildreferenzen nativ neu erzeugt und anschließend regulär
  geprüft; die alten Bilddateien sind unverändert bewahrt.
- Produktkorrekturen: Ein verspäteter Atlas-Öffnungsabschluss darf eine neuere
  Raumwahl nicht verwerfen. Ein identisches verspätetes Musikfeld-`change` darf
  einen bestätigten Autosave nicht nochmals speichern; ausdrückliche Eingaben
  einschließlich Korrektur eines abgewiesenen Entwurfs bleiben erhalten.
  Je drei gezielte Verhaltenstests sichern die betroffenen Fälle.
- `testing.md`, Ausgangs-/Schlusslisten und Ursachenberichte unterscheiden
  tatsächlichen Erfolg, technische Grenzen, nicht ausgeführte Fälle und noch
  ungeklärte erste Ursachen. 83 tatsächlich geprüfte Workflows sind mit ihren
  aktuellen Testdateilinks via `--geprueft` nachgeführt.

## Prüfung und Bindung

Der Schlusslauf vom 29.10.2026, 06:50:51 bis 11:21:31 UTC, ist an
`2005f9ed9906fb9fdbd79a15c325d63e2b29228a8c75ac8761e16c6bd2130865`
gebunden: 2.085 archivierte Quelldateien und zwanzig Desktopartefakte stimmen nach
Abschluss bytegenau mit Checkout bzw. privatem Paket überein. Node 22.19.0,
Electron 44.7.0, Linux x64, X11 `:0`; genaue Hostbindung in den lokalen Rohbelegen.

[Schlussliste](final-results.json): 129 bestanden, 80 fehlgeschlagen, ein
Negativfehler erkannt, sieben nicht ausgeführt. [Abschlussaudit](final-audit.json)
prüft alle 210 ausgeführten Aufrufe erneut. Alle eigenen Ressourcen sind entfernt,
alle aufgezeichneten Wächter abwesend. Die 129 positiven Belege erfüllen die
strengen Abschluss-/Hash-/100-Prozent-Regeln. E2E-01 besteht mit 19 Starts,
44 frischen Bildern, bestätigtem absichtlichem Absturz, Wiederaufnahme und
Export/Import. Beide Musikvarianten, Raumgrundlauf und drei Paketupdatevarianten
bestehen; die später rote Raumregionsvariante bleibt separat offen.

Lokale Prüfbelege unter `.build/`:

- `native-baseline-round10-final-targeted-tests.log`: 43 gezielte Node-Prüfungen
  bestanden, vor der letzten begrenzten Musikänderung.
- `native-baseline-round10-music-correction-final-tests.log`: danach alle neun
  Editorinstanzprüfungen bestanden. Diese beiden Läufe sind keine einzelne
  gemeinsame 44er-Suite.
- `native-baseline-round10-controller-eight-negatives-20261029/`: acht tatsächliche
  Linux/Python-Controller-Negativproben bestanden, ohne Electron.
- `native-baseline-round10-new-reference-oracle-test.log`: Bildorakel einschließlich
  Wasser-/Flachwald-Negativfälle bestanden; separate Fixturevalidierung bestanden.
- `native-baseline-round10-final-repo-check.log`: abschließendes `check:repo`
  bestanden. `native-baseline-round10-check-final.log`,
  `native-baseline-round10-check-desktop-final.log` und
  `native-baseline-round10-review-format-check.log`: Typ-/Environment-, Desktop-
  und Formatprüfung bestanden. Private Paketvorbereitung und nativer Paketcheck
  sind keine Installation oder Veröffentlichung.

## Offene Punkte und konkrete Grenzen

[Fehlerkatalog](current-causes.json): 45 erste Ursachen eingeordnet (40 veraltete
Testannahmen, vier Umgebung/Harness, eine ungültige Fixture), bei 35 weiteren
roten Fällen erste Ursache noch offen. Jeder enthält Aufruf, Fehlerstelle,
Nutzerwirkung und vorhandenen Beleg. Die 26 historisch ungeklärten Fälle wurden
im Ausgang versucht; ein vergleichbarer historischer Gegenlauf fehlt, daher keine
historische Regressionsfreiheit behauptet.

Zwei konkrete Harnessfehler waren zum Übergabezeitpunkt offen: Der eigene neue Negativkatalog erwartet den
verkürzten statt tatsächlichen Prüfungsnamen der unterdrückten Folgegeste;
`npc-conversation` überschreibt frühere PNGs unter wiederholtem Dateinamen.
Der eingefrorene Schlussstand wurde deshalb nicht nachträglich geändert.
Beide kleinen Fehler wurden im [einmaligen Review](review-result.md) korrigiert;
dort sind die gezielte native Wiederprobe und die Wiederverwendung des bestehenden
Negativbelegs getrennt dokumentiert. Die Schlusszahlen oben bleiben historisch unverändert.

Fünf abhängige Notiz-/Quellenfälle bleiben nach rotem Vorgänger nicht ausgeführt,
ebenso der historische Reliefprototyp und CSS-Vergleich ohne frühere CSS.
Erzwungene SIGKILL-Enden und fehlende Aufnahmen in roten Fällen bleiben technische
Fehler. Die technisch grüne Mehrmaßstabs-Exportprobe erreicht das separate
Navigationsziel p95 33,3 ms nicht (beobachtet 1.200,5 ms).

Die spätere Einsammlung der äußeren Exec-Sitzung meldete Exit 143, obwohl der
Rohbericht zuvor alle Positionen geschlossen und den Abschluss geloggt hatte.
Die Ursache bleibt offen; [Supervisorbeleg](supervisor-postmortem.json) bestätigt
heutige Abwesenheit, behauptet aber keinen regulären äußeren Shellabschluss.

Vollständige Rohbelege, Quellarchive, PNGs und privates Paket bleiben lokal unter
`.build/`. Candidate-CI, vollständige Zielgerätequalifikation und Ownerabnahme
bleiben eigene Gates. Kein Commit, keine PR, keine Integration und keine
Veröffentlichung wurden vorgenommen. Dieser Stand ist zur einmaligen Prüfung
bereit; die insgesamt vollständige Behebung wird nicht beansprucht.
