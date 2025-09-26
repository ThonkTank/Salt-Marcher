# UI terminology consistency

## Kontext
Style Guide und Developer-Dokumentation fordern englische UI-Terminologie, der gebündelte Build (`salt-marcher/main.js`) enthält jedoch noch deutsche Default-Strings aus Legacy-Flows. Gleiches gilt für einzelne Kommentare und Notices in `src/ui/*` sowie Command-Bezeichnungen in `src/app/main.ts`.

## Betroffene Module
- `salt-marcher/src/ui/*` – Map-Header, Manager, Dialoge, Search-Dropdown.
- `salt-marcher/src/apps/library/view.ts` – Library-Labels und Notices.
- `salt-marcher/src/app/main.ts` – Ribbon-Tooltips und Command-Palette-Einträge.
- Build-Artefakte in `salt-marcher/main.js`.

## Zielbild
Alle sichtbaren Texte und relevanten Kommentare liegen konsistent in Englisch vor. Die Release-Pipeline stellt sicher, dass `main.js` nach Textbereinigungen neu erzeugt wird und keine deutschen Fallbacks mehr enthält.

## Offene Schritte
1. Glossar finalisieren und im Style Guide referenzieren (ggf. `docs/ui/`-Ergänzung).
2. UI-Strings in den genannten Modulen vereinheitlichen und zentralisieren.
3. Build-Skript bzw. CI-Check ergänzen, der den Rebuild von `main.js` erzwingt und Artefakt-Drift prüft.
4. Tests/Checks ergänzen (`rg`-basierter String-Guard oder ESLint-Rule), damit deutschsprachige UI-Texte in `src/ui` und `main.js` auffallen.
5. Release-Checkliste aktualisieren, damit Terminologie-Review Teil jedes Deployments ist.

## Risiken & Hinweise
- Ohne automatisierten Check kann `main.js` weiterhin alte Strings enthalten, obwohl der Source Code bereinigt ist.
- Dokumentations- und Wiki-Teams müssen informiert werden, damit User-facing Guides dieselben Begriffe verwenden.
