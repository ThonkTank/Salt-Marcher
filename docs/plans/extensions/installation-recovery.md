# Erweiterungen: Installation und Wiederaufnahme

Stand: 14.10.2026. Ergänzt [SMR-10](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-10--zweites-display-extensions-und-vollständige-portabilität)
und den [Gesamtumfang](../../SCOPE.md). Grundlage: Program Capabilities L754–773,
Revision `9de85c1a26f526acbc1af332ac5962e185c0aab2`, SHA-256
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.

## Aktueller Ablauf und Integritätsgrenze

Die GM wählt ein Paket und bestätigt seine benannten Rechte ausdrücklich.
`checkedExtensionCommand` prüft Command-/Aktionsstruktur, Ticket, Hash,
Revision, Paketidentität und bekannte Rechte beim Read, Execute und Outcome.
Der Registrywriter prüft zusätzlich Ticket-/Bytebindung, exakte Zustimmung und
aktuelle Installation. Extrafelder dürfen auch kein bestehendes Receipt abrufen.

Ein unbekannter Writeausgang bleibt als `extension-pending-write` im lokalen
GMprofil erhalten und sperrt weitere Writes. „Ergebnis prüfen“ liest nur den
Outcome; kein automatischer Retry. Ein damaliges Receipt bestätigt den Auftrag,
keine heutige Grantgeneration. Die Liste liest den aktuellen Stand; frühere
Bestätigungen heben spätere Widerrufe nicht auf.

Ein beschädigter Vermerk oder ausgefallener Speicherread sperrt ebenfalls.
Nach erfolgreichem aktuellem Listenread kann die GM einen beschädigten Vermerk
zurücksetzen: der exakte Originalstring bleibt unter
`extension-damaged-write:<uuid>` erhalten. Erst danach wird der aktive Vermerk
entfernt. Änderungen zwischen Read und Reset werden abgewiesen; Speicherfehler
lassen die Sperre bestehen. Ein gültiger unbekannter Command darf nicht so
zurückgesetzt werden. Kein DBwrite, Grantwechsel oder stilles Löschen;
Quarantäne gehört weder in Campaigntransfer noch in Packagecode.

[desktop-extension-recovery.test.mjs](../../../tests/desktop-extension-recovery.test.mjs)
prüft diese zehn Store-/DOMfälle einschließlich Originalerhalt, Storagefehlern,
fehlender Liste, verändertem Vermerk und Receiptbestätigung ohne Writerreplay.
Native Restart-/Tastaturabnahme und operativer Erweiterungszugriff bleiben offen.

## Installation und Campaigndaten

Pakete bis 1 MiB und Grants liegen installationweit in `settings`; Widerruf
und Entfernen erhalten opaque `campaign_capability`-Bytes, Codec, Version und
Referenzhülle. Entfernen löscht Paketcode und Rechte. Fehlende Installation,
Campaigntransfer und spätere Neuinstallation dürfen Nutzerbytes nicht verlieren.
Vollständiges Backup prüft auch Installationseinträge; ein Campaignexport entfernt
diese Einträge und prüft seinen eigenen Datenstand nach der Abgrenzung.
Beschädigte fremde Installation darf ihn nicht blockieren.
[extension-lifecycle.test.ts](../../../tests/core/extension-lifecycle.test.ts)
prüft Entfernen/Neuinstallation, Byteerhalt, Import ohne Paket, fehlerhafte Commands
und erhaltene sichere Backups. Paketcode wird noch nicht ausgeführt; Sandbox,
Runtime-Masken und neue Consumer gehören zur folgenden Lieferung.

## Nächste konkrete Lieferung

Eine gespeicherte Wegnotiz mit dem bestehenden `campaign_capability`-/
Campaignownerregister verbinden: geschlossener Unitwert mit Package-/Codecbindung,
Bodyhash und benannten Ortsreferenzslots; eigene Revisionen für Draft und
bestätigte Unit. Anlegen, Ortsbindung ändern/lösen, Fresh und Copy sowie Byteerhalt
bei fehlendem Provider prüfen. Fehlendes Slotziel bleibt ausdrücklich ungelöst;
vorhandene opaque Bytes werden nicht durch Neuverhaschen nachträglich qualifiziert.

Erst danach den kleinen Broker an Sender, Campaigncontext, Packagehash und
aktuelle Grantgeneration binden. Widerruf vor Writerwirkung, A/B/A und fehlenden
Provider prüfen. GM-/Publiceingänge haben eigene Rechte; öffentliche
Providerresultate bleiben Vorschläge bis zur ausdrücklichen Playerfreigabe.
