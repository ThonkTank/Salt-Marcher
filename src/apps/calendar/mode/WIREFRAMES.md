# Calendar Workmode – Wireframes
Dieses Dokument beschreibt die textuellen Wireframes für den Calendar-Workmode. Es ergänzt [UX_SPEC.md](./UX_SPEC.md) und verweist auf Komponenten in [COMPONENTS.md](./COMPONENTS.md).

## 1. Hinweise
- Alle Layouts basieren auf Obsidian-Panes mit 960px Breite (Standard) und beschreiben zusätzlich das Verhalten unter 520px (schmale Pane).
- Komponenten-Bezeichner entsprechen denen in der Komponenten-Spezifikation.
- Legende: `[ ]` Interaktive Elemente, `( )` Statusflächen, `{ }` Toolbars.

## 2. Dashboard
### 2.1 Normalzustand (Breit)
```
+-------------------------------------------------------------+
| {Toolbar: [Kalender ▼] [Manager öffnen] [Ereignisse verwalten]}|
+-------------------------------------------------------------+
| [CurrentTimestampCard]   | [UpcomingEventsList (max 5)]     |
| (Heute 14 Rainfall · 10:45)|--------------------------------|
| Buttons: [+1 Tag] [+1 Woche] [+1 Stunde] [+15 Min] [Datum/Zeit…]|
+---------------------------+---------------------------------+
| [EventFilterPanel]                                      []  |
| Tags ▢  Zeitraum ▢  Suche [__________]  [Filter zurücksetzen]|
+-------------------------------------------------------------+
| [EventLog]                                                 []|
| • 14 Rainfall +15 Min → 1 Event ausgelöst                   |
| • ...                                                       |
+-------------------------------------------------------------+
```

### 2.2 Leerstaat (keine Kalender)
```
+-------------------------------------------------------------+
| {Toolbar disabled}                                         |
+-------------------------------------------------------------+
| (Illustration)                                             |
| "Noch kein Kalender erstellt"                              |
| [Kalender anlegen]  [Mehr erfahren]                        |
+-------------------------------------------------------------+
```

### 2.3 Schmale Breite (<520px)
```
+-----------------------------------+
| {Toolbar: [Kal ▼] [Mgr] [Evt]}    |
+-----------------------------------+
| [CurrentTimestampCard]            |
| Buttons als IconRow: [+1T][+7T][+1H][+15m][⋯]|
+-----------------------------------+
| Accordion "Kommende Ereignisse"   |
|  > Item                           |
+-----------------------------------+
| Accordion "Filter"               |
|  > Tags/Zeitraum/Search           |
+-----------------------------------+
```

## 3. Kalender-Manager
### 3.1 Header & Moduswechsel
```
+----------------------------------------------------------------+
| {ManagerToolbar: [← Zurück] [Kalenderansicht | Übersicht] (Tabs)}|
| {ZoomToolbar (wenn Kalenderansicht): [Monat] [Woche] [Tag] [Stunde] [Heute]}|
| {Actions: [Neuer Kalender] [Import] [Default setzen ▼]}         |
+----------------------------------------------------------------+
```

### 3.2 Kalenderansicht – Monatsmodus (Breit)
```
+----------------------------------------------------------------+
| {Breadcrumb: Kalenderansicht > Monat (Oberwasser)}             |
| {Secondary: [◀] [Heute] [▶]  Datum-Picker [···]}               |
+----------------------------------------------------------------+
|  Mo   Tu   We   Th   Fr   Sa   Su                              |
|+----+----+----+----+----+----+----+                           |
||14  |15  |16  |17  |18  |19  |20  |  Hover: Tooltip           |
|| evt|    |    |evt |    |    |    |                           |
|+----+----+----+----+----+----+----+                           |
| ...                                                          |
+----------------------------------------------------------------+
| {Inline creation hint: "Doppelklick für neues Ereignis"}      |
+----------------------------------------------------------------+
```

#### Variante Woche
```
+----------------------------------------------------------------+
| {Toolbar wie oben + Pill "Woche 5"}                            |
+----------------------------------------------------------------+
|Day Header| Timeline Stunde 00..{hoursPerDay-1}                 |
|----------|-----------------------------------------------------|
|Mo 14     | [EventCard] [EventCard overlapping stack]           |
|Di 15     | ...                                                 |
+----------------------------------------------------------------+
```

#### Variante Tag
```
+----------------------------------------------------------------+
| {Toolbar + Buttons [-1 Tag] [+1 Tag] [-1 Std] [+1 Std] [±15 Min] [Zeitsprung…]}|
+----------------------------------------------------------------+
| 00:00 |                                                        |
| 00:{minuteStep} | ...                                          |
| 02:00 | [EventCard timeline marker]                            |
| ...                                                           |
+----------------------------------------------------------------+
```

#### Leerstaat
```
+----------------------------------------------------------------+
| (Illustration) "Keine Ereignisse im ausgewählten Zeitraum."    |
| [Ereignis hinzufügen]                                         |
+----------------------------------------------------------------+
```

### 3.3 Kalenderansicht – Fehlerzustand
```
+----------------------------------------------------------------+
| {Toolbar + Banner [Fehler beim Laden der Ereignisse] [Retry]}  |
| Grid bleibt leer (Schraffur)                                   |
+----------------------------------------------------------------+
```

### 3.4 Kalender-Übersicht (Breit)
```
+----------------------------------------------------------------+
| {FilterBar: Suche [_____]  Filter [Schema ▼] [Default ▼]      }|
| {BulkActions: [Löschen] [Export] [Als Default setzen]}         |
+----------------------------------------------------------------+
|[Card] Name     Badge: Default                                 |
| Schema: 10 Tage, 4 Monate                                     |
| Actions: [Öffnen] [Bearbeiten] [Löschen]                      |
+----------------------------------------------------------------+
|[Card] ...                                                     |
+----------------------------------------------------------------+
```

#### Listenmodus (Toggle)
```
+----------------------------------------------------------------+
| Name        | Schema           | Default | Aktionen           |
|-------------|------------------|---------|--------------------|
| Ocean Tide  | 12 Monate, W=10  | ✔       | [Öffnen][Bearbeiten]|
| Desert Sun  | ...              |         | ...                |
+----------------------------------------------------------------+
```

#### Leerstaat
```
+----------------------------------------------------------------+
| (Hero) "Noch keine Kalender"                                   |
| [Kalender anlegen]  [Importieren]                              |
+----------------------------------------------------------------+
```

#### Fehlerzustand
```
+----------------------------------------------------------------+
| Banner (rot): "Kalender konnten nicht geladen werden." [Retry] |
+----------------------------------------------------------------+
```

### 3.5 Schmale Breite
```
+-----------------------------------+
| {Toolbar: [←] [Ansicht ▼] [⋮]}    |
+-----------------------------------+
| Kalenderansicht: horizontales Scroll-Grid, Tageslabel untereinander|
| Übersicht: vertikale Karten, Filter als Accordion.            |
+-----------------------------------+
```

## 4. Travel-Leaf
### 4.1 Monatsmodus (Breit 360px Leaf)
```
+----------------------------------------+
| {Header: Travel-Kalender  [Mon][Woc][Tag][Next] [×]}|
| {Sub: [◀] [Heute] [▶]  [+1 Tag] [-1 Tag] [+1 Std] [-1 Std] [+15m]}|
+----------------------------------------+
|Mo Tu We Th Fr Sa Su|                      |
|14 15 16 17 18 19 20|  (kompaktes Grid)    |
|-- evt markers --   |                      |
+----------------------------------------+
| Banner? z.B. "2 Ereignisse übersprungen" |
+----------------------------------------+
| [ActionRow: Nacharbeiten]               |
+----------------------------------------+
```

### 4.2 Wochenmodus
```
+----------------------------------------+
| Header wie oben (Woche Tab aktiv)      |
+----------------------------------------+
|Mo 14 | [EvtBadge]                      |
|Di 15 |                                 |
|...                                     |
+----------------------------------------+
```

### 4.3 Tagmodus
```
+----------------------------------------+
| Header wie oben (Tag Tab aktiv)        |
| {Controls: [-1 Tag] [+1 Tag] [-1 Std] [+1 Std] [±15m] [Zeitsprung…]}|
+----------------------------------------+
|00:00 |                                 |
|00:{minuteStep}| ...                    |
|06:00 | [Evt timeline marker]           |
|12:00 |                                 |
|18:00 |                                 |
+----------------------------------------+
```

### 4.4 „Nächste Ereignisse“
```
+----------------------------------------+
| Header wie oben (Next Tab aktiv)       |
+----------------------------------------+
|• Event Name · 10:45 (in 2 Tagen) [Nacharbeiten]|
|• Event Name · 18:00 (Heute) [Öffnen]   |
|• ...                                   |
+----------------------------------------+
```

### 4.5 Leerstaat
```
+----------------------------------------+
| (Icon) "Kein Kalender ausgewählt"      |
| [Kalender wählen]                      |
+----------------------------------------+
```

### 4.6 Fehlerzustand
```
+----------------------------------------+
| Banner (rot): "Travel-Daten nicht verfügbar." [Retry]|
| Link: [Manager öffnen]                               |
+----------------------------------------+
```

### 4.7 Schmale Breite (<300px)
- Header Buttons werden zu Icons ohne Text, Quick-Steps bündeln sich in Dropdown „Zeit“ (Einträge ±1 Tag, ±1 Std, ±15m).
- Grid zeigt nur 3 Spalten, horizontales Scrollen.
- Banner collapsible.

## 5. Verweise
- Komponenten: [COMPONENTS.md](./COMPONENTS.md#calendar-ui-komponenten)
- State: [STATE_MACHINE.md](./STATE_MACHINE.md#zustandsuebersicht)
- UX-Flows: [UX_SPEC.md](./UX_SPEC.md)
