# Calendar Workmode – Textuelle Wireframes
Dieses Dokument beschreibt Blocklayouts, Zustandsvarianten und Responsive-Verhalten der Screens. Es ergänzt die [UX-Spezifikation](./UX_SPEC.md) und dient als Referenz für das Styling mit Komponenten aus `src/ui`.

## 1. Dashboard (Normalzustand)
```
┌───────────────────────────────────────────────────────────────────────┐
│ Header: [Kalender-Dropdown] [Quick Actions: +1 Tag | +1 Woche | Datum] │
├───────────────┬───────────────────────────────────────────────────────┤
│ Aktuelles     │ Kommende Ereignisse                                   │
│ Datum Panel   │ ┌───────────────────────────────────────────────────┐ │
│ ┌───────────┐ │ │ Tabellenkopf: Datum | Titel | Typ | Aktionen      │ │
│ │ Tag 123   │ │ │---------------------------------------------------│ │
│ │ Monat XYZ │ │ │ Zeilen mit Badge, Hook-Icons, Button „Öffnen“     │ │
│ │ Woche KW  │ │ └───────────────────────────────────────────────────┘ │
│ └───────────┘ │                                                       │
├───────────────┴───────────────────────────────────────────────────────┤
│ Quick Actions Secondary: [Kalender verwalten] [Ereignisse verwalten]  │
├───────────────────────────────────────────────────────────────────────┤
│ Ereignislog (Accordion)                                               │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ Liste ausgelöster Ereignisse mit Zeitstempel, Hook-Status         │ │
│ └───────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

### Leerstaaten
- **Keine Kalender**: Header zeigt Callout „Kein Kalender“ mit CTA „Kalender anlegen“.
- **Keine kommenden Ereignisse**: Panel ersetzt Tabelle durch Icon + Text „Keine kommenden Ereignisse“ + CTA „Ereignis hinzufügen“.

### Fehlerzustand
- Banner am oberen Rand bei `io_error`; Quick Actions disabled bis Retry.

### Responsive (schmale Pane ≤ 480px)
- Quick Actions in Overflow-Menü (Kebab).
- Panel „Kommende Ereignisse“ unter „Aktuelles Datum“ gestapelt.
- Tabelle ersetzt durch Cards (Datum, Titel, Aktionen). Scrollbar vertikal.

## 2. Kalender-Manager
### Listenansicht
```
┌─────────────────────────────────────────────┐
│ Header: „Kalender verwalten“ [Neu] [Import] │
├─────────────┬───────────────┬───────────────┬──────────┬─────────────┤
│ Name        │ Wochenlänge   │ Monate        │ Nutzung  │ Aktionen    │
│-------------│---------------│---------------│----------│-------------│
│ Hauptreich  │ 7             │ 12            │ Global   │ Bearbeiten  │
│ Handelsbund │ 10            │ 8             │ Reise x2 │ Duplizieren │
└─────────────┴───────────────┴───────────────┴──────────┴─────────────┘
```
- Footer mit Hinweis „Kalender werden in `/data/calendar.json` gespeichert“.

### Formular (Neu/Bearbeiten)
```
┌───────────────────────────── Modal ─────────────────────────────┐
│ Titel: Kalender anlegen                                        │
├─────────────────────────────────────────────────────────────────┤
│ Tab-Leiste: [Grunddaten] [Monate] [Schaltregeln]                │
│                                                                 │
│ Grunddaten:                                                     │
│ Name [________]  Wochenlänge [__]  Startdatum [Datepicker]      │
│ Checkbox [ ] Als aktiv setzen                                   │
│                                                                 │
│ Vorschau (rechte Spalte, sticky):                               │
│ ┌──────────────┐                                                │
│ │ Wochenansicht│                                                │
│ │ Monatsliste  │                                                │
│ └──────────────┘                                                │
│                                                                 │
│ Footer: [Abbrechen] [Speichern] [Mehr Optionen ▾]               │
└─────────────────────────────────────────────────────────────────┘
```

### Varianten
- **Duplizieren**: Info-Banner „Basierend auf XYZ“ unter Titel.
- **Konfliktwarnung**: Inline-Table unter Formular mit Konfliktliste.

### Responsive
- Modal nutzt vertikales Layout: Tabs als Dropdown, Vorschau unter Formular, Buttons in zwei Reihen.

## 3. Event-Manager
### Tab-Container
```
┌──────────────────────────────────────────────┐
│ Header: „Ereignisse“ [Neu] [Filter ▾] [Vorlagen importieren]   │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│ Tabs: Kommend│ Alle         │ Vorlagen     │ Suche [🔍 ____]     │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│ Tab-Inhalt (Beispiel „Kommend“):                               │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Tabelle mit Datum, Titel, Regeltyp, Tags, Aktionen        │ │
│ └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Leerstaaten
- **Keine Events**: Illu-Placeholder + CTA „Ereignis hinzufügen“.
- **Vorlagen leer**: Hinweis „Noch keine Vorlagen importiert“ + CTA „Vorlage laden“.

### Fehlerzustände
- Recurrence-Konflikt: Banner über Tabelle „Konflikt erkannt“ mit Button „Konflikte anzeigen“.

### Formulare
#### Einmalig
```
┌─────────────── Modal: Ereignis hinzufügen ────────────────┐
│ Tabs: [Einmalig] [Wiederkehrend] [Vorlage laden]          │
├───────────────────────────────────────────────────────────┤
│ Titel [___________]                                       │
│ Datum [DayPicker ▾]                                       │
│ Kategorie [Dropdown]  Tags [TagInput]                     │
│ Notiz [Textarea]                                          │
│ [ ] Weitere Ereignis direkt anlegen                       │
├───────────────────────────────────────────────────────────┤
│ Footer: [Abbrechen] [Speichern]                           │
└───────────────────────────────────────────────────────────┘
```

#### Wiederkehrend
```
┌──────── Modal: Wiederkehrendes Ereignis ────────┐
│ Titel [________]                                │
│ Regeltyp [Dropdown]                             │
│ ┌─ Regelparameter Pane ───────────────────────┐ │
│ │ Annual Offset: Monat [▾] Tag [▾]            │ │
│ │ oder Monthly: Woche #[▾] Tag [▾]            │ │
│ │ Weekly: Tag [▾]                              │ │
│ │ Custom: Hook-ID [____] Payload [JSON editor] │ │
│ └──────────────────────────────────────────────┘ │
│ Startdatum optional [Datepicker]               │
│ Endbedingungen [Checkbox + Inputs]             │
├────────────────────────────────────────────────┤
│ Vorschau Panel rechts: Liste nächster 5 Termine│
├────────────────────────────────────────────────┤
│ Footer: [Abbrechen] [Speichern]                │
└────────────────────────────────────────────────┘
```

### Responsive
- Tabs in Dropdown, Tabelle als Cards; Vorschau Panel unter Formular.

## 4. Zeit-Dialoge
### Advance Dialog
```
┌─────────────── Zeit fortschreiten ───────────────┐
│ Radiogroup:                                     │
│ (•) +1 Tag  ( ) +1 Woche  ( ) Benutzerdefiniert │
│ Benutzerdefiniert: Wert [__] Einheit [▾]        │
│ Checkbox [x] Ereignisse automatisch auslösen    │
│ Zusammenfassung Panel                           │
│ ┌─────────────────────────────────────────────┐ │
│ │ Neuer Datum: Tag 125 Monat 5                │ │
│ │ Ausgelöste Events: 2 (Liste einklappbar)    │ │
│ └─────────────────────────────────────────────┘ │
├────────────────────────────────────────────────┤
│ Footer: [Abbrechen] [Fortschreiten]             │
└────────────────────────────────────────────────┘
```

### Jump Dialog
```
┌────────────── Datum setzen ──────────────┐
│ Datepicker (Monat ▾ Tag ▾ Jahr ▾)        │
│ Checkbox [x] Übersprungene Events ausführen │
│ Hinweisbox bei >500 Events Warnung       │
│ Liste übersprungener Events (scrollbar)  │
├──────────────────────────────────────────┤
│ Footer: [Abbrechen] [Setzen]             │
└──────────────────────────────────────────┘
```

### Fehlerzustände
- Inline unter Datepicker: „Datum existiert nicht im aktuellen Schema“.
- Warnbanner bei Hook-Fehler: „3 Ereignisse konnten nicht ausgelöst werden“ + Retry.

### Responsive
- Dialoge Vollbreite (Mobile-Modal), Zusammenfassung unter Inputs.

## 5. Reise-Sync Feedback im Travel-Panel
```
┌────────────── Travel-Panel Feedback ─────────────┐
│ Badge: [Kalender aktiv: Handelsbund]             │
│ Aktuelles Datum: Tag 42 Monat 3                  │
│ Zeitbuttons: [-1 Tag] [+1 Tag] [Datum setzen]    │
│ Ereignis-Benachrichtigungen (Stacked Cards):    │
│ ┌─────────────────────────────────────────────┐ │
│ │ Titel: Markttag                              │ │
│ │ Datum & Hook-Status                          │ │
│ │ Actions: [Bestätigen] [Details]              │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```
- Bei Fehlern rotes Banner „Kalendersync fehlgeschlagen“.
- Responsive: Buttons als Icon-Only, Cards collapse zu Liste.

## 6. Interaktionshinweise
- Tooltips für Quick Actions: „Shift+Alt+. für +1 Tag“.
- Kontextmenüs (Right-Click) auf Ereignislisten: „Bearbeiten“, „Duplizieren“, „Löschen“.
- Drag & Drop nicht vorgesehen (Assumption: Priorität gering, kann später ergänzt werden).
