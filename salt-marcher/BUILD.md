# Build-Leitfaden

## Kommandos
- `npm install`: installiert Dev-Abhängigkeiten für Bundler und Tests.
- `npm run build`: führt `esbuild.config.mjs` aus und erzeugt `main.js` im Plugin-Stamm.
- `npm test`: nutzt Vitest/Jsdom, um die gebündelte Oberfläche gegen Mocks zu prüfen.
- `npm run sync:todos`: sammelt Aufgaben aus allen `AGENTS.md`-Dateien und schreibt die priorisierte `TODO.md` im Reporoot.

## Targets
- `main.js`: Renderer-Bundle (CommonJS, Ziel `es2020`), externe Abhängigkeiten bleiben ungebündelt (`obsidian`, `electron`, `codemirror`).
- Statische Assets (`manifest.json`, `styles` in `src/app/css.ts`) werden unverändert mit ausgeliefert.

## Erweiterung
- Neue Bundles als zusätzliche `esbuild.build`-Aufrufe mit eigenem `entryPoints`/`outfile` ergänzen.
- Für Watch-/Rebuild-Szenarien `esbuild.context()` nutzen und den Kontext im Dev-Workflow starten.
- Jede Erweiterung muss die externen Module sowie die Zielplattform dokumentieren und im README/AGENTS verlinken.
