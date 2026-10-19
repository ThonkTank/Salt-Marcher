# Linux-Updates über GitHub Releases

SaltMarcher verwendet für Linux x64 signierte ZIP-Pakete der aktuellen
Kampagnenwerkstatt-Datenlinie. Die frühere SaltMarcher-Anwendung und deren
AppImages sind keine Updatequelle. Daten bleiben in `CampaignWorkbench` oder
im ausdrücklich gewählten `--data-dir`.

## Bedienung

Unter **Einstellungen → Updates** stehen installierte/verfügbare Version,
Änderungshinweise, letzte Prüfung und Downloadfortschritt. Automatische Suche
ist voreingestellt und erfolgt nach dem Start höchstens einmal täglich.
Sie lässt sich abschalten. Ein Hinweis unterbricht den Spielabend nicht.
Herunterladen und **Installieren und neu starten** sind getrennte Aktionen;
Schließen der App allein installiert kein Update. Offlinebetrieb bleibt möglich.

## Erste Installation

Ein veröffentlichtes Release enthält `SaltMarcher-VERSION-linux-x64.zip`,
`saltmarcher-update.json` und `saltmarcher-update.json.sig`. ZIP entpacken,
die beiden Manifestdateien daneben ablegen und `Installieren.sh` ausführen.
Fehlende Manifestdateien lädt das Skript vom passenden GitHub-Releasetag.
Es benötigt weder Node.js/npm noch Administratorrechte; Linux muss das
übliche `flock` aus util-linux bereitstellen.

Standardziel ist `~/.local/opt/saltmarcher`, der Desktopstarter verwendet
`current/Starten.sh`. Abweichende Ziele: `./Installieren.sh INSTALLATIONSORDNER
DATENORDNER`. Eine bestehende Anwendung zuerst regulär schließen.
Der Installer erhält vorhandene Versionsordner und sichert das vollständige
Datenprofil vor dem Wechsel. Sicherungen werden nicht automatisch gelöscht.

## Veröffentlichung

1. Version in `package.json` und `package-lock.json` erhöhen. Änderungen über
   einen Kandidaten mit grüner `Candidate · exact-SHA aggregate` integrieren.
2. Auf dem grünen Main-Commit den passenden `vVERSION`-Tag veröffentlichen.
3. `Linux release draft` prüft Tag, Version, Main-Zugehörigkeit und die grüne
   Baseline dieses exakten Commits. Es baut und signiert das Paket und führt
   eine native Updateprobe mit zwei isolierten Testversionen aus.
4. Den erzeugten GitHub-Releaseentwurf prüfen und ausdrücklich veröffentlichen.
   Vorhandene Releases werden nicht überschrieben. Fehlerkorrekturen benötigen
   eine neue Version.

Das Repositorysecret `SALTMARCHER_UPDATE_PRIVATE_KEY` enthält den Ed25519-
Privatschlüssel. Ausschließlich `resources/update-public-key.pem` wird verteilt.
Der Releaseworkflow prüft deren Zusammengehörigkeit. Den privaten Schlüssel
außerhalb des Repositories sichern. Ein Schlüsselwechsel benötigt eine mit
dem bisherigen Schlüssel ausgelieferte Vertrauensaktualisierung; einfaches
Ersetzen des Secrets würde vorhandene Installationen aussperren.

## Transaktion und Wiederherstellung

Main besitzt Netzwerk, Dateizugriff und Neustart; nur das Hauptfenster erhält
validierte Updateoperationen. Die Spieleranzeige erhält keine Updatefähigkeit.
Das signierte Manifest bindet Produkt, Datenlinie, Version, Commit, Plattform,
Archivgröße/-hash, Dateiverzeichnis-Hash und Datenformatgrenzen. Das Archiv wird
über sein zentrales Verzeichnis mit Größen- und Einzeldateihashes gelesen;
Links, Pfadausbrüche und zusätzliche Dateien werden abgewiesen.

Vor dem Wechsel schließt die Oberfläche ihre Bearbeitung über `leaveWorkspace`
ab. Ungespeicherte Generator-Presets müssen zuvor gespeichert oder ausdrücklich
verworfen werden. Main sperrt weitere Arbeit und wartet auf IPC-Aufträge, Sicherung und Worker.
Der separate Helfer wartet auf das Ende des alten Prozesses, hält Kernel-Sperren
für Installation und Profil und sichert das geschlossene Profil samt Medien.
Die neue Anwendung führt ihre echten Storemigrationen und vollständige
Datenbankvalidierung auf einer Kopie aus. Erst dann wird `current` umgeschaltet.

`.update-journal.json` dokumentiert Vorbereitung, fertige Sicherung, Prüfung,
Aktivierung, Erststart und Freigabe. Der Erststart bleibt unsichtbar, bis die
Oberfläche initialisiert ist und der Helfer die Freigabe dauerhaft bestätigt.
Fehler davor setzen Anwendung und Profil zurück; der fehlgeschlagene Datenstand
bleibt separat erhalten. Nach `committed` gibt es keine automatische Rücksetzung
späterer Nutzereingaben. `Starten.sh` nimmt unterbrochene Installationen wieder
auf. Bei unlesbarem Journal bleiben die Originale erhalten und der Start stoppt.

## Prüfwege und Grenzen

- `node --test tests/desktop-updates.test.mjs tests/desktop-update-ui.test.mjs`: Versions-/Signatur-/Archivprüfung,
  Releaseauswahl, Netzwerkfehler, getrennte Aktionen, Locks, Sicherung und
  Fehler sowie echte Prozessabbrüche an den Aktivierungsgrenzen.
- `node --test tests/desktop-preset-settings.test.mjs`: Ein ungespeichertes
  Generator-Preset verhindert den Übergang zu Updates und bleibt erhalten.
- `npm run package:desktop -- .build/update-native-base` und
  `node tools/test-desktop-updates.mjs .build/update-native-base`: zwei echte
  Linuxpakete, Bootstrap, UI-Download, Installation, Erststart und Erhalt von
  Kampagnen/Medien im eigenen Testprofil. Unter headless Linux mit `xvfb-run -a`.
  Testreleases verwenden einen separaten kurzlebigen Schlüssel und werden nicht
  veröffentlicht. Nachweise liegen in `.build/update-native-*`.

Windows, macOS, Vorschaukanäle, automatische Installation, Migration alter
SaltMarcher-Datenbanken und eine allgemeine Backupverwaltung gehören nicht zu
diesem Lieferumfang. Ein Update-Nachweis ist keine Gesamtproduktabnahme.
