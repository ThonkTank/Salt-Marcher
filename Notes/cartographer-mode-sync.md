# Cartographer Mode Sync – Analyseplan

## Ziel & Kontext
Diese Notiz dokumentiert den aktuellen Datenfluss zwischen Presenter, View-Shell und Mode-Registry des Cartographer-Tools. Fokus: Wann und wie `provideCartographerModes()` derzeit aufgerufen wird, welche Beobachtungs-/Registrierungs-APIs existieren und welche Integrationslücken eine saubere Synchronisierung externer Modi verhindern.

## Aktueller Aufrufpfad
1. **View-Initialisierung:** `CartographerView` erstellt im Konstruktor den Presenter und injiziert `provideModes`, das lediglich `provideCartographerModes()` ausführt (mit einfacher Fehlerbehandlung).【F:salt-marcher/src/apps/cartographer/index.ts†L10-L31】
2. **Registry-Snapshot:** `provideCartographerModes()` sorgt nur für das einmalige Registrieren der Kernprovider und liefert anschließend einen Snapshot der aktuell bekannten Modi zurück; es gibt keine Subscription oder Lazy-Updates jenseits dieses Funktionsaufrufs.【F:salt-marcher/src/apps/cartographer/mode-registry/index.ts†L17-L28】
3. **Presenter-Konstruktion:** Der Presenter speichert diesen Snapshot sofort in `this.modes` und hält ihn über die komplette Lebensdauer des View-Instanz offen; weitere Registry-Abfragen erfolgen nicht.【F:salt-marcher/src/apps/cartographer/presenter.ts†L119-L123】
4. **Shell-Bootstrap:** Beim `onOpen` des Presenters werden die gesnapshotteten Modi in `shellModes` übersetzt, einmalig an `createCartographerShell` übergeben und als statische UI-Grundlage gesetzt.【F:salt-marcher/src/apps/cartographer/presenter.ts†L134-L179】
5. **Mode-Wechsel:** `setMode()` wählt ausschließlich innerhalb von `this.modes` (d. h. dem Konstruktor-Snapshot) und interagiert nicht erneut mit der Registry.【F:salt-marcher/src/apps/cartographer/presenter.ts†L272-L280】

## View-Shell ↔ Mode-Registry Kopplung
- Die View-Shell verwaltet intern einen Mode-Status (Label, aktive ID, Liste) und stellt Methoden `setModes`, `registerMode`, `deregisterMode` bereit, die UI und internen State synchron halten würden.【F:salt-marcher/src/apps/cartographer/view-shell.ts†L62-L215】
- Diese Methoden werden jedoch nirgends vom Presenter aufgerufen; der Presenter kennt nur `this.shell` und nutzt aktuell lediglich `setModeActive`/`setModeLabel` für Auswahlfeedback.【F:salt-marcher/src/apps/cartographer/presenter.ts†L170-L177】【F:salt-marcher/src/apps/cartographer/presenter.ts†L272-L280】

## Registry-APIs & fehlende Ereignisse
- Öffentliche Registry-Funktionen erlauben `registerModeProvider`/`unregisterModeProvider`, erzeugen aber keine Events oder Observer-Hooks, die bestehende Konsumenten informieren würden.【F:salt-marcher/src/apps/cartographer/mode-registry/index.ts†L35-L49】
- Die interne Registry verwaltet Provider in einer Map, sortiert Snapshots und erzeugt Lazy-Wrappers – ebenfalls ohne Benachrichtigungsmechanismus oder Listener-Schnittstelle.【F:salt-marcher/src/apps/cartographer/mode-registry/registry.ts†L18-L108】

## Identifizierte Lücken & Risiken
1. **Statischer Snapshot:** Presenter/UI sehen nur den Registry-Zustand zum Zeitpunkt der View-Erstellung. Drittanbieter, die später registrieren, erscheinen nicht, bis der Nutzer die komplette View neu lädt.【F:salt-marcher/src/apps/cartographer/presenter.ts†L119-L179】
2. **Kein Deregister-Handling:** Entfernt ein Provider sich (z. B. Plugin-Deaktivierung), bleiben Presenter/Shell auf veralteten Mode-Einträgen sitzen. Potenziell ruft `setMode()` dann tote Mode-Instanzen auf oder zeigt UI-Optionen, die ins Leere laufen.【F:salt-marcher/src/apps/cartographer/presenter.ts†L272-L280】【F:salt-marcher/src/apps/cartographer/view-shell.ts†L156-L181】
3. **Kein Lifecycle-Abgleich:** Wenn ein aktiver Modus deregistriert würde, gäbe es keine automatische Rückfallebene oder Abort-Logik, weil weder Presenter noch Shell den Abbau triggern.【F:salt-marcher/src/apps/cartographer/presenter.ts†L272-L280】
4. **Third-Party UX:** Externe Plugins können zwar Provider registrieren, erhalten aber keinerlei Feedback, ob die View ihre Modi übernommen hat. Eine Registrierung nach dem ersten `provideCartographerModes()` bleibt wirkungslos, ohne dass der Nutzer die View neu öffnet – schlechte DX/UX.

## Empfohlene nächste Schritte / Spikes
1. **Eventing-Strategie entwerfen:** Spike zur Erweiterung der Registry um Observable-APIs (z. B. `onModesChanged`, `subscribeProviders`) oder ein signal-/event-basiertes System, das Snapshots und Delta-Events liefert.【F:salt-marcher/src/apps/cartographer/mode-registry/registry.ts†L18-L108】
2. **Presenter-Synchronisation:** Konzept erstellen, wie der Presenter auf Registry-Events reagiert (Neuregistrierung → `shell.registerMode`, Deregistrierung → `shell.deregisterMode` + aktive Mode-Neuwahl). Evaluieren, ob `this.modes` dynamisch aktualisiert oder komplett aus dem Registry-Snapshot ersetzt werden sollte.【F:salt-marcher/src/apps/cartographer/presenter.ts†L119-L179】【F:salt-marcher/src/apps/cartographer/view-shell.ts†L140-L205】
3. **Lifecycle-Sicherheit:** Spike für robustes Handling, wenn der aktuell aktive Modus wegfällt (Abort laufender Transitionen, fallback auf Default-Mode, UI-Feedback).【F:salt-marcher/src/apps/cartographer/presenter.ts†L362-L399】【F:salt-marcher/src/apps/cartographer/view-shell.ts†L140-L181】
4. **Third-Party-Kommunikation:** Evaluieren, ob Registrierungsfunktionen künftig einen Zustand zurückgeben sollten (z. B. „jetzt aktiv in View n Instanzen“) oder ob wir im Plugin-DX-Guide dokumentieren müssen, dass nach Registrierung ein Refresh notwendig ist.

## Offene Fragen für weitere Analyse
- Brauchen wir differenzierte Events für Metadaten-Änderungen vs. Lifecycle-Events (Modus geladen/entladen)?
- Welche Performance-Kosten entstehen, wenn der Presenter bei jedem Registry-Update neue Lazy-Wrappers erzeugt?
- Wie koordinieren wir Mode-Transitions, wenn während eines Updates gleichzeitig Nutzerinteraktionen laufen (Abort-Signale, Locking)?

Diese Punkte bilden die Basis für ein Synchronisierungskonzept und konkrete To-Dos im Registry- und Presenter-Bereich.
