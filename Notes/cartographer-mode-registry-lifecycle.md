# Cartographer Mode Registry Lifecycle – Investigation Log

## Ausgangspunkt
- Moduswechsel *Travel → Editor → Travel* löst im Ist-Zustand eine Exception aus: Travel-`onExit` erhält kein `CartographerModeLifecycleContext`, versucht dennoch sofort `ctx.signal` zu lesen und wirft dadurch eine `TypeError`-Meldung ("Cannot read properties of undefined (reading 'signal')").【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L191-L195】
- Die Fehlerursache wurde reproduzierbar gemacht, indem der Mode-Registry-Snapshot mit einem Test-Provider versehen wurde, dessen `onExit` explizit ein fehlendes `AbortSignal` meldet. Der Test bestätigt, dass das Registry-Wrappping den Lifecycle-Kontext beim Exit verwirft.【a814db†L1-L9】

## Beobachtetes Verhalten & Auswirkungen
- Sobald Travel aktiv ist und zu Editor gewechselt wird, ruft der Presenter `previous.onExit(exitCtx)` auf, wobei `exitCtx` ein frischer Lifecycle-Kontext samt `AbortSignal` ist.【F:salt-marcher/src/apps/cartographer/presenter.ts†L272-L409】
- Das Registry-Wrapping `createLazyModeWrapper` ignoriert den Kontext vollständig und ruft den echten Mode ohne Argumente auf (`mode.onExit()`).【F:salt-marcher/src/apps/cartographer/mode-registry/registry.ts†L149-L168】
- Travel-, Editor- und Inspector-Modi erwarten in `onExit` zwingend ein gültiges `AbortSignal`, um Aufräumarbeiten deterministisch zu stoppen (z. B. Abbruch laufender Async-Vorgänge, Entfernen von UI-Knoten).【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L191-L195】【F:salt-marcher/src/apps/cartographer/modes/editor.ts†L151-L170】【F:salt-marcher/src/apps/cartographer/modes/inspector.ts†L176-L182】
- Folge: `onExit` bricht vorzeitig ab, die anschließenden Cleanup-Routinen (Sidebar/Layer-Teardown, Event-Handler abklemmen, Playback stoppen) laufen nicht. Dadurch bleiben Travel-spezifische Artefakte aktiv, obwohl Editor bereits montiert wird.

## Aufrufpfad Travel → Editor → Travel (vereinfacht)
1. Shell `ModeRegistry` meldet den Wechsel (`onSelect`), der Presenter ruft `setMode` mit dem gewählten Mode-Id auf.【F:salt-marcher/src/apps/cartographer/presenter.ts†L272-L280】
2. `executeModeTransition` erzeugt ein neues `AbortController`, erstellt `exitCtx` mit `createLifecycleContext` und übergibt es an den bisher aktiven Mode (`previous.onExit(exitCtx)`).【F:salt-marcher/src/apps/cartographer/presenter.ts†L362-L409】
3. Beim Travel-Wrap (`createLazyModeWrapper`) wird `onExit` ohne Parameter delegiert, sodass der echte Modus kein `ctx` erhält.【F:salt-marcher/src/apps/cartographer/mode-registry/registry.ts†L149-L168】
4. Travel bricht mit `TypeError` ab, Presenter protokolliert `[cartographer] mode exit failed`, markiert den Mode als nicht mehr aktiv und fährt mit Editor-`onEnter` fort – Travel-Aufräumarbeiten laufen jedoch nicht.
5. Beim Rückwechsel zu Travel (`Editor → Travel`) existieren noch Travel-spezifische DOM/Domain-Objekte aus Schritt 1, wodurch inkonsistente Zustände oder doppelte Listener auftreten.

## Betroffene Hooks & Komponenten
- **Travel Mode (`travel-guide.ts`)** – benötigt `ctx.signal`, um `abortLifecycle()` deterministisch abzuwickeln.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L191-L195】
- **Editor Mode (`editor.ts`)** – nutzt `ctx.signal`, um Panel/Tool-State konsistent zu räumen.【F:salt-marcher/src/apps/cartographer/modes/editor.ts†L151-L170】
- **Inspector Mode (`inspector.ts`)** – setzt `lifecycleSignal = ctx.signal` für Save-Timer und UI-Reset.【F:salt-marcher/src/apps/cartographer/modes/inspector.ts†L176-L182】
- Damit sind alle Core-Modi betroffen, sobald sie über die Registry geladen werden.

## Erste Hypothesen & nächste Schritte
1. **Lifecycle-Kontext korrekt durchreichen** – `createLazyModeWrapper` muss `onExit(ctx)` deklarieren und den erhaltenen Kontext weiterreichen (`mode.onExit(ctx)`). Zusätzlich sollten Typannotationen verschärft werden (kein bivariantes Matching), um solche Fehler zukünftig vom Type-Checker erkennen zu lassen.【F:salt-marcher/src/apps/cartographer/mode-registry/registry.ts†L149-L168】
2. **Begleitende Regressionstests** – ein Vitest-Szenario, das `CartographerPresenter` mit Registry-Modes initialisiert und Travel→Editor→Travel durchspielt, sollte sicherstellen, dass `AbortSignal` propagiert und kein Cleanup übersprungen wird. Der aktuelle Repro-Test kann als Vorlage dienen.【a814db†L1-L9】
3. **Audit weiterer Hooks** – prüfen, ob andere Lifecycle-Methoden in `createLazyModeWrapper` ebenfalls optionale Parameter verlieren (z. B. optionale Events), und ob zusätzliche Metadaten (Provider-ID vs. Mode-ID) unbeabsichtigte Nebenwirkungen verursachen.

## Offene Fragen für die Fix-Implementierung
- Soll das Registry-Wrapping generell alle Methoden-Signaturen exakt spiegeln (evtl. mittels generischer Wrapper), um künftige Divergenzen zu verhindern?
- Müssen bestehende Add-on-Provider (falls vorhanden) migriert werden, sobald `onExit` wieder `ctx` erwartet, oder war das Verhalten bisher ohnehin unbenutzbar?
- Reicht das Durchreichen des `AbortSignal`, oder müssen wir zusätzlich sicherstellen, dass `CartographerPresenter` bei Exceptions die Lifecycle-Controller sauber zurücksetzt (damit Folgemodi nicht mit bereits abgebrochenen Signalen starten)?

> **Status:** Analyse abgeschlossen, Fix TBD. Diese Notiz dient als Referenz für die kommende Reparatur-Aufgabe.
