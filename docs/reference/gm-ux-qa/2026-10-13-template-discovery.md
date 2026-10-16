# Einzelne Geheimnisse aus verknüpften Vorlagen

## Problem und Vergleich

Im nativen Ausgangsstand 60 verriet „Für Gruppe sichtbar machen“ am Bronzeschlüssel zugleich die Fallentür. Beide Vorlagenkinder verwendeten die Verknüpfungskennung. Der private GM-Code blieb verborgen. Die Fixture entstand über öffentliche Corecommands; die Freigabe erfolgte im GMfenster und wurde im getrennten Spielerfenster gelesen ([Ausgangsdaten](2026-10-13-template-discovery-before.json)).

Der inzwischen veröffentlichte Integrationsstand enthält eindeutige, stabile Kindkennungen und einen GMhinweis für mehrdeutige alte Freigaben. Sein Speicherweg akzeptierte weiterhin nur ursprüngliche Blockkennungen: die gezielte Freigabe scheiterte. Dieser Abschluss verbindet den Speicherweg mit den dargestellten Abschnitten.

[Kanka dokumentiert eine Privatmarkierung je Property](https://docs.kanka.io/en/latest/features/properties.html#privacy); das unterstützt die Erwartung einer einzelnen Freigabe. Kanka wurde hier nicht mit einem eigenen Konto bedient; kein Geschwindigkeits- oder Paritätsnachweis. Markdown/Papier muss beim Vorlesen oder Übertragen eines einzelnen Absatzes ebenfalls den zweiten Absatz zurückhalten. Die gespeicherte Markdowngegenprobe überträgt nur die ausgewählte Prosa und erhält den GMtext. Sie ist Dateiarbeit, keine gemessene Editorbedienung. Ein menschlicher Zeitvergleich bleibt offen.

## Änderung

- Freigaben prüfen die aufgelösten Abschnitte des konkreten Raums beziehungsweise seiner beschriebenen Oberflächen; GMblöcke, rohe Vorlagenkennungen und Abschnitte anderer Räume werden abgewiesen.
- „Vorlage lösen – Inhalt behalten“ erhält die Abschnittskennungen und damit die bereits bestätigte Entdeckung.
- Abgeleitete Kennungen dürfen weder Autorenblöcke noch andere Vorlagenabschnitte bezeichnen. Read, Write und Backup prüfen diese Grenze; ein fehlerhafter Write rollt vollständig zurück.
- Mehrdeutige alte Freigabefakten bleiben gespeichert; ihre Geheimnisse werden bis zur einzelnen GMentscheidung nicht automatisch veröffentlicht.

## Ergebnis und Grenzen

118 betroffene Store-/DOM-/Playerregressionen bestanden; ein danach ergänzter Backup-Aliastest erhöht den fokussierten Satz auf sechs bestandene Tests. Desktop-Typecheck und Build bestanden. Die breite Regression enthält auch den großen Roombatch.

Die native Probe bestätigt einzelne Freigabe und Rücknahme, Raumwechsel ohne Übertragung der Entdeckung, Vorlagenlösung ohne Wissensverlust und echten Close/Neustart. Beide Starts und Closewege endeten normal mit Exit 0, ohne Pageerrors. Nach Neustart blieb nur die Fallentür sichtbar; Bronzeschlüssel und GM-Code fehlten ([Daten](2026-10-13-template-discovery-after.json), [Spielerbild](2026-10-13-template-discovery-restart.png)). Geschützte Legacyabsätze bleiben unverändert.

Alle schweren Jobs liefen über `codex-dungeon-job qa`: maximal 4 GiB, kein Swap, tatsächlich ein Node-Testworker. Electron versuchte zunächst einen eigenen Systemd-Scope anzulegen; diese Probe wurde abgebrochen und die eigene App geschlossen. Die finale Probe verwendet ausschließlich für die eigene App einen privaten DBusproxy mit Portal-/Notificationzugriff, der den Scopewechsel verhindert. GM-/Spieler-/Treiberprozesse blieben nachweislich im QAservice; Peak des vollständigen nativen Laufs: 798,7 MiB. Gemeinsame Codex-App und fremde Prozesse blieben unangetastet.

Reproduzierbare Probe im Repository; Linux mit installiertem `xdg-dbus-proxy`:

```sh
/home/aaron/.local/bin/codex-dungeon-job qa -- node tools/build-desktop.mjs
/home/aaron/.local/bin/codex-dungeon-job qa -- node --test --test-concurrency=1 tests/desktop-key-discovery.test.mjs
/home/aaron/.local/bin/codex-dungeon-job qa -- node tools/test-desktop-template-discovery.mjs
```

Der native Nachweis gilt für den untersuchten Linux-Integrationsstand und isolierte fiktive Campaigns. Andere Betriebssysteme, Portaldialoge, vollständige Recovery und ein Qualitätsvorsprung des Gesamtprodukts bleiben offen.
