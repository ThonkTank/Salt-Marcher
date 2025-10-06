# Calendar Workmode – UX Spezifikation
Diese Spezifikation definiert UI-Verhalten, Nutzer:innenflüsse und Interaktionen für den Calendar-Workmode. Sie ergänzt den [Implementierungsplan](../IMPLEMENTATION_PLAN.md) und verweist auf [Wireframes](./WIREFRAMES.md), [Komponenten](./COMPONENTS.md) sowie die [Zustandsmaschine](./STATE_MACHINE.md).

## 1. Übersicht
- Primary Persona: Spielleitung, die Reisen im Cartographer plant und Ereignisse verwaltet.
- Kontext: Obsidian-Leaf im Calendar-Workmode oder eingebettet in das Cartographer-Travel-Panel.
- UI-Bausteine: Verwendung vorhandener Komponenten aus `src/ui` (Tables, Buttons, Toggles, Modals) mit ergänzenden Calendar-spezifischen Wrappern.

## 2. Artefakt-Mapping
| Artefakt | Zweck | Referenz |
| --- | --- | --- |
| Wireframes | Visuelle Struktur & Layout | [./WIREFRAMES.md](./WIREFRAMES.md) |
| Komponenten | Props/Events & Composition | [./COMPONENTS.md](./COMPONENTS.md) |
| Zustandsmaschine | State-Slices, Events, Effekte | [./STATE_MACHINE.md](./STATE_MACHINE.md) |
| API-Contracts | Domain- & Gateway-Schnittstellen | [./API_CONTRACTS.md](./API_CONTRACTS.md) |
| Testplan | Abdeckung & Akzeptanzprüfung | [../../tests/apps/calendar/TEST_PLAN.md](../../../tests/apps/calendar/TEST_PLAN.md) |

## 3. Workflows
Jeder Workflow beschreibt Ziel, Trigger, Vorbedingungen, Flüsse, Fehler und Postbedingungen. Akzeptanzkriterien sind als Gherkin-nahe Checkliste angefügt.

### 3.1 Aktiven Kalender wählen
| Element | Beschreibung |
| --- | --- |
| Ziel | Nutzer:in wählt den aktiven Kalender für den globalen Kontext oder eine Reise. |
| Trigger | Dropdown in der Dashboard-Toolbar, Command Palette (`calendar:select-active`), Reise-Setup im Travel-Panel. |
| Vorbedingungen | Mindestens ein Kalender ist vorhanden; Reise kann optional einen vordefinierten Kalender haben. |
| Postbedingungen | `activeCalendarId` im `CalendarStateGateway` aktualisiert; Dashboard lädt `currentDate` und Ereignisse neu. |
| Datenänderungen | Persistenter Status `activeCalendarId`; optional Reise-Metadatum (`travel.activeCalendarId`). |

**Hauptfluss**
1. Nutzer:in öffnet Auswahl (Dropdown oder Command Palette).
2. Liste zeigt alle Kalender + Metadaten (Name, Wochenlänge, Kennzeichnung "Reise"/"Global").
3. Auswahl speichert `activeCalendarId` via Gateway.
4. Presenter lädt Schema, Datum, Events; UI zeigt Ladeindikator, dann aktualisierte Ansicht.

**Alternativflüsse**
- *Kein Kalender verfügbar*: Dropdown zeigt Leerstaat mit CTA „Kalender anlegen“ (Modal öffnet). Auswahl ist disabled.
- *Reisespezifisch*: Wenn Workflow innerhalb einer Reise ausgelöst wird, erscheint Option „Reise überschreibt globalen Kalender“. Bestätigung erfordert Toggle.

**Fehlerzustände**
- Persistenzfehler → Inline-Banner „Kalender konnte nicht geladen werden. [Erneut versuchen]“.
- Konflikt: Reise nutzt Kalender, der gelöscht wurde → Dialog fordert Neuauswahl.

**Ablaufdiagramm (textuell)**
`Start → Auswahl öffnen → (Kalender vorhanden?) → [Nein] Leerstaat anzeigen → Ende` / `[Ja] Kalender auswählen → Gateway.updateActiveCalendar → UI reload → Ende`

**Akzeptanzkriterien**
- [ ] Given ein aktiver Reise- oder globaler Kontext, When Nutzer:in einen Kalender wählt, Then Dashboard wird aktualisiert und Auswahl bleibt persistent.
- [ ] Given keine Kalender existieren, When Nutzer:in das Dropdown öffnet, Then erscheint der Leerstaat mit CTA und keine Auswahl ist möglich.

### 3.2 Neuen Kalender anlegen
| Element | Beschreibung |
| --- | --- |
| Ziel | Kalender-Schema (Monate, Wochenlänge, Schaltregeln) definieren und speichern. |
| Trigger | CTA im Dashboard-Leerstaat, Button „Kalender anlegen“ im Manager, Command `calendar:new`. |
| Vorbedingungen | Nutzer:in befindet sich im Calendar-Workmode oder Reise-Setup. |
| Postbedingungen | Neuer Eintrag im Repository; optional direkt als aktiv markiert. |
| Datenänderungen | Insert in `CalendarRepository` (`CalendarSchema`, Defaultdatum, optionale Startereignisse). |

**Hauptfluss**
1. Modal öffnet Formular mit Tabs „Grunddaten“, „Monate“, „Schaltregeln“.
2. Nutzer:in füllt Pflichtfelder aus (Name, Wochenlänge, Startdatum, Monate mit Länge und Bezeichnung).
3. Live-Vorschau rechts zeigt resultierende Wochen/Monatsstruktur.
4. Validierung prüft Summen, Wochenlänge (>0), eindeutige Monatsnamen.
5. Speichern persistiert Schema, schließt Modal und zeigt Toast „Kalender erstellt“.

**Alternativflüsse**
- Klick auf „Duplizieren“ (aus Manager) füllt Formular mit bestehenden Werten.
- „Als aktiv setzen“ Checkbox: nach Speichern `activeCalendarId` aktualisieren.

**Fehlerzustände**
- Validierungsfehler: Inline unter Feld, z.B. „Monatslänge muss ≥1 sein“.
- Persistenzfehler: Modal bleibt offen, Banner „Speichern fehlgeschlagen“ mit Retry.

**Ablaufdiagramm (textuell)**
`Start → Formular ausfüllen → Validierung OK? → [Nein] Fehler anzeigen → zurück zu Formular` / `[Ja] Repository.createCalendar → (Als aktiv?) → Gateway.setActive → Modal schließen → Ende`

**Akzeptanzkriterien**
- [ ] Given der Kalender-Manager ist geöffnet, When valide Daten gespeichert werden, Then erstellt das System den Kalender und zeigt Erfolgsmeldung.
- [ ] Given ungültige Eingaben vorliegen, When Speichern ausgelöst wird, Then bleibt Modal offen und markiert fehlerhafte Felder.

### 3.3 Ereignis anlegen
#### 3.3.1 Einmaliges Ereignis
| Element | Beschreibung |
| --- | --- |
| Ziel | Einzelnes Ereignis an einem absoluten Datum hinzufügen. |
| Trigger | Button „Ereignis hinzufügen“ im Event-Manager → Tab „Einmalig“. |
| Vorbedingungen | Aktiver Kalender vorhanden; Datum innerhalb Schema. |
| Postbedingungen | Ereignis in Listen „Alle“ und (falls zukünftig) „Kommend“; Hooks registriert. |
| Datenänderungen | Insert `CalendarEventSingle` im Repository.

**Hauptfluss**
1. Modal zeigt Formular (Titel, Datum-Picker, Kategorie, Tags, Notiz).
2. Datum-Picker nutzt Schema (Monats-/Tagesauswahl basierend auf Kalender).
3. Speichern persistiert Event, schließt Modal, UI aktualisiert Listen.

**Alternativflüsse**
- „Weitere Ereignis anlegen“ Checkbox: speichert und leert Formular (Modal bleibt offen).
- Datum in Vergangenheit: UI markiert mit Badge „Vergangen“ und fragt „Jetzt nacharbeiten?“.

**Fehlerzustände**
- Datum außerhalb Schema → Inline-Fehler.
- Persistenzfehler → Banner oben im Modal.

**Ablaufdiagramm (textuell)**
`Start → Formular ausfüllen → validateDateWithinSchema → (Fehler?) → [Ja] Inline Error → Ende` / `[Nein] Repository.createSingleEvent → Hooks.register → Modal schließen → Ende`

**Akzeptanzkriterien**
- [ ] Given ein aktiver Kalender, When ein gültiges Datum gespeichert wird, Then erscheint das Ereignis in den Listen mit korrekter Sortierung.
- [ ] Given Datum liegt in Vergangenheit, When gespeichert, Then wird es als „Vergangen“ markiert und optional nachgearbeitet.

#### 3.3.2 Wiederkehrendes Ereignis
| Element | Beschreibung |
| --- | --- |
| Ziel | Regelbasiertes Ereignis mit Vorschau definieren. |
| Trigger | Button „Ereignis hinzufügen“ → Tab „Wiederkehrend“. |
| Vorbedingungen | Aktiver Kalender, definierte Monate/Wochen. |
| Postbedingungen | Ereignis in Listen, Recurrence-Engine aktualisiert Caches. |
| Datenänderungen | Insert `CalendarEventRecurring` (inkl. `RepeatRule`). |

**Hauptfluss**
1. Formular sammelt: Titel, Startdatum (optional), Regeltyp (Dropdown), regelabhängige Felder (Annual Offset, Monthly by position, Weekly dayIndex, Custom Hook-ID), Endkriterium (z.B. limit count).
2. Regeländerungen aktualisieren Live-Vorschau (nächste 5 Vorkommen) über Domain-Service.
3. Speichern persistiert Event und aktualisiert Recurrence-Caches.

**Alternativflüsse**
- Wechsel Regeltyp bewahrt kompatible Felder, invalidiert andere.
- Custom Hook: Modal fordert Hook-ID + Parameter JSON.

**Fehlerzustände**
- Regel kollidiert mit bestehender (identisch) → Dialog fragt „Duplikat zulassen?“; Standard: Blockieren.
- Custom Hook invalid JSON → Inline-Fehler.

**Ablaufdiagramm (textuell)**
`Start → Regel auswählen → Eingaben validieren → generatePreview → (Konflikte?) → [Ja] Konflikt-Dialog → (Bestätigt?) → [Nein] zurück → Ende / [Ja] fortsetzen` → `Repository.createRecurringEvent → Cache.update → Ende`

**Akzeptanzkriterien**
- [ ] Given valide Regelwerte, When gespeichert, Then zeigt Vorschau korrekte zukünftige Vorkommen.
- [ ] Given Konflikt erkannt, When Nutzer:in nicht bestätigt, Then wird kein Event gespeichert.

### 3.4 Zeit fortschreiten
| Element | Beschreibung |
| --- | --- |
| Ziel | Datum um definierte Schritte (Tag/Woche/Custom) verändern und Ereignisse prüfen. |
| Trigger | Quick-Actions im Dashboard („+1 Tag“, „+1 Woche“, „Benutzerdefiniert…“), Tastenkürzel (`Shift+Alt+.`), Cartographer `advanceTime` Hook. |
| Vorbedingungen | Aktiver Kalender, `currentDate` gesetzt. |
| Postbedingungen | `currentDate` aktualisiert, ausgelöste Events geloggt, Hooks dispatcht. |
| Datenänderungen | Update `currentDate`, Append zu `eventLog`, Option Persistenz der letzten Advance-Operation. |

**Hauptfluss**
1. Nutzer:in wählt Quick-Action oder öffnet Dialog „Zeit anpassen“.
2. Domain-Service `advanceTime(step)` berechnet neues Datum und Events.
3. UI zeigt Spinner bis Operation abgeschlossen.
4. Ergebnisse: Dashboard aktualisiert Datum, Panel „Ausgelöste Ereignisse“ listet Items; optional Buttons „Event öffnen“.

**Alternativflüsse**
- Benutzerdefinierter Dialog: Eingabe `stepValue` + Einheit (Tag/Woche/Monat) + Richtung (Vor/Zurück).
- Option „Ereignisse automatisch quittieren“ in Einstellungen.

**Fehlerzustände**
- Step ungültig (0) → Inline-Fehler im Dialog.
- Hook-Dispatch schlägt fehl → Log-Badge + Retry.

**Ablaufdiagramm (textuell)**
`Start → Step auswählen → Domain.advance → (Fehler?) → [Ja] Fehlerbanner → Ende / [Nein] updateDate → updateEventLog → Trigger hooks → Ende`

**Akzeptanzkriterien**
- [ ] Given Quick-Action, When Zeit voranschreitet, Then aktualisiert Dashboard Datum und Ereignislog synchron.
- [ ] Given Hook-Dispatch scheitert, When Advance abgeschlossen, Then sieht Nutzer:in Hinweis mit Retry.

### 3.5 Datum setzen/Jump
| Element | Beschreibung |
| --- | --- |
| Ziel | Direktes Datum festlegen und übersprungene Ereignisse behandeln. |
| Trigger | Button „Datum setzen“ im Dashboard, Command `calendar:set-date`, Cartographer-API-Aufruf. |
| Vorbedingungen | Aktiver Kalender, Ziel-Datum im Schema. |
| Postbedingungen | `currentDate` entspricht Ziel; Liste „Übersprungene Ereignisse“ optional zur Nachbearbeitung. |
| Datenänderungen | Update `currentDate`, Markierung `skippedEvents[]`, optional `backfillQueue`. |

**Hauptfluss**
1. Dialog zeigt Schema-konformen Datepicker + Checkbox „Übersprungene Ereignisse nachträglich auslösen“ (default aktiv).
2. Nach Auswahl berechnet Domain alle Events zwischen alt und neu.
3. UI zeigt Zusammenfassung (#Events, Hooks) und fragt Bestätigung.
4. Bei Bestätigung: `currentDate` gesetzt, `skippedEvents` ggf. in Nachbearbeitung übergeben.

**Alternativflüsse**
- Checkbox deaktiviert → Events werden nicht ausgelöst, aber im Nacharbeitungs-Panel markiert.
- Ziel-Datum vor aktuellem Datum → markiert Operation als Rücksprung.

**Fehlerzustände**
- Datum außerhalb Schema → Inline-Fehler „Datum existiert in diesem Kalender nicht“.
- Zu viele Events (Limit >500) → Warnung, erfordert Bestätigung „Trotzdem fortfahren“.

**Ablaufdiagramm (textuell)**
`Start → Datum auswählen → Domain.calculateJump → (Limit überschritten?) → [Ja] Warnung anzeigen → (Bestätigt?) ...` etc.

**Akzeptanzkriterien**
- [ ] Given Ziel-Datum, When gesetzt wird, Then werden übersprungene Ereignisse angezeigt und optional nachträglich ausgelöst.
- [ ] Given Datum ist ungültig, When Bestätigung versucht wird, Then blockiert Dialog und bleibt offen.

### 3.6 Ereignisliste filtern/suchen
| Element | Beschreibung |
| --- | --- |
| Ziel | Ereignisse nach Zeitraum, Typ, Tags filtern und durchsuchen. |
| Trigger | Filterpanel auf Dashboard/Event-Manager, Shortcut `Ctrl/Cmd+F`. |
| Vorbedingungen | Mindestens ein Ereignis vorhanden. |
| Postbedingungen | Gefilterte Listen persistieren Sitzungslokal; optional Favoritenfilter speichern. |
| Datenänderungen | Update `eventListFilter` im UI-State; optional Persistenz im lokalen Storage. |

**Hauptfluss**
1. Filterpanel klappt auf (Accordion).
2. Nutzer:in setzt Parameter: Zeitraum (Datepicker oder Quick Range), Typ (Einmalig/Wiederkehrend/Vorlagen), Tags.
3. Presenter filtert via Domain-Service (Lazy Query) und aktualisiert Tabelle live.

**Alternativflüsse**
- Quick-Filter Chips („Nächste 30 Tage“, „Feiertage“).
- Speichern als Ansicht (Button „Als Ansicht speichern“ → Name + optional Standard machen).

**Fehlerzustände**
- Keine Treffer → Leerstaat mit CTA „Filter zurücksetzen“.
- Persistenz der gespeicherten Ansicht schlägt fehl → Toast „Ansicht konnte nicht gespeichert werden“.

**Ablaufdiagramm (textuell)**
`Start → Filter öffnen → Parameter setzen → Domain.filterEvents → UI aktualisiert Liste → (0 Treffer?) → [Ja] Leerstaat → Ende`.

**Akzeptanzkriterien**
- [ ] Given aktive Filter, When Kriterien geändert werden, Then aktualisiert sich die Liste ohne Reload.
- [ ] Given keine Treffer, When Filter aktiv sind, Then erscheint Leerstaat mit Reset-Option.

### 3.7 Kalender bearbeiten (Schemaänderung + Migration)
| Element | Beschreibung |
| --- | --- |
| Ziel | Bestehenden Kalender anpassen und Ereignisse migrieren/validieren. |
| Trigger | Button „Bearbeiten“ im Kalender-Manager, Command `calendar:edit`. |
| Vorbedingungen | Kalender existiert; keine schreibenden Operationen laufen (Lock). |
| Postbedingungen | Schema aktualisiert; Migrationsergebnis (Erfolg/Fehlerliste) angezeigt. |
| Datenänderungen | Update `CalendarSchema`, `CalendarEvent` Re-Mapping (z.B. Tage verschoben). |

**Hauptfluss**
1. Modal öffnet sich mit Formular (wie „Neu“, aber pre-filled).
2. Beim Ändern von Monaten/Wochen wird Migration-Vorschau berechnet (Tabelle: Event → Status).
3. Speichern löst Domain-Migration aus (Mapping alter Daten auf neues Schema).
4. Ergebnisdialog zeigt: Anzahl migrierter Events, Konflikte (z.B. Datum nicht mehr gültig) mit Option „Konflikte öffnen“.

**Alternativflüsse**
- Nutzer:in kann Schema als neue Kopie speichern statt bestehendes zu überschreiben („Als neuen Kalender speichern“).
- Konflikte: Checkbox „Ungültige Ereignisse als Notiz behalten“.

**Fehlerzustände**
- Migration bricht ab → Modal zeigt Fehlermeldung und belässt Originaldaten.
- Lock aktiv → Hinweis „Kalender wird aktuell bearbeitet“. Save disabled.

**Ablaufdiagramm (textuell)**
`Start → Formular ändern → previewMigration → Speichern → Domain.migrateSchema → (Fehler?) → [Ja] Fehlerdialog → Ende / [Nein] Erfolg + Konfliktliste → Ende`

**Akzeptanzkriterien**
- [ ] Given Schemaänderung, When gespeichert, Then zeigt System Migrationsergebnis und aktualisiert Schema.
- [ ] Given Migration schlägt fehl, When bestätigt, Then bleiben Daten unverändert und Fehlerdetails werden angezeigt.

### 3.8 Reise-Sync (Cartographer)
| Element | Beschreibung |
| --- | --- |
| Ziel | Zeitfortschritt der Reise synchronisieren und Feedback in Travel-Panel geben. |
| Trigger | `CartographerController.advanceTime`, Travel-Panel Buttons, Hooks aus Calendar (z.B. event-triggered). |
| Vorbedingungen | Aktive Reise, `CalendarStateGateway` verbunden, Kalender ausgewählt. |
| Postbedingungen | Reisezeit aktualisiert, Kalender-Events ausgelöst, UI-Feedback (Toast, Panel-Update). |
| Datenänderungen | Update `travelState.currentDate`, Append `travel.timelineEvents[]`, optional Notizen. |

**Hauptfluss**
1. Cartographer löst `advanceTime` aus.
2. Gateway ruft Calendar-Domain `advance` auf; Ergebnisse beinhalten neue Zeit, ausgelöste Events, Hook-Benachrichtigungen.
3. Travel-Panel zeigt Banner mit Datum & Ereignissen, Calendar-Workmode synchronisiert `currentDate`.
4. Wenn Events Hooks mit Encounter/Library auslösen, werden diese Gateways benachrichtigt.

**Alternativflüsse**
- Reise ohne zugewiesenen Kalender → Cartographer fordert Auswahl an (Modal) bevor Advance fortgesetzt wird.
- Calendar offline (Persistenzfehler) → Cartographer zeigt Warnung und setzt Advance zurück.

**Fehlerzustände**
- Hook-Dispatch schlägt fehl → Travel-Panel zeigt Badge „1 Ereignis konnte nicht ausgeführt werden“.
- Cartographer sendet Advance ohne Kalender → Abbruch mit Fehlercode `calendar_missing`.

**Ablaufdiagramm (textuell)**
`Start → Cartographer.advance → Gateway.ensureCalendar → Domain.advance → Hooks.dispatch → UI Sync → Ende`

**Akzeptanzkriterien**
- [ ] Given Cartographer advanceTime, When erfolgreich, Then Travel-Panel und Calendar-Workmode zeigen synchronisierte Daten.
- [ ] Given kein aktiver Kalender, When advanceTime aufgerufen wird, Then bricht der Prozess mit Fehlercode `calendar_missing` ab und fordert Auswahl.

## 4. Fehler und Leerstaaten
| Kontext | Leerstaat-Text | CTA | Sekundäraktion |
| --- | --- | --- | --- |
| Keine Kalender | „Noch kein Kalender vorhanden.“ | „Kalender anlegen“ → öffnet Manager | Link „Mehr über Kalender“ (Docs) |
| Keine Events | „Dieser Kalender hat noch keine Ereignisse.“ | „Ereignis hinzufügen“ | Import aus Vorlage |
| Keine kommenden Events | „Keine Ereignisse im gewählten Zeitraum.“ | „Filter ändern“ | Toggle „Vergangene zeigen“ |
| Persistenzfehler | Banner: „Speichern fehlgeschlagen.“ | „Erneut versuchen“ | „Details anzeigen“ (Modal) |
| Schema invalid | Inline-Callout im Formular | Feld fokussieren | Reset auf ursprüngliche Werte |
| Recurrence-Konflikt | Dialog „Regel kollidiert mit …“ | „Trotzdem speichern“ (disabled bis Checkbox „Konflikt akzeptieren“) | „Konfliktliste öffnen“ |

## 5. Accessibility & Internationalisierung
- Tastatur: Alle modalen Dialoge fokussieren erstes interaktives Element; `Esc` schließt, `Ctrl+Enter` speichert.
- Tab-Reihenfolge siehe Komponenten-Spezifikationen; Filter-Chips sind `role="button"` mit `aria-pressed` Zuständen.
- ARIA-Rollen: Dashboard Panels als `region` mit `aria-labelledby` Überschriften; Eventlisten als `table`.
- Screenreader: Toasts nutzen `aria-live="polite"`; Fehlerbanner `aria-live="assertive"`.
- i18n: Alle sichtbaren Texte verwenden Keys `calendar.mode.*`. Platzhalter (z.B. `{count}`) unterstützen Mehrzahl; Datumswerte formatiert über Calendar-Domain (nicht locale-abhängig).
- High-Contrast: Buttons verwenden `ui/button` Variants; Status-Badges definieren `data-state` Attribute für CSS.
- Fokusmanagement bei Dialogschließung kehrt zum Trigger-Element zurück.

## 6. Referenzen & Annahmen
- Assumption: Pro Reise kann genau ein aktiver Kalender gesetzt werden; globale Auswahl gilt für neue Reisen als Default.
- Assumption: Hook-Ausführung ist synchron mit Advance, jedoch darf UI nicht blockieren → Spinner zeigt Busy-State.
- Änderungen an Domain/APIs sind in [API_CONTRACTS.md](./API_CONTRACTS.md) reflektiert.
