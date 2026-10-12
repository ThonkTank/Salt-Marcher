# Agenteneinstieg

Den aktuellen Nutzerauftrag bearbeiten. Historische Pläne, Issues und Belege sind keine zusätzlichen Aufträge.

- [Produktziele](docs/PRODUCT.md), [Atlasübersicht](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) und [Dokumentationsindex](docs/INDEX.md) führen zu den betroffenen Fachanforderungen. Architekturentscheidungen stehen in [ARCHITECTURE.md](ARCHITECTURE.md), Anforderungen und Nachweise in `acceptance.json`.
- Kein Legacy-Support; Funktionsumfang und vereinbarte Originalvergleiche aus den Fachanforderungen erhalten.
- Vor Änderungen die betroffenen Dateien und den aktuellen gemeinsamen Branch `active/installed-phase1` prüfen. Fremde Arbeit, Karten, Kennungen, Links und Nutzertexte erhalten. Veröffentlichten Git-Verlauf nicht überschreiben.
- Produktänderungen mit `npm run check`, `npm test` und `npm run build` sowie passenden Regressionen prüfen; Dokumentationsverweise mit `npm run check:repo`.
- GUI-Prüfungen in einem isolierten Testvault ausführen. Produktive Vaults und fremde laufende Hosts schützen. Installation nur im ausdrücklich beauftragten Umfang.
- Integrierte Funktion, PR-Kandidat, Test, tatsächliche Host-/Originalabnahme und installierte Version getrennt benennen. Fehlende Nachweise bleiben offen. Historische absolute Belegpfade bestätigen keinen eigenen Zugriff.
