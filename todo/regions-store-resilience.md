# Regions store resilience

## Kontext
Das Core-Modul [`regions-store.ts`](../salt-marcher/src/core/regions-store.ts) verwaltet `SaltMarcher/Regions.md`. Beim Löschen der Datei wird aktuell nur ein Konsolen-Warnhinweis ausgegeben (vgl. [Regions Store Overview](../salt-marcher/docs/core/regions-store-overview.md)), aber kein Neuaufbau ausgelöst.

## Reproduktionsschritte
1. `SaltMarcher/Regions.md` in einem Test-Vault löschen.
2. Beobachten, dass die Konsole den Hinweis `Salt Marcher regions store detected Regions.md deletion; the file is not auto-recreated and must be restored manually.` protokolliert.
3. Öffnet man die Regionen-Ansicht ohne vorheriges `loadRegions`, bleibt die Liste leer, bis der Nutzer die Datei manuell wiederherstellt.

## Risiken
- Temporärer Verlust der Regionsdaten inklusive YAML-Frontmatter.
- UI-States bleiben leer, ohne Nutzer:innen auf den Datenverlust hinzuweisen.
- Kein automatisierter Test verhindert Regressionen in diesem Bereich.

## Handlungsoptionen
- **Neuaufbau automatisieren:** Im Delete-Handler `ensureRegionsFile` anstoßen und Standardinhalt sofort wiederherstellen.
- **Events entprellen:** Modify/Delete-Paare bündeln, bevor `salt:regions-updated` gesendet wird.
- **Tests ergänzen:** Einen Vault-Mock schreiben, der Lösch- und Neuaufbaupfade abdeckt.
- **User Feedback verbessern:** Zusätzlich zur Konsole einen Workspace-Notice oder Dialog anzeigen.

## Nächste Schritte
Priorisierung im Core-Team klären und Umsetzung in einem eigenen Branch bündeln, damit Tests und File-Recovery gemeinsam ausgeliefert werden können.
