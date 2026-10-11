# Beitragen

Gemeinsamer Integrationsbranch: `active/installed-phase1`. Node.js 22 und npm verwenden; Repositoryzugang ist erforderlich.

## Fachliche Quellen

[Dokumentationsindex](docs/INDEX.md) und [Atlasübersicht](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) führen zu den fachlichen Quellen. [AGENTS.md](AGENTS.md) enthält die Arbeitsgrenzen.

## Lokal prüfen

```bash
npm ci
npm run check:repo
npm run check
npm test
npm run build
```

Für tatsächliche Hostprüfungen einen isolierten Testvault verwenden. [Campaign-B-Fixture](docs/CONTRIBUTOR-FIXTURE-B.md) beschreibt vorhandene synthetische Testdaten. Build, Veröffentlichung und Installation sind getrennte Schritte.
