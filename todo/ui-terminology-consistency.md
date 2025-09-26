# UI terminology consistency

## Status nach Review
Die UI-Schichten folgen inzwischen der dokumentierten Englisch-Policy: Copy ist in [`src/ui/copy.ts`](../salt-marcher/src/ui/copy.ts) zentralisiert, Map-/Modal-Module beziehen ihre Labels über diese Konstanten und die Sprache entspricht dem Glossar in [`docs/ui/terminology.md`](../salt-marcher/docs/ui/terminology.md). Der Style Guide dokumentiert die Vorgabe explizit und verweist auf das Glossar sowie die zentralen Copy-Objekte, sodass Reviewer:innen auf eine verbindliche Referenz zugreifen können. Zusätzlich stellt [`tests/ui/language-policy.test.ts`](../salt-marcher/tests/ui/language-policy.test.ts) sicher, dass neue deutschsprachige Zeichen in den überwachten Quelldateien auffallen.

Trotzdem liefert das gebündelte Plugin-Artefakt [`salt-marcher/main.js`](../salt-marcher/main.js) weiterhin veraltete deutsche Fallback-Strings (z. B. `"Speichern"`, `"Keine Karte ausgewählt."`). Die aktuelle Release-Pipeline führt offenbar keinen frischen `npm run build`-Durchlauf aus, nachdem die englische Copy in `src/` etabliert wurde. Dadurch entsteht erneut eine gemischte UI-Sprache, sobald das gebaute Artefakt ausgeliefert wird.

## Offene Risiken
- Laufende Releases transportieren weiterhin deutschsprachige Texte, obwohl der Quellcode korrigiert ist.
- Reviewer:innen verlassen sich auf das Glossar, sehen aber andere Labels im ausgelieferten Plugin.
- Language-Policy-Tests decken das Release-Artefakt nicht ab und bieten deshalb keine Regressionserkennung für `main.js`.

## Nächste Schritte
1. **Build-Artefakt erneuern:** Vor dem nächsten Release `npm run build` ausführen und das aktualisierte `main.js` einchecken, sodass alle Buttons/Notices die englische Copy verwenden.
2. **Release-Check verankern:** In der Release- oder CI-Checkliste festhalten, dass `npm run build` sowie die Language-Policy-Tests (`npm test`) obligatorisch sind. Ergänzend eine einfache Guard-Regel für `main.js` einführen (z. B. Skript oder Vitest-Suite, die deutschsprachige Umlaute im gebündelten Artefakt verbietet).
3. **Dokumentation synchronisieren:** In `docs/ui/README.md` und `style-guide.md` ist der Hinweis auf das Glossar bereits vorhanden; ergänzend sollte die Build-Checkliste im Dev-Dokumentationsbereich oder Release-Runbook aktualisiert werden, sobald der Guard existiert.

## Referenzen
- Glossar & Copy: [`docs/ui/terminology.md`](../salt-marcher/docs/ui/terminology.md), [`src/ui/copy.ts`](../salt-marcher/src/ui/copy.ts)
- Konsumenten mit englischer Copy: [`src/ui/map-header.ts`](../salt-marcher/src/ui/map-header.ts), [`src/ui/map-manager.ts`](../salt-marcher/src/ui/map-manager.ts), [`src/ui/modals.ts`](../salt-marcher/src/ui/modals.ts), [`src/apps/library/view.ts`](../salt-marcher/src/apps/library/view.ts), [`src/app/main.ts`](../salt-marcher/src/app/main.ts)
- Tests & Richtlinien: [`tests/ui/language-policy.test.ts`](../salt-marcher/tests/ui/language-policy.test.ts), [`style-guide.md`](../style-guide.md)
- Legacy-Artefakt mit deutschen Strings: [`salt-marcher/main.js`](../salt-marcher/main.js)
