# Erweiterungen: Installation und Wiederaufnahme

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: extensions
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 20.10.2026. Ergänzt [SMR-10](../../project/requirements/product-scope-2.md#smr-10--zweites-display-extensions-und-vollständige-portabilität)
und den [Gesamtumfang](../../project/requirements/scope.md). Grundlage: Program Capabilities L754–773,
Revision `9de85c1a26f526acbc1af332ac5962e185c0aab2`, SHA-256
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.

## Aktueller Ablauf und Integritätsgrenze

Über **Einstellungen → Erweiterungen** wählt die GM ein Paket und bestätigt
seine benannten Rechte ausdrücklich. Dafür muss keine Kampagne geöffnet werden.
Der Einstieg bleibt bei einem laufenden Generatorpreset-Read erreichbar; die
Erweiterungsverwaltung prüft ihre eigenen offenen Aufträge und Recoveryzustände.
Pakete ohne angeforderte Rechte werden so bezeichnet. Nach erfolgtem Widerruf
entfällt die wirkungslose erneute Widerrufsaktion; Entfernen bleibt möglich.
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
Nach vollständig gelesenem aktuellem Installationsstand kann die GM einen beschädigten Vermerk
zurücksetzen: der exakte Originalstring bleibt unter
`extension-damaged-write:<uuid>` erhalten. Erst danach wird der aktive Vermerk
entfernt; ein erneuter Read muss das Entfernen bestätigen. Änderungen zwischen Read und Reset werden abgewiesen; Speicherfehler
lassen die Sperre bestehen. Ein gültiger unbekannter Command darf nicht so
zurückgesetzt werden. Kein DBwrite, Grantwechsel oder stilles Löschen;
Quarantäne gehört weder in Campaigntransfer noch in Packagecode.

[desktop-extension-recovery.test.mjs](../../../tests/workspace/desktop-extension-recovery.test.mjs)
prüft diese zehn Store-/DOMfälle einschließlich Originalerhalt, Storagefehlern,
fehlender Liste, verändertem Vermerk und Receiptbestätigung ohne Writerreplay.
`python tools/ui-session.py node tools/test-desktop-extension-install.mjs` prüft
den vollständigen Paketweg bei 100 Prozent Browserzoom: fehlerhaftes Paket,
explizite Zustimmung, nach dem tatsächlichen Commit unterbrochene Antwort,
Neustart und reine Ergebnisabfrage, Widerruf, Entfernen und Neuinstallation. Ein
ungeöffneter Kampagnen-Record und seine opaque Zusatzdaten bleiben unverändert.
Die Probe verwendet den gemeinsamen Sitzungshelfer, bindet zusätzlich das
Settings-Stylesheet und bestätigt normale Prozessenden, verschwundene PIDs,
Tastaturbedienung und Fokus-Rückgabe. Sie qualifiziert Paketverwaltung, keine
Ausführung des Paketcodes. Operativer Erweiterungszugriff und die vollständige
Rechteabnahme bleiben offen.

## Installation und Campaigndaten

Pakete bis 1 MiB und Grants liegen installationweit in `settings`; Widerruf
und Entfernen erhalten opaque `campaign_capability`-Bytes, Codec, Version und
Referenzhülle. Entfernen löscht Paketcode und Rechte. Fehlende Installation,
Campaigntransfer und spätere Neuinstallation dürfen Nutzerbytes nicht verlieren.
Vollständiges Backup prüft auch Installationseinträge; ein Campaignexport entfernt
diese Einträge und prüft seinen eigenen Datenstand nach der Abgrenzung.
Beschädigte fremde Installation darf ihn nicht blockieren.
[extension-lifecycle.test.ts (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/shared/core/extension-lifecycle.test.ts)
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
