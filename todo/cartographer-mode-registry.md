# Modi deklarativ registrieren

## Originalkritik
> Die Modi werden im Presenter über `provideModes` fest verdrahtet (`createTravelGuideMode`, `createEditorMode`, `createInspectorMode`). Erweiterungen oder Konfigurationen erfordern weiterhin Codeänderungen statt deklarativer Registrierung.【F:salt-marcher/src/apps/cartographer/presenter.ts†L60-L70】【F:salt-marcher/src/apps/cartographer/presenter.ts†L89-L94】

## Kontext
- Module: `salt-marcher/src/apps/cartographer/presenter.ts` (Mode-Verwaltung), `salt-marcher/src/apps/cartographer/modes/*` (Mode-Implementierungen).
- `provideModes` erzeugt eine starre Liste bekannter Modi und koppelt deren Erstellung eng an den Presenter.
- Neue Modi oder Varianten erfordern aktuell Änderungen an Presenter und Tests.

## Lösungsideen
- Eine deklarative Registry schaffen, die Modi über Konfigurationen oder Factories registriert.
- Presenter nur noch gegen ein Interface für Mode-Deskriptoren koppeln.
- Dokumentation erweitern (`salt-marcher/docs/cartographer/README.md` & `view-shell-overview.md`), um das neue Erweiterungsmodell zu beschreiben.
- Tests für Registrierungs-/Konfigurationspfade ergänzen, um dynamische Erweiterungen abzusichern.
