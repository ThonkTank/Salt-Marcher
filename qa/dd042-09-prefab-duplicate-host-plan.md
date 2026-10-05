# DD-042.09: doppelter Vorlagenname im selben Set

**Status:** Host-Szenario vorbereitet, nicht grafisch ausgeführt. Keine
Produkt-, Vault- oder Acceptance-Änderung.

## Originalregel

`/home/aaron/.cache/dungeon-native-qa/evidence/native-prefab-set-management.json`
protokolliert Dungeondraft 1.2.0.1: Licht auswählen, Make Prefab,
„Codex set probe“ über Set-Plus anlegen, „Codex probe light“ speichern,
danach im gleichen Set denselben Vorlagennamen erneut bestätigen. Das
Original lehnte den Duplikatnamen ab. Die erste native Vorlagendatei wurde
als `native-prefab-set-created.dungeondraft_prefab` mit SHA-256
`022470aaeddf05627dcaa095473b1471fe7399b676f43a94b69314534a735576`
gesichert. Ein direkter Bytevergleich dieser Datei **nach** dem nativen
Duplikatversuch ist dort nicht protokolliert; „Datei unverändert“ ist deshalb
für das Original noch keine separat belegte Teilwirkung.

## Szenario und Einbindung

`tools/groups/scenarios/objekte-07.cjs` ist ein eigenständiger Einstieg für
den bestehenden `tools/host-test.cjs --group objekte-07`-Runner. Er meldet
nur DD-042.09; die übrigen 22 Gruppenfälle bleiben über `group-record`
ausdrücklich offen. Import allein startet keine Grafik.

In einem isolierten QA-Vault erstellt der Editlauf eine neue Karte mit einer
Lichtquelle, wählt sie über das Auswahlwerkzeug und speichert sie per
sichtbarem „Vorlage erstellen“-Dialog als neue Sammlung/Vorlage. Danach
werden Katalog und Plugindatei `data.json` sowie Karte und Session-History
festgehalten. Derselbe Dialog versucht denselben Namen im selben Set
erneut. Erwartet werden ein Ablehnungshinweis, weiterhin genau eine
Vorlage, dieselbe Definition und **bytegleiche** Plugin-/Kartendateien;
auch Dokument, Auswahl und History dürfen sich nicht ändern. Der getrennte
Reopenlauf prüft genau eine Definition, gleiches Dokument und beide
Prüfsummen nach einem neuen Obsidian-Prozess.

Belege werden im jeweiligen Hostlauf unter `dd04209-edit.json`, den
Dialog-/Ergebnisscreenshots und `dd04209-reopen.json` geschrieben. Der
phasenübergreifende Prüfstand liegt unter
`objekte-07-dd04209-saved.json` im externen QA-Verzeichnis. Der Koordinator
integriert nur diese Szenariodatei und führt Edit/Reopen exklusiv aus.

## Grenzen

- Die Originalprobe belegt **identische** Namen im selben Set. Ob
  Groß-/Kleinschreibung oder Leerzeichenvarianten ebenfalls abgelehnt
  werden, ist originalseitig offen. Der Editor lehnt solche Varianten
  teilweise bereits ab; dieser Hostfall behauptet dafür keine Parität.
- Eine vom Editor gespeicherte Vorlage liegt in Plugin-`data.json`, keine
  `.dungeondraft_prefab`-Datei. Das eigene Speicherformat ist gemäß
  Produktziel zulässig; geprüft wird die gleiche funktionale
  Duplikatwirkung und unveränderte bestehende Definition.
- Vor Ausführung sind nur Syntax und Manifestzuordnung geprüft. Ein
  `pass` im Szenario wäre erst ein Hostbeleg für den Kandidatenbuild, keine
  Abnahme des installierten Endstands.
