# Cartographer mode registry

## Original Finding
> Die Modi werden im Presenter über `provideModes` fest verdrahtet (`createTravelGuideMode`, `createEditorMode`, `createInspectorMode`). Erweiterungen oder Konfigurationen erfordern weiterhin Codeänderungen statt deklarativer Registrierung.
>
> **Empfohlene Maßnahme:** Eine deklarative Registry/API für `provideModes` einführen, damit zusätzliche Modi ohne Core-Änderung ladbar sind.

Quelle: [`architecture-critique.md`](../architecture-critique.md).

## Kontext
- **Betroffene Module:** `salt-marcher/src/apps/cartographer/presenter.ts`, Mode-Fabriken unter `salt-marcher/src/apps/cartographer/modes/`.
- **Auswirkung:** Neue Modi oder Varianten benötigen invasive Änderungen am Presenter und riskieren Merge-Konflikte.
- **Risiko:** Fehlende Erweiterbarkeit blockiert Experimentier-Features und erschwert das Aktivieren/Deaktivieren einzelner Modi.

## Lösungsansätze
1. Extrahiere eine Registry-Schnittstelle (`ModeDefinition[]` + Resolver), die Presenter und Modes über Abhängigkeiten verbindet.
2. Erlaube deklarative Konfiguration (z. B. JSON/Frontmatter oder Plugin-Settings), welche Modi geladen werden und mit welchen Capabilities.
3. Dokumentiere das Registrierungsprotokoll im Cartographer-Docs-Ordner und ergänze Tests, die dynamische Mode-Lieferanten validieren.

## Referenzen
- Presenter `provideModes`: [`salt-marcher/src/apps/cartographer/presenter.ts`](../salt-marcher/src/apps/cartographer/presenter.ts)
- Mode-Fabriken: [`salt-marcher/src/apps/cartographer/modes/`](../salt-marcher/src/apps/cartographer/modes/)
