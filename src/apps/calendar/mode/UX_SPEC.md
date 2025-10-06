# Calendar Workmode – UX Spezifikation
Diese Spezifikation definiert UI-Verhalten, Nutzer:innenflüsse und Interaktionen für den Calendar-Workmode. Sie ergänzt den [Implementierungsplan](../IMPLEMENTATION_PLAN.md) und verweist auf [Wireframes](./WIREFRAMES.md), [Komponenten](./COMPONENTS.md) sowie die [Zustandsmaschine](./STATE_MACHINE.md).

## 1. Übersicht
- Primary Persona: Spielleitung, die Reisen im Cartographer plant, Default-Kalender verwaltet und Ereignisse pflegt.
- Kontext: Obsidian-Leaf im Calendar-Workmode, eigenständiger Kalender-Manager (Kalenderansicht/Übersicht) sowie kompaktes Travel-Leaf im Cartographer-Reisemodus.
- UI-Bausteine: Nutzung vorhandener Komponenten aus `src/ui` (Tables, Buttons, Toggles, Modals) kombiniert mit neuen Calendar-spezifischen Grids, Toolbars und Leaf-Komponenten.

## 2. Artefakt-Mapping
| Artefakt | Zweck | Referenz |
| --- | --- | --- |
| Wireframes | Visuelle Struktur & Layout | [./WIREFRAMES.md](./WIREFRAMES.md) |
| Komponenten | Props/Events & Composition | [./COMPONENTS.md](./COMPONENTS.md) |
| Zustandsmaschine | State-Slices, Events, Effekte | [./STATE_MACHINE.md](./STATE_MACHINE.md) |
| API-Contracts | Domain- & Gateway-Schnittstellen | [./API_CONTRACTS.md](./API_CONTRACTS.md) |
| Testplan | Abdeckung & Akzeptanzprüfung | [../../tests/apps/calendar/TEST_PLAN.md](../../../tests/apps/calendar/TEST_PLAN.md) |

## 3. Workflows
Jeder Workflow beschreibt Ziel, Trigger, Vorbedingungen, Flüsse, Fehler, Postbedingungen und Datenänderungen. Akzeptanzkriterien siehe [Implementierungsplan §Akzeptanzkriterien](../IMPLEMENTATION_PLAN.md#akzeptanzkriterien-kurzform).

### 3.1 Aktiven Kalender wählen
| Element | Beschreibung |
| --- | --- |
| Ziel | Aktiven Kalender im globalen Kontext oder für eine Reise setzen. |
| Trigger | Toolbar-Dropdown im Dashboard, Command Palette (`calendar:select-active`), Reise-Setup im Travel-Panel. |
| Vorbedingungen | Mindestens ein Kalender existiert. Für Reisen kann ein Default vorgegeben sein. |
| Postbedingungen | `activeCalendarId` (Scope: global oder Reise) aktualisiert, Dashboard/Travel-Leaf laden Daten neu. |
| Datenänderungen | Persistenter Status im `CalendarStateGateway` (`activeCalendarId`, optional `travel.activeCalendarId`). |

**Hauptfluss**
1. Nutzer:in öffnet Dropdown/Command.
2. Liste zeigt alle Kalender mit Labels (Default, Reise-Override) und Tooltips für Schema-Zusammenfassung.
3. Auswahl setzt `activeCalendarId` im passenden Scope (global ohne Reise, sonst Reise-spezifisch).
4. Presenter zeigt Ladezustand, ruft Domain/Gateway, aktualisiert Dashboard & Travel-Leaf.

**Alternativflüsse**
- *Kein Kalender vorhanden*: Dropdown zeigt Leerstaat mit CTA „Kalender anlegen“ (öffnet Manager in Modus „Kalender erstellen“).
- *Reisespezifischer Override*: Checkbox „Reise-spezifischen Kalender verwenden“ blendet Liste für Reise-Overrides ein.

**Fehlerzustände**
- Gateway-Fehler → Inline-Banner „Kalender konnte nicht geladen werden. [Erneut versuchen]“.
- Ausgewählter Kalender gelöscht → Dialog fordert Neuauswahl (Fallback auf Default, siehe §3.2).

**Textuelles Ablaufdiagramm**
`Start → Auswahl öffnen → Kalenderliste laden → (Liste leer?) → [Ja] Leerstaat → Ende / [Nein] Kalender wählen → Scope bestimmen → Gateway.updateActiveCalendar → UI refresh → Ende`

### 3.2 Default-Kalender verwalten
| Element | Beschreibung |
| --- | --- |
| Ziel | Genau einen globalen Default definieren und optionale Reise-Defaults verwalten. |
| Trigger | Toggle „Als Standard festlegen“ in Formularen, Kontextmenü „Als Default setzen“ in Übersicht, Reise-Einstellungen. |
| Vorbedingungen | Mindestens ein Kalender existiert. |
| Postbedingungen | `defaultCalendarId` (global) bzw. `travel.defaultCalendarId` aktualisiert, UI kennzeichnet Default. |
| Datenänderungen | Persistente Flags im Repository und Gateway (`isDefaultGlobal`, `defaultForTravelId`). |

**Hauptfluss (Global)**
1. Nutzer:in aktiviert Toggle „Globaler Standard“ im Kalenderformular oder Kontextmenü.
2. System prüft vorhandenen Default; falls anderer Default existiert, deaktiviert ihn.
3. Repository aktualisiert Flags atomar (Transaktion oder sequenziell mit Rollback).
4. UI zeigt Badge „Default“ in Listen, Dropdowns und Travel-Leaf.

**Hauptfluss (Reise)**
1. In Reise-Setup toggelt Nutzer:in „Reise-Standard“.
2. `travel.defaultCalendarId` wird gespeichert; Travel-Leaf aktualisiert Kennzeichnung.

**Alternativ-/Fehlerflüsse**
- Löschen eines Default-Kalenders → Dialog: „Bitte neuen Standard wählen“ (Liste + CTA). Ohne Auswahl fallbackt System auf anderen Kalender oder markiert „Kein Standard“ mit Hinweis.
- Persistenzfehler → Toast „Standard konnte nicht gesetzt werden“ + Undo.

**Textuelles Ablaufdiagramm**
`Start → Toggle aktivieren → bisherigen Default ermitteln → Flag entfernen (wenn vorhanden) → neuen Default setzen → persistieren → UI aktualisieren → Ende`

### 3.3 Kalender-Manager – Modus wechseln
| Element | Beschreibung |
| --- | --- |
| Ziel | Zwischen vollformatiger Kalenderansicht (Monat/Woche/Tag) und Kalender-Übersicht (Listen/Kacheln) wechseln. |
| Trigger | Tabs oder segmented Control in der Manager-Headerleiste. |
| Vorbedingungen | Manager-Leaf geöffnet. |
| Postbedingungen | `managerViewMode` aktualisiert, entsprechende Daten (Events, Filter) geladen. |
| Datenänderungen | UI-Status (`managerViewMode`, `calendarViewZoom`, Filterpersistenz). |

**Hauptfluss**
1. Nutzer:in wählt Tab „Kalenderansicht“ oder „Übersicht“.
2. Presenter speichert Modus, lädt benötigte Daten (Events per Zoom, Filterresultate, Default-Flags).
3. UI animiert Übergang, Fokus bleibt auf Toolbar (ARIA `aria-live="polite"` für Screenreader-Hinweis).

**Kalenderansicht-Details**
- Zoom-Stufen: Monat, Woche, Tag (Toolbar mit Buttons und Shortcuts: `Ctrl+Alt+1/2/3`).
- Navigation: Vor/Zurück, Heute, Datums-Picker, Inline-Erstellung per Doppelklick (öffnet Event-Dialog mit vorausgefülltem Datum).
- Hover zeigt Tooltip mit Event-Details, Klick auf Event öffnet Detail-Popover (Bearbeiten, Löschen, Als Default?).

**Übersichts-Details**
- Layout ähnlich `apps/library`: Filterleisten (Tagging, Schema-Typ, Default-Status), Suchfeld, Listen- oder Kachelumschaltung.
- Stapelaktionen: Löschen, Export, In Editor öffnen, Als Default setzen.
- Import in Editor: Button „Im Editor öffnen“ → übergibt Kalenderdaten an Formular-Dialog.

**Fehler-/Leerstaaten**
- Keine Kalender → hero section mit CTA „Neuen Kalender anlegen“.
- Datenladefehler → Inline-Error mit Retry.

### 3.4 Neuen Kalender anlegen
| Element | Beschreibung |
| --- | --- |
| Ziel | Schema konfigurieren, Default-Status optional setzen und speichern. |
| Trigger | CTA im Dashboard, Manager-Leerstaat, Button „Kalender anlegen“, Command `calendar:new`. |
| Vorbedingungen | Nutzer:in besitzt Schreibrechte. |
| Postbedingungen | Neuer Eintrag im Repository, optional als Default markiert und ggf. sofort aktiv. |
| Datenänderungen | Insert in `CalendarRepository` (`CalendarSchema`, Default-Flags, Startdatum), optional `activeCalendarId` Update. |

**Hauptfluss**
1. Modal mit Tabs „Grunddaten“, „Monate“, „Schaltregeln“, „Vorschau“ öffnet.
2. Pflichtfelder: Name (Text), Wochenlänge (Number), Startdatum (Schema-spezifischer DatePicker), Monate (Liste mit Name & Länge), Optional: Schaltregel-Konfigurator (JSON-ähnliche Controls).
3. Vorschau aktualisiert sich live (Mini-Kalender, Event-Slots).
4. Toggle „Als globalen Standard festlegen“ (Standard: aus) und „Für aktuelle Reise übernehmen“ (sichtbar falls Reise aktiv).
5. Speichern → Validierung → Persistenz → Toast „Kalender erstellt“.

**Alternativflüsse**
- Duplizieren existierender Kalender (Formular prefilled, Name mit Suffix „Copy“).
- Speichern als Vorlage (kein sofortiger Aktiv-Status, markiert `isTemplate`).

**Fehlerzustände**
- Feldvalidierung (siehe §5 Accessibility & i18n) → Inline-Fehler, Submit bleibt disabled.
- Persistenzfehler → Banner im Modal, Retry möglich.

### 3.5 Ereignis anlegen
#### 3.5.1 Einmalig
| Element | Beschreibung |
| --- | --- |
| Ziel | Einzelnes Ereignis an einem Datum hinzufügen. |
| Trigger | Button „Ereignis hinzufügen“ → Tab „Einmalig“. |
| Vorbedingungen | Aktiver Kalender existiert, Datum innerhalb Schema. |
| Postbedingungen | Ereignis in Listen „Alle“ & „Kommend“ (falls zukünftig) sowie optional Travel-Leaf-Vorschau. |
| Datenänderungen | Insert `CalendarEventSingle`, optional Hooks. |

**Hauptfluss**
1. Formularfelder: Titel (Text), Datum (Schema-abhängiger Picker), Typ (Dropdown), Tags (TokenInput), Notiz (Markdown).
2. Checkbox „Bei Zeitfortschritt nachholen falls übersprungen“ (Default: an).
3. Speichern → Validierung (Datum >= 0, existiert) → Persistenz → Modal schließt.

**Alternativ-/Fehlerflüsse**
- Datum in Vergangenheit → Hinweis „Vergangenes Ereignis – jetzt nacharbeiten?“ + Button `triggerNow`.
- Konflikt mit anderem Ereignis (gleicher Slot, exclusiv) → Warnbanner, Option „Trotzdem speichern“.

#### 3.5.2 Wiederkehrend
| Element | Beschreibung |
| --- | --- |
| Ziel | Regelbasiertes Ereignis mit Vorschau definieren. |
| Trigger | Button „Ereignis hinzufügen“ → Tab „Wiederkehrend“. |
| Vorbedingungen | Aktiver Kalender mit definierten Monaten/Wochen. |
| Postbedingungen | Ereignis erstellt, Recurrence-Cache aktualisiert, Vorschau in Manager & Travel-Leaf. |
| Datenänderungen | Insert `CalendarEventRecurring` (inkl. `RepeatRule`). |

**Hauptfluss**
1. Regel-Picker mit Modi: `annual_offset`, `monthly_position`, `weekly_dayIndex`, `custom_hook` (JSON textarea + Validator).
2. Vorschau (nächste 5 Vorkommen) aktualisiert on-change; Countdown zeigt Tage bis zum nächsten Auftreten.
3. Optional: „Nur zwischen Datum A/B“ (Begrenzung), „Endlos“.
4. Speichern → Validierung (z.B. Position existiert) → Persistenz.

**Fehlerzustände**
- Kollidierende Regel → Warnung „Regel überschneidet sich mit {eventName}“ + Link „Konflikte anzeigen“.
- Custom Hook invalid JSON → Inline-Error, Speichern disabled.

### 3.6 Zeit fortschreiten
| Element | Beschreibung |
| --- | --- |
| Ziel | Datum vor-/zurückbewegen, Ereignisse auslösen. |
| Trigger | Dashboard Quick-Actions („+1 Tag“, „+1 Woche“, „Benutzerdefiniert…“), Keyboard (Ctrl+Alt+Arrow), Travel-Leaf Buttons, Cartographer-Hooks. |
| Vorbedingungen | Aktiver Kalender, Travel-Leaf optional sichtbar. |
| Postbedingungen | `currentDate` aktualisiert, ausgelöste Events in Log, Travel-Leaf synchronisiert. |
| Datenänderungen | Mutationen im Gateway (`currentDate`, `triggeredEvents`, `pendingFollowUps`). |

**Hauptfluss**
1. Nutzer:in wählt Aktion oder nutzt Shortcut.
2. Dialog für benutzerdefinierten Schritt: Felder „Anzahl“, „Einheit (Tag/Woche/Monat/Benutzerdefiniert)“, Option „Ereignisse nachholen“.
3. Domain prüft Event-Konflikte, generiert Liste `triggeredEvents`.
4. UI zeigt Ergebnis im Panel „Ereignislog“ + optional Travel-Leaf-Badges.

**Fehlerzustände**
- Keine aktiven Kalender → Quick-Actions disabled + Tooltip.
- Persistenzfehler beim Speichern neuer `currentDate` → Toast + Undo.

### 3.7 Datum setzen/jump
| Element | Beschreibung |
| --- | --- |
| Ziel | Datum direkt setzen mit Konfliktauflösung. |
| Trigger | Quick-Action „Datum setzen“, Travel-Leaf Option „Datum springen“, Command `calendar:set-date`. |
| Vorbedingungen | Aktiver Kalender, Ziel-Datum innerhalb Schema. |
| Postbedingungen | Datum gesetzt, übersprungene Ereignisse optional nachgeholt, Travel-Leaf aktualisiert. |
| Datenänderungen | `currentDate`, `skippedEvents`, optional `followUpTasks`. |

**Hauptfluss**
1. Dialog mit DatePicker (Schema-basiert) und Info-Box „Übersprungene Ereignisse“ (live berechnet).
2. Checkbox „Nachträgliche Auslösung erzwingen“.
3. Bestätigung → Domain setzt Datum → UI zeigt Summary (Badge „N Ereignisse nachzuholen“).

**Fehlerzustände**
- Datum außerhalb Schema → Inline-Error.
- Konflikt mit gesperrtem Datum (z.B. Reise-Lock) → Blockiert, Hinweis „Reise kann nicht übersprungen werden“.

### 3.8 Ereignisliste filtern/suchen
| Element | Beschreibung |
| --- | --- |
| Ziel | Ereignisse nach Zeitraum, Typ, Tagging filtern. |
| Trigger | Filterpanel im Dashboard/Manager-Übersicht, Suche (Ctrl+F), Tag-Chips. |
| Vorbedingungen | Ereignisse vorhanden. |
| Postbedingungen | Gefilterte Liste, Filterzustand persistiert pro Benutzer:in. |
| Datenänderungen | `eventListFilter`, `searchTerm`, `selectedTags`. |

**Details**
- Filteroptionen: Zeitraum (letzte 30/90 Tage, kommende 30/90 Tage, benutzerdefiniert), Ereignistyp, Tags, „Nur Default-Kalender“.
- Live-Filter (debounced 200ms) mit Ergebniszähler.
- Keine Treffer → Leerstaat (siehe §4).

### 3.9 Kalender bearbeiten
| Element | Beschreibung |
| --- | --- |
| Ziel | Schema ändern, Migration durchführen, Default anpassen. |
| Trigger | Kontextmenü „Bearbeiten“ in Übersicht, Button im Kalenderformular, Travel-Leaf Badge (öffnet Editor). |
| Vorbedingungen | Ausgewählter Kalender existiert. |
| Postbedingungen | Schema aktualisiert, Events migriert oder Konfliktliste erstellt. |
| Datenänderungen | Update `CalendarSchema`, Migrationstasks, Default-Flags. |

**Hauptfluss**
1. Editor-Dialog wie bei Neuanlage, mit zusätzlichen Warnhinweisen („Änderungen wirken sich auf alle Ereignisse aus“).
2. Migration Wizard: Schritt 1 Schema ändern, Schritt 2 Konflikte prüfen (Liste, Option „Automatisch anpassen“), Schritt 3 Zusammenfassung.
3. Speichern führt Migration aus, zeigt Status (Progressbar) und Ergebnis.

**Fehlerzustände**
- Migration scheitert → Dialog mit Fehlerdetails, Option „Rollback“ (Repository restore).
- Default-Flag auf entferntem Kalender → UI zwingt neue Auswahl.

### 3.10 Travel-Kalender
| Element | Beschreibung |
| --- | --- |
| Ziel | Kompaktes Leaf im Reisemodus anzeigen, das Zeitfortschritt und nächste Ereignisse visualisiert. |
| Trigger | Reisemodus startet (Cartographer Hook), Nutzer:in öffnet/ schließt Leaf, Toolbar-Buttons (Monat/Woche/Tag/Nächste). |
| Vorbedingungen | Reise aktiv, Kalender verfügbar (Default oder ausgewählt). |
| Postbedingungen | Leaf sichtbar, `travelLeafMode` gesetzt, Daten synchronisiert. |
| Datenänderungen | `travelLeafVisible`, `travelLeafMode`, `travelRange`, `travelPendingEvents`. |

**Hauptfluss**
1. Bei Reise-Start sendet Cartographer Hook → Leaf mountet automatisch (Split-pane neben Travel-Hauptansicht).
2. Toolbar (Icon Buttons) ermöglicht Moduswechsel (Monat/Woche/Tag/Nächste Ereignisse). Shortcuts: `Ctrl+Alt+Shift+1..4`.
3. Inhalt pro Modus (siehe [Wireframes §Travel](./WIREFRAMES.md#travel-leaf))
   - Monat: komprimiertes Grid, maximal 4 Wochen sichtbar, horizontales Scrollen falls nötig.
   - Woche: Listen-Layout mit Tagen, Ereigniskarten.
   - Tag: vertikale Timeline, Buttons „-1 Tag“, „+1 Tag“, „Zeitsprung…“.
   - Nächste Ereignisse: Liste mit Prioritätsbadges und Buttons „Nacharbeiten“.
4. Travel-Leaf zeigt Statusbanner (z.B. „Kein Default verfügbar“) und synchronisiert Quick-Actions.
5. Beim Reise-Ende → Leaf unmountet automatisch, Zustand persistiert für nächsten Start.

**Fehler-/Leerstaaten**
- Kein Kalender → Kompakter Leerstaat „Kein Kalender ausgewählt“ + CTA „Manager öffnen“.
- Ladefehler → Banner „Daten konnten nicht geladen werden“ mit Retry.

### 3.11 Reise-Sync (Cartographer)
| Element | Beschreibung |
| --- | --- |
| Ziel | Bidirektionale Synchronisation von Zeitfortschritt, Hooks und UI-Feedback zwischen Cartographer und Calendar. |
| Trigger | `advanceTime`, `setDate`, Reise-Start/-Ende Hooks, Travel-Leaf Interaktionen. |
| Vorbedingungen | Cartographer-Reise aktiv. |
| Postbedingungen | Zeitwerte synchronisiert, Ereignisse im Travel-Panel angezeigt, Hooks dispatcht. |
| Datenänderungen | `currentDate`, `triggeredEvents`, `cartographerStatus`. |

**Hauptfluss**
1. Cartographer ruft `CalendarStateGateway.advanceTime` auf.
2. Domain berechnet neue Zeit, Events, Hooks. Travel-Leaf zeigt Loading Spinner.
3. Ergebnisse werden an Cartographer zurückgegeben → Travel-Panel & Calendar-Leaf aktualisieren.
4. UI zeigt Confirmations (Toast + Log).

**Fehlerzustände**
- Gateway wirft `io_error` → Cartographer erhält Fehlermeldung, Travel-Leaf zeigt rotes Banner.
- Hook schlägt fehl → Retry-Button „Erneut dispatchen“.

## 4. Fehler und Leerstaaten
| Kontext | Zustand | Darstellung |
| --- | --- | --- |
| Dashboard | Keine Kalender | Illustration + Text „Noch kein Kalender erstellt“ + Button „Kalender anlegen“ |
| Dashboard | Keine kommenden Ereignisse | Card mit Copy „Du bist frei von Verpflichtungen“ + Button „Ereignis hinzufügen“ |
| Manager – Kalenderansicht | Laden fehlgeschlagen | Inline-Error-Badge in Toolbar + Retry |
| Manager – Übersicht | Filter ohne Treffer | Tabelle ersetzt durch Card „Keine Treffer“ + Button „Filter zurücksetzen“ |
| Travel-Leaf | Kein Kalender/Default | Kompakter Text + CTA „Kalender wählen“ (öffnet Dropdown) |
| Travel-Leaf | Events übersprungen | Sticky-Banner mit Liste (max 3 Items) + Button „Nacharbeiten“ |
| Formular | Validierungsfehler | Inline-Message unter Feld, rote Outline, Screenreader-Text `aria-live="assertive"` |
| Global | Persistenzfehler | Toast + Link „Details anzeigen“ → öffnet Modal mit Fehlercode |

Fehlertexte sind in `i18n` unter `calendar.mode.errors.*` gepflegt. Leerstaaten verweisen auf Manager oder Event-Dialog.

## 5. Accessibility & i18n
- **Fokusmanagement**: Modale fangen Fokus (`FocusTrap`), schließen per `Esc`. Travel-Leaf setzt Fokus auf Toolbar beim Mount, Quick-Actions erhalten sichtbaren Fokusrahmen.
- **Shortcuts**: Dokumentiert in Tooltip (`aria-keyshortcuts`).
- **Screenreader**: Alle Buttons mit `aria-label`, Events in Kalenderansicht als `role="button"` + `aria-describedby` für Tooltip-Inhalte. Grid nutzt `aria-roledescription="calendar"`.
- **Tab-Reihenfolge**: Header → Toolbar → Hauptinhalte → Sidebar; in Kalenderansicht rotiert Tab durch Events, Shift+Tab zurück zur Toolbar.
- **Kontraste**: Verwendung `ui/tokens` (primär 4.5:1), Travel-Leaf komprimierte Typografie min 12px/0.75rem.
- **i18n**: Keys `calendar.manager.*`, `calendar.travel.*`. Datumsausgabe nutzt Domain-Formatter (schemaabhängig), keine locale-spezifischen Monatsnamen (werden aus Schema bezogen). Mehrzahl via ICU.
- **Announcements**: Moduswechsel (Manager Tabs, Travel-Leaf) triggern `aria-live="polite"` Meldungen „Kalenderansicht – Monatsansicht geladen“.

## 6. Telemetrie-Hinweise
- Zentrale User-Aktionen (Default setzen, Moduswechsel, Travel-Leaf mount/unmount) dispatchen Events `calendar.telemetry.*` (Details siehe [STATE_MACHINE.md §Effekte](./STATE_MACHINE.md#effekte)).
- Fehler werden mit `scope` (dashboard/manager/travel) annotiert.

## 7. Verweise
- Umsetzungshinweise zu Komponenten: [COMPONENTS.md](./COMPONENTS.md)
- State- und Effektmodell: [STATE_MACHINE.md](./STATE_MACHINE.md)
- API und Persistenz: [API_CONTRACTS.md](./API_CONTRACTS.md)
- Testabdeckung: [../../tests/apps/calendar/TEST_PLAN.md](../../../tests/apps/calendar/TEST_PLAN.md)
