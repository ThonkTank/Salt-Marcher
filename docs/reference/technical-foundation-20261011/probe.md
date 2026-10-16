# Isolierte Speicherprobe vom 11.10.2026

Nur Machbarkeit/Planungsbeleg, kein Produkt-PASS. [Rohresultat](storage-probe.json)
enthält alle 30 Einzelzeiten und drei SIGKILL-Ausgänge. Die Arbeit lief außerhalb
des Zielrepositories; alle Dateien lagen im Arbeitsordner dieser Untersuchung.

## Reproduktion

In einem frischen **Scratchordner**, nicht in einem Nutzerstore: den
[Quellanhang](storage-probe.mjs.txt) als `probe.mjs` ablegen und die dokumentierte
better-sqlite3-Version 13.0.3 unter Node 22.22.0 installieren. `node probe.mjs`
erzeugt ausschließlich `probe-data/` neben dem Script. Erneutes Ausführen
ersetzt dessen synthetische Tabellen/Dateien. Alle assert-Prüfungen müssen
bestehen. Softwareversionen, Hardware und Systemlast des neuen Laufs angeben;
die hier gespeicherten Zeiten sind keine portable Leistungsgarantie.

100.000 deterministische Records, ~40 MB JSON; 30 lokale SQLite-/Voll-JSON-
Änderungen, fsync/Rename beim JSONweg, WAL/FULL beim DBweg. Readset 256 Records.
Ein Child stirbt vor/in/nach einem gemeinsamen 3-Record-/Receiptcommit;
Neustart prüft vollständiges alt/neu und integrity_check. Stale Revision hat
keine Wirkung. Backup wird separat lesend geöffnet und auf 100.000 Records geprüft.

Grenzen: keine Shell/Renderer/Produktadapter, nur 30 Messpaare; kein RP-R/RP-L,
kein Stromverlust/ENOSPC/Medienfehler und kein optimierter Mehrrecord-Dateistore.
Der Quellanhang ist Untersuchungsevidenz, wird nicht vom Produktbuild verwendet.

## Einzelpayload-Corruption

[Quellanhang](payload-probe.mjs.txt) genauso als `payload-probe.mjs` im
Scratchordner ausführen. [Resultat](payload-probe.json): direkte einzelne
Bitänderung in gespeichertem Autoren-JSON; Payloadchecksum erkennt sie,
unbetroffener **nach dem Backup** geänderter Record bleibt aktuell. Nur die
unabhängige beschädigte Unit wird aus geprüftem Backup repariert; beschädigte
Originalbytes bleiben bytegleich gesichert. Das untersucht Payloadisolation,
keine beschädigte SQLite-Metadatenpage, gekoppelte Commandclosure oder
Angreifermanipulation von Payload und Hash zugleich.
