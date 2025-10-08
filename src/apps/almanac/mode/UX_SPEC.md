# Almanac Workmode – UX Spezifikation
Diese Spezifikation definiert UI-Verhalten, Nutzer:innenflüsse und Interaktionen für den Almanac-Workmode. Sie ergänzt den [Implementierungsplan](../IMPLEMENTATION_PLAN.md) und verweist auf [Wireframes](./WIREFRAMES.md), [Komponenten](./COMPONENTS.md) sowie die [Zustandsmaschine](./STATE_MACHINE.md).

## 1. Übersicht
- Primary Persona: Spielleitung, die Reisen im Cartographer plant, Default-Kalender verwaltet und Ereignisse pflegt.
- Kontext: Obsidian-Leaf im Almanac-Workmode (Almanac-Shell) mit Dashboard, Manager, Events sowie separat montiertes Travel-Leaf im Cartographer-Reisemodus.
- UI-Bausteine: Nutzung vorhandener Komponenten aus `src/ui` (Tables, Buttons, Toggles, Modals) kombiniert mit neuen Calendar-spezifischen Grids, Toolbars und Leaf-Komponenten.

### 1.1 Navigationshierarchie & Terminologie
| Ebene | Label | Beschreibung | Persistenter State | UI-Hinweis |
| --- | --- | --- | --- | --- |
| Parent | Almanac | Shell-Lean-Leaf im Almanac-Workmode | `ui.almanacNavigation.shell` | Heading `Almanac` |
| Submodus | Almanac › Dashboard | Timestamp, Quick-Actions, Ereignislog | `ui.almanacMode = "dashboard"` | Mode-Switcher markiert aktiv |
| Submodus | Almanac › Manager | Kalenderansicht + Übersicht | `ui.almanacMode = "manager"` | Mode-Switcher markiert aktiv |
| Submodus | Almanac › Events | Phänomen-Hub (Timeline, Tabelle, Karte) | `ui.almanacMode = "events"` | Mode-Switcher markiert aktiv |
| Extern | Cartographer › Travel-Kalender | Kompaktes Leaf im Reisemodus | `ui.travelLeaf` | Eigenes Cartographer-Layout |

- Mode-Switcher (Tabs/Sidebar) zeigt Labels exakt wie oben; zusätzliche Breadcrumb-Leiste entfällt zugunsten einer reduzierten Shell.
- Travel-Leaf wird im Dokument als Kurzform für **Cartographer › Travel-Kalender** verwendet und behält das Cartographer-eigene Layout; Switcher-Steuerung erfolgt über Travel-spezifische Toolbar (siehe §3.14).

## 2. Artefakt-Mapping
| Artefakt | Zweck | Referenz |
| --- | --- | --- |
| Wireframes | Visuelle Struktur & Layout | [./WIREFRAMES.md](./WIREFRAMES.md) |
| Komponenten | Props/Events & Composition | [./COMPONENTS.md](./COMPONENTS.md) |
| Zustandsmaschine | State-Slices, Events, Effekte | [./STATE_MACHINE.md](./STATE_MACHINE.md) |
| API-Contracts | Domain- & Gateway-Schnittstellen | [./API_CONTRACTS.md](./API_CONTRACTS.md) |
| Testplan | Abdeckung & Akzeptanzprüfung | [../../tests/apps/almanac/TEST_PLAN.md](../../../tests/apps/almanac/TEST_PLAN.md) |

## 3. Workflows
Jeder Workflow beschreibt Ziel, Trigger, Vorbedingungen, Flüsse, Fehler, Postbedingungen und Datenänderungen. Akzeptanzkriterien siehe [Implementierungsplan §Akzeptanzkriterien](../IMPLEMENTATION_PLAN.md#akzeptanzkriterien-kurzform).

### 3.1 Almanac-Modus wechseln
| Element | Beschreibung |
| --- | --- |
| Ziel | Zwischen `Almanac › Dashboard`, `Almanac › Manager` und `Almanac › Events` wechseln ohne Kontextverlust. |
| Trigger | Almanac-Tabbar/Sidebar, Command Palette (`almanac:switch-mode`), Deep-Link (`obsidian://saltmarcher?mode=events`). |
| Vorbedingungen | Almanac-Leaf ist geöffnet; benötigte Daten können lazy geladen werden. |
| Postbedingungen | `almanacMode` aktualisiert, letzter Zustand des Zielmodus (Zoom, Filter, Auswahl) wiederhergestellt. |
| Datenänderungen | `ui.almanacMode`, `ui.modeHistory`, optional `ui.lastZoom[mode]`, `ui.lastFilters[mode]`. |

**Hauptfluss**
1. Nutzer:in klickt auf Tab/Sidebar-Item oder ruft Command auf.
2. Presenter prüft, ob Modus bereits geladen wurde; wenn nein, zeigt Shimmer-Loader und lädt initiale Daten (via `CalendarStateGateway`).
3. Sobald Daten verfügbar, wird Zielmodus gerendert; Fokus springt auf primäres Heading (`h1`) mit `tabindex="-1"`.
4. Historie (`modeHistory`) aktualisiert Telemetrie und ermöglicht Modus-Resume (ohne separate Breadcrumb-Leiste).

**Alternativflüsse**
- *Lazy Load aktiv*: Während Daten geladen werden, zeigt UI Progress-Bar; Nutzer:innen können andere Modi wählen (Queue verwirft laufende Requests bei Navigation).
- *Deep-Link mit Zustand*: Query-Parameter `view=timeline&filter=weather` wird in `eventsViewMode`/`eventFilters` übertragen und persistiert.

**Fehlerzustände**
- Gateway-Fehler → Inline-Banner „Modus konnte nicht geladen werden“ mit Retry & Link zu Logs.
- Unbekannter Modus → Fallback auf Dashboard + Toast „Modus nicht verfügbar“.

**Textuelles Ablaufdiagramm**
`Start → Modus-Auswahl → (Daten vorhanden?) → [Ja] Zustand wiederherstellen → Render → Ende / [Nein] Loader anzeigen → Daten laden → Zustand initialisieren → Render → Ende`

### 3.2 Events-Modus navigieren und filtern
| Element | Beschreibung |
| --- | --- |
| Ziel | Kalenderübergreifende Phänomene analysieren, filtern, sortieren und darstellen (Timeline, Tabelle, Karten). |
| Trigger | Wechsel in Events-Modus, Interaktion mit Filterleiste, Toggle „Timeline/Tabelle/Karte“. |
| Vorbedingungen | Mindestens ein Kalender und ein Phänomen existiert oder es liegt ein Leerstaat vor. |
| Postbedingungen | `eventsViewMode`, `eventFilters`, `eventSort` aktualisiert; sichtbare Phänomene entsprechen Filter. |
| Datenänderungen | Persistente Filter (`CalendarStateGateway`), Event-Paginierungscursor (`eventsPagination`). |

**Hauptfluss**
1. Beim Betreten lädt Presenter Standardfilter (z.B. `timeRange = next 90 days`).
2. Nutzer:in ändert Ansicht (Timeline/Tabelle/Karte); Presenter berechnet erforderliche Datenfenster (Rolling Window) und cached Resultate.
3. Filterchips (Kategorie, betroffene Kalender, Auswirkungen, Schlagworte) aktualisieren Query; UI zeigt Count-Badges.
4. Liste/Timeline animiert sanft (`prefers-reduced-motion` berücksichtigt) und Scrollposition wird beibehalten.

**Alternativflüsse**
- *Keine Daten*: Leerstaat mit Illustration, CTA „Phänomen hinzufügen“, Sekundäraktion „Kalender verknüpfen“.
- *Große Datenmenge*: Infinity-Scroll lädt weitere Batches; Preloader zeigt `+X weitere Treffer`. Nutzer:in kann `Export` starten (CSV/JSON) – UI zeigt Fortschrittsmodal.

**Fehlerzustände**
- Netzwerk/Persistenzfehler → Sticky-Banner „Phänomene konnten nicht geladen werden“ mit Retry.
- Filter-Konflikt (z.B. Datum außerhalb Schema) → Inline-Warnung neben Filterchip, Option „Zurücksetzen“.

**Textuelles Ablaufdiagramm**
`Start → Events-Modus laden → Standardfilter anwenden → Nutzer:in ändert Ansicht/Filter → Query bauen → Daten laden → Render → (weitere Seiten?) → [Ja] Scroll-Observer lädt nach → Ende`

### 3.3 Phänomen anlegen/bearbeiten
| Element | Beschreibung |
| --- | --- |
| Ziel | Jahreszeiten, astronomische Phänomene, Wetterereignisse u. Ä. definieren und verwalten. |
| Trigger | CTA „Phänomen hinzufügen“, Kontextmenü „Bearbeiten“, Import aus Datei. |
| Vorbedingungen | Mindestens ein Kalender existiert; Kategorie-Liste ist konfiguriert (Default-Kategorien + Custom). |
| Postbedingungen | Neuer oder aktualisierter `AlmanacEvent` ist gespeichert, Vorschau aktualisiert, Timeline markiert Änderungen. |
| Datenänderungen | `AlmanacRepository` (CRUD), `phenomenon.previewOccurrences`, optional `phenomenon.templates`. |

**Hauptfluss (Neu)**
1. Modal öffnet mit Tabs „Stammdaten“, „Zeitdefinition“, „Auswirkungen“, „Vorschau“.
2. Pflichtfelder: Name (Text), Kategorie (Dropdown mit Icons), Sichtbarkeit (All Calendars vs. Auswahl), Zeitdefinition (All-Day, Start/End `CalendarTimestamp`, Wiederholungsregel, astronomische Formel), Auswirkungen (z.B. `weather = storm`, `narrativeTag`).
3. Vorschau-Panel berechnet nächste fünf Auftreten je verlinktem Kalender (unter Nutzung von Schema/Zeitzone).
4. Speichern validiert Eingaben, schreibt in Repository, zeigt Toast „Phänomen gespeichert“. Timeline/Listen highlighten neuen Eintrag (`aria-live`).

**Alternativflüsse**
- *Import*: Nutzer:in wählt JSON/CSV → Parser zeigt Mapping-Dialog (Felder zu Kategorien). Bei Fehlern werden Zeilen markiert.
- *Vorlage*: Speichern als Template (kein aktives Phänomen) – im Events-Modus im Tab „Vorlagen“ sichtbar.

**Fehlerzustände**
- Validierung: Fehlende Kategorie → Inline-Error „Bitte Kategorie wählen“. Inkonsistente Wiederholungsregel → Tooltip mit Beispiel.
- Persistenzfehler → Modal bleibt offen, Banner + Retry.

**Textuelles Ablaufdiagramm**
`Start → Formular öffnen → Eingaben vornehmen → Vorschau berechnen → (Validierung ok?) → [Nein] Fehler anzeigen → zurück zu Formular / [Ja] speichern → Repository updaten → Toast → Ende`

### 3.4 Phänomen Kalender verknüpfen & Hooks konfigurieren
| Element | Beschreibung |
| --- | --- |
| Ziel | Sichtbarkeit eines Phänomens pro Kalender steuern, Prioritäten/Hooks definieren und Bulk-Aktionen durchführen. |
| Trigger | Detail-Drawer „Kalenderzuordnung“, Multi-Select im Events-Modus, Kontextmenü „Hooks bearbeiten“. |
| Vorbedingungen | Phänomen existiert; mindestens ein Kalender vorhanden. |
| Postbedingungen | `phenomenon.links` aktualisiert (Kalender-ID, Priorität, Override-Regeln), Hook-Konfiguration gespeichert. |
| Datenänderungen | `PhenomenonLinkDTO`, `HookConfig`, `calendarOverrides`. |

**Hauptfluss**
1. Nutzer:in öffnet Drawer; Liste aller Kalender erscheint mit Checkbox, Badges (Default, Reise-Override) und Tooltips (Schema-Zusammenfassung).
2. Auswahl setzt Link-Objekte; optional Priorität (Drag-to-order) und Hook-Aktion (z.B. `dispatch travel.setWeather`).
3. Beim Speichern aktualisiert Repository Links atomar, invalidiert Caches und zeigt Statushinweis.

**Alternativflüsse**
- *Bulk-Aktion*: Auswahl mehrerer Phänomene → Aktion „Kalender hinzufügen/entfernen“. UI zeigt Zusammenfassung (n Elemente geändert).
- *Konflikt*: Wenn Kalenderschema unvereinbar (z.B. kein Mond), bietet UI Option „Schema-spezifische Anpassung definieren“ (z.B. alternative Berechnung).

**Fehlerzustände**
- Persistenz schlägt fehl → Drawer bleibt offen, Banner + Retry.
- Benutzer versucht, letzten verknüpften Kalender zu entfernen → Warn-Dialog „Mindestens ein Kalender erforderlich“.

**Textuelles Ablaufdiagramm**
`Start → Drawer öffnen → Kalenderliste anzeigen → Nutzer:in wählt Kalender/Priorität → Hooks konfigurieren → Speichern → Repository aktualisieren → Cache invalidieren → Ende`

### 3.5 Aktiven Kalender wählen
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
- Ausgewählter Kalender gelöscht → Dialog fordert Neuauswahl (Fallback auf Default, siehe §3.6).

**Textuelles Ablaufdiagramm**
`Start → Auswahl öffnen → Kalenderliste laden → (Liste leer?) → [Ja] Leerstaat → Ende / [Nein] Kalender wählen → Scope bestimmen → Gateway.updateActiveCalendar → UI refresh → Ende`

### 3.6 Default-Kalender verwalten
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

### 3.7 Kalender-Manager – Modus wechseln
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

### 3.8 Neuen Kalender anlegen
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

### 3.9 Ereignis anlegen
#### 3.9.1 Einmalig
| Element | Beschreibung |
| --- | --- |
| Ziel | Einzelnes Ereignis an einem Datum/Uhrzeit hinzufügen. |
| Trigger | Button „Ereignis hinzufügen“ → Tab „Einmalig“. |
| Vorbedingungen | Aktiver Kalender existiert, Datum innerhalb Schema. |
| Postbedingungen | Ereignis in Listen „Alle“ & „Kommend“ (falls zukünftig) sowie optional Travel-Leaf-Vorschau mit präzisem Timestamp. |
| Datenänderungen | Insert `CalendarEventSingle` inkl. `allDay`, `startTime`, `durationMinutes`, optional Hooks. |

**Hauptfluss**
1. Formularfelder: Titel (Text), Datum (Schema-abhängiger Picker), All-Day-Toggle (Default: an), Startzeit (Time-Picker im Schema-Raster), optional Endzeit/Dauer (Number + Einheit Minuten/Stunden), Typ (Dropdown), Tags (TokenInput), Notiz (Markdown).
2. Preview zeigt Formatierung `Datum · Uhrzeit` oder Badge „Ganztägig“.
3. Checkbox „Bei Zeitfortschritt nachholen falls übersprungen“ (Default: an).
4. Speichern → Validierung (Datum/Zeit gültig, Endzeit ≥ Startzeit, Minuten < `minutesPerHour`) → Persistenz → Modal schließt.

**Alternativ-/Fehlerflüsse**
- Datum in Vergangenheit → Hinweis „Vergangenes Ereignis – jetzt nacharbeiten?“ + Button `triggerNow`.
- Konflikt mit anderem Ereignis (gleicher Timestamp, exklusiv) → Warnbanner, Option „Trotzdem speichern“ oder „Zeit anpassen“.
- Ungültige Zeit (z.B. Stunde ≥ `hoursPerDay`) → Inline-Fehlermeldung unter Time-Picker.

#### 3.9.2 Wiederkehrend
| Element | Beschreibung |
| --- | --- |
| Ziel | Regelbasiertes Ereignis mit Vorschau definieren. |
| Trigger | Button „Ereignis hinzufügen“ → Tab „Wiederkehrend“. |
| Vorbedingungen | Aktiver Kalender mit definierten Monaten/Wochen. |
| Postbedingungen | Ereignis erstellt, Recurrence-Cache aktualisiert, Vorschau in Manager & Travel-Leaf inkl. nächstem Timestamp. |
| Datenänderungen | Insert `CalendarEventRecurring` (inkl. `RepeatRule`, `timePolicy`: `all_day` | `fixed` | `relative`). |

**Hauptfluss**
1. Regel-Picker mit Modi: `annual_offset`, `monthly_position`, `weekly_dayIndex`, `custom_hook` (JSON textarea + Validator). Zusatzeinstellungen: Zeitstrategie (`Ganztägig`, `Feste Uhrzeit`, `Offset relativ zu Start`, `Custom Resolver`).
2. Vorschau (nächste 5 Vorkommen) aktualisiert on-change; Countdown zeigt Tage/Stunden bis zum nächsten Auftreten.
3. Optional: „Nur zwischen Datum A/B“ (Begrenzung), „Endlos“, Startzeit/Offset-Eingabe (Time-Picker oder `+X Minuten`).
4. Speichern → Validierung (Position existiert, Zeit liegt im Schema, Offsets überschneiden sich nicht) → Persistenz.

**Fehlerzustände**
- Kollidierende Regel → Warnung „Regel überschneidet sich mit {eventName} um {timestamp}“ + Link „Konflikte anzeigen“.
- Custom Hook invalid JSON → Inline-Error, Speichern disabled.
- Zeitzonen/Schema-Konflikt (z.B. Offset > Tageslänge) → Inline-Error „Offset überschreitet Tageslänge {hoursPerDay}.“

### 3.10 Zeit fortschreiten
| Element | Beschreibung |
| --- | --- |
| Ziel | Datum/Uhrzeit vor-/zurückbewegen, Ereignisse auslösen. |
| Trigger | Dashboard Quick-Actions („+1 Tag“, „+1 Stunde“, „+15 Minuten“, „Benutzerdefiniert…“), Keyboard (Ctrl+Alt+Arrow für Tage, Ctrl+Alt+Shift+Arrow für Stunden, Ctrl+Alt+AltGr+Arrow für Minuten), Travel-Leaf Buttons, Cartographer-Hooks. |
| Vorbedingungen | Aktiver Kalender, Travel-Leaf optional sichtbar. |
| Postbedingungen | `currentTimestamp` aktualisiert, ausgelöste Events im Log, Travel-Leaf synchronisiert. |
| Datenänderungen | Mutationen im Gateway (`currentTimestamp`, `triggeredEvents`, `pendingFollowUps`, `lastAdvanceStep`). |

**Hauptfluss**
1. Nutzer:in wählt Aktion oder nutzt Shortcut.
2. Dialog für benutzerdefinierten Schritt: Felder „Anzahl“, „Einheit (Minute/Stunde/Tag/Woche/Monat/Schemaeinheit)“, Option „Ereignisse nachholen“, Checkbox „Nachlaufende Minuten normalisieren“.
3. Domain prüft Event-Konflikte, berechnet Normalisierung (z.B. 75 Minuten → 1 Stunde 15 Minuten) und generiert Liste `triggeredEvents`.
4. UI zeigt Ergebnis im Panel „Ereignislog“ + optional Travel-Leaf-Badges; Travel-Leaf blendet Snack „+15 Minuten“ ein.

**Fehlerzustände**
- Keine aktiven Kalender → Quick-Actions disabled + Tooltip.
- Persistenzfehler beim Speichern neuer `currentTimestamp` → Toast + Undo.
- Teil-Tageskonflikt → Dialog „Mehrere Ereignisse im selben Zeitfenster“ mit Optionen (alle auslösen / Auswahl).

### 3.11 Datum und Zeit setzen
| Element | Beschreibung |
| --- | --- |
| Ziel | Datum/Uhrzeit direkt setzen mit Konfliktauflösung. |
| Trigger | Quick-Action „Datum/Zeit setzen“, Travel-Leaf Option „Zeit springen“, Command `calendar:set-datetime`. |
| Vorbedingungen | Aktiver Kalender, Ziel-Timestamp innerhalb Schema (`hoursPerDay`, `minutesPerHour`). |
| Postbedingungen | Timestamp gesetzt, übersprungene Ereignisse optional nachgeholt, Travel-Leaf aktualisiert. |
| Datenänderungen | `currentTimestamp`, `skippedEvents`, optional `followUpTasks`, `normalizationWarnings`. |

**Hauptfluss**
1. Dialog mit DatePicker (Schema-basiert), Time-Picker (Minutenraster gemäß Schema) und Info-Box „Übersprungene Ereignisse“ (live berechnet, gruppiert nach Stunde).
2. Checkbox „Nachträgliche Auslösung erzwingen“, Option „Minuten normalisieren“ (zeigt Ziel nach Roll-over).
3. Bestätigung → Domain setzt Timestamp → UI zeigt Summary (Badge „N Ereignisse nachzuholen“, Hinweis bei Normalisierung).

**Fehlerzustände**
- Datum/Zeit außerhalb Schema → Inline-Error „Zeit überschreitet Tageslänge {hoursPerDay}.“
- Konflikt mit gesperrtem Zeitraum (z.B. Reise-Lock) → Blockiert, Hinweis „Reise kann nicht übersprungen werden“.
- Ungültiges Minutenraster → Hinweis „Zeit muss im Schritt von {minuteStep} liegen“.

### 3.12 Ereignisliste filtern/suchen
| Element | Beschreibung |
| --- | --- |
| Ziel | Ereignisse nach Zeitraum, Typ, Tagging filtern. |
| Trigger | Filterpanel im Dashboard/Manager-Übersicht, Suche (Ctrl+F), Tag-Chips. |
| Vorbedingungen | Ereignisse vorhanden. |
| Postbedingungen | Gefilterte Liste, Filterzustand persistiert pro Benutzer:in. |
| Datenänderungen | `eventListFilter`, `searchTerm`, `selectedTags`. |

**Details**
- Filteroptionen: Zeitraum (letzte 30/90 Tage, kommende 30/90 Tage, benutzerdefiniert inkl. Uhrzeit), Ereignistyp, Tags, „Nur Default-Kalender“, „Nur zeitgebundene Ereignisse“.
- Live-Filter (debounced 200ms) mit Ergebniszähler.
- Keine Treffer → Leerstaat (siehe §4).

### 3.13 Kalender bearbeiten
| Element | Beschreibung |
| --- | --- |
| Ziel | Schema ändern, Migration durchführen, Default anpassen. |
| Trigger | Kontextmenü „Bearbeiten“ in Übersicht, Button im Kalenderformular, Travel-Leaf Badge (öffnet Editor). |
| Vorbedingungen | Ausgewählter Kalender existiert. |
| Postbedingungen | Schema aktualisiert, Events migriert oder Konfliktliste erstellt. |
| Datenänderungen | Update `CalendarSchema` (inkl. `hoursPerDay`, `minutesPerHour`, `minuteStep`), Migrationstasks, Default-Flags. |

**Hauptfluss**
1. Editor-Dialog wie bei Neuanlage, mit zusätzlichen Warnhinweisen („Änderungen wirken sich auf alle Ereignisse aus“), erweitert um Tab „Zeitdefinition“ (Felder: `hoursPerDay`, `minutesPerHour`, optional `secondsPerMinute`, `minuteStep`).
2. Migration Wizard: Schritt 1 Schema ändern, Schritt 2 Konflikte prüfen (Liste, Option „Automatisch anpassen“), Schritt 3 Zusammenfassung.
3. Speichern führt Migration aus, zeigt Status (Progressbar) und Ergebnis.

**Fehlerzustände**
- Migration scheitert → Dialog mit Fehlerdetails, Option „Rollback“ (Repository restore).
- Default-Flag auf entferntem Kalender → UI zwingt neue Auswahl.
- Stunden-/Minutenänderung kollidiert mit bestehenden Events → Liste der betroffenen Events, Option „Alle Events auf neue Tagesgrenze normalisieren“.

### 3.14 Cartographer › Travel-Kalender
| Element | Beschreibung |
| --- | --- |
| Ziel | Kompaktes Leaf im Reisemodus anzeigen, das Zeitfortschritt und nächste Ereignisse visualisiert. |
| Trigger | Reisemodus startet (Cartographer Hook), Nutzer:in öffnet/ schließt Leaf, Toolbar-Buttons (Monat/Woche/Tag/Nächste). |
| Vorbedingungen | Reise aktiv, Kalender verfügbar (Default oder ausgewählt). |
| Postbedingungen | Leaf sichtbar, `travelLeafMode` gesetzt, Daten synchronisiert. |
| Datenänderungen | `travelLeafVisible`, `travelLeafMode`, `travelRange`, `travelPendingEvents`, `travelCurrentTimestamp`, `travelQuickStep`. |

**Hauptfluss**
1. Bei Reise-Start sendet Cartographer Hook → Leaf mountet automatisch (Split-pane neben Travel-Hauptansicht).
2. Toolbar (Icon Buttons) ermöglicht Moduswechsel (Monat/Woche/Tag/Nächste Ereignisse) sowie Quick-Steps „±1 Tag“, „±1 Stunde“, „±15 Minuten“. Shortcuts: `Ctrl+Alt+Shift+1..4` für Modi, `Ctrl+Alt+.`/`,` für Stunden, `Ctrl+Alt+;`/`'` für Minuten.
3. Inhalt pro Modus (siehe [Wireframes §Cartographer › Travel](./WIREFRAMES.md#cartographer-travel))
   - Monat: komprimiertes Grid, maximal 4 Wochen sichtbar, horizontales Scrollen falls nötig, Tooltips zeigen Uhrzeiten der ersten Events pro Tag.
   - Woche: Listen-Layout mit Tagen, Ereigniskarten inklusive Startzeit-Badge.
   - Tag: vertikale Timeline (Minutenraster), Buttons „-1 Tag“, „+1 Tag“, „-1 Stunde“, „+1 Stunde“, „±15 Minuten“, „Zeitsprung…“.
   - Nächste Ereignisse: Liste mit Prioritätsbadges, Startzeit, Buttons „Nacharbeiten“ / „Zum Zeitpunkt springen“.
4. Travel-Leaf zeigt Statusbanner (z.B. „Kein Default verfügbar“) und synchronisiert Quick-Actions.
5. Beim Reise-Ende → Leaf unmountet automatisch, Zustand persistiert für nächsten Start.

**Fehler-/Leerstaaten**
- Kein Kalender → Kompakter Leerstaat „Kein Kalender ausgewählt“ + CTA „Manager öffnen“.
- Ladefehler → Banner „Daten konnten nicht geladen werden“ mit Retry.

### 3.15 Reise-Sync (Cartographer)
| Element | Beschreibung |
| --- | --- |
| Ziel | Bidirektionale Synchronisation von Zeitfortschritt, Hooks und UI-Feedback zwischen Cartographer und Calendar. |
| Trigger | `advanceTime`, `setDate`, Reise-Start/-Ende Hooks, Travel-Leaf Interaktionen. |
| Vorbedingungen | Cartographer-Reise aktiv. |
| Postbedingungen | Zeitwerte synchronisiert, Ereignisse im Travel-Panel angezeigt, Hooks dispatcht. |
| Datenänderungen | `currentTimestamp`, `triggeredEvents`, `cartographerStatus`, `lastAdvanceStep`. |

**Hauptfluss**
1. Cartographer ruft `CalendarStateGateway.advanceTime` auf.
2. Domain berechnet neuen Timestamp (inkl. Minuten-Roll-over), Events, Hooks. Travel-Leaf zeigt Loading Spinner mit Fortschritt „Berechne {minutes} Minuten“.
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
| Almanac (global) | Modus konnte nicht geladen werden | Full-width Banner + Button „Erneut versuchen“ (ruft `loadSnapshot`) |
| Events-Modus | Keine Phänomene | Illustration + CTA „Phänomen hinzufügen“ + Sekundäraktion „Aus Vorlage importieren“ |
| Events-Modus | Ladefehler | Sticky-Banner mit Retry + Link „Fehlerdetails“ (öffnet Log) |
| Events-Modus | Export fertig | Toast „Export bereit“ + Button „Download“ |
| Manager – Kalenderansicht | Laden fehlgeschlagen | Inline-Error-Badge in Toolbar + Retry |
| Manager – Übersicht | Filter ohne Treffer | Tabelle ersetzt durch Card „Keine Treffer“ + Button „Filter zurücksetzen“ |
| Travel-Leaf | Kein Kalender/Default | Kompakter Text + CTA „Kalender wählen“ (öffnet Dropdown) |
| Travel-Leaf | Events übersprungen | Sticky-Banner mit Liste (max 3 Items) + Button „Nacharbeiten“ |
| Formular | Validierungsfehler | Inline-Message unter Feld, rote Outline, Screenreader-Text `aria-live="assertive"`; Time-Picker zeigt Tooltip „0–{hoursPerDay-1} Stunden“ |
| Dashboard/Travel | Ungültiger Quick-Step (z.B. > Limit) | Toast „Schritt überschreitet Tagesgrenze {hoursPerDay}“ + Fokus zurück auf Control |
| Global | Persistenzfehler | Toast + Link „Details anzeigen“ → öffnet Modal mit Fehlercode |

Fehlertexte sind in `i18n` unter `calendar.mode.errors.*` gepflegt. Leerstaaten verweisen auf Manager oder Event-Dialog.

## 5. Accessibility & i18n
- **Fokusmanagement**: Modale fangen Fokus (`FocusTrap`), schließen per `Esc`. Travel-Leaf setzt Fokus auf Toolbar beim Mount, Quick-Actions erhalten sichtbaren Fokusrahmen. Time-Picker erlaubt Pfeiltasten (Stunde/Minute) + `PageUp/Down` für ±10.
- **Shortcuts**: Dokumentiert in Tooltip (`aria-keyshortcuts`).
- **Screenreader**: Alle Buttons mit `aria-label`, Events in Kalenderansicht als `role="button"` + `aria-describedby` für Tooltip-Inhalte. Grid nutzt `aria-roledescription="calendar"`. Time-Picker verwendet `role="spinbutton"` mit `aria-valuemin`, `aria-valuemax`, `aria-valuenow`.
- **Tab-Reihenfolge**: Header → Toolbar → Hauptinhalte → Sidebar; in Kalenderansicht rotiert Tab durch Events, Shift+Tab zurück zur Toolbar.
- **Kontraste**: Verwendung `ui/tokens` (primär 4.5:1), Travel-Leaf komprimierte Typografie min 12px/0.75rem.
- **i18n**: Keys `calendar.manager.*`, `calendar.travel.*`, `calendar.time.*`. Datumsausgabe nutzt Domain-Formatter (schemaabhängig), 24h-Anzeige sofern Schema `hoursPerDay=24`, sonst Schema-Beschriftung (z.B. „Stunde 1..10“). Minutenwerte folgen Schema-Raster (`minuteStep`). Mehrzahl via ICU.
- **Announcements**: Moduswechsel (Manager Tabs, Travel-Leaf) triggern `aria-live="polite"` Meldungen „Kalenderansicht – Monatsansicht geladen“.

## 6. Telemetrie-Hinweise
- Zentrale User-Aktionen (Default setzen, Almanac-/Events-Moduswechsel, Travel-Leaf mount/unmount, Sub-Tages-Advance) dispatchen Events `calendar.telemetry.*` (Details siehe [STATE_MACHINE.md §Effekte](./STATE_MACHINE.md#effekte)).
- Fehler werden mit `scope` (dashboard/manager/travel) annotiert.

## 7. Verweise
- Umsetzungshinweise zu Komponenten: [COMPONENTS.md](./COMPONENTS.md)
- State- und Effektmodell: [STATE_MACHINE.md](./STATE_MACHINE.md)
- API und Persistenz: [API_CONTRACTS.md](./API_CONTRACTS.md)
- Testabdeckung: [../../tests/apps/almanac/TEST_PLAN.md](../../../tests/apps/almanac/TEST_PLAN.md)
