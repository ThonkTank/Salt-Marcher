# Almanac Workmode – Wireframes
Dieses Dokument beschreibt die textuellen Wireframes für den Almanac-Workmode. Es ergänzt [UX_SPEC.md](./UX_SPEC.md) und verweist auf Komponenten in [COMPONENTS.md](./COMPONENTS.md).

## 1. Hinweise
- Alle Layouts basieren auf Obsidian-Panes mit 960px Breite (Standard) und beschreiben zusätzlich das Verhalten unter 520px (schmale Pane).
- Komponenten-Bezeichner entsprechen denen in der Komponenten-Spezifikation.
- Legende: `[ ]` Interaktive Elemente, `( )` Statusflächen, `{ }` Toolbars.
- **NEU**: Split-View-Layout mit persistenter Kalenderansicht oben und Content-Tabs unten.

## 2. Almanac-Shell (Split-View-Layout)
### 2.1 Layout (Breit)
```
+---------------------------------------------------------------+
| {AlmanacShell}                                                |
+---------------------------------------------------------------+
| {CalendarViewContainer - Oberer Bereich (60%)}               |
| +-----------------------------------------------------------+ |
| | Tabs: [Monat▶] [Woche] [Tag] [Nächste]      [◀][Heute][▶]| |
| +-----------------------------------------------------------+ |
| | (Kalenderansicht: Monat/Woche/Tag/Nächste Events)         | |
| | Grid/Timeline/Liste mit Events                             | |
| +-----------------------------------------------------------+ |
+---------------------------------------------------------------+
| ═══════════════════════════ RESIZER ═════════════════════════|
+---------------------------------------------------------------+
| {ContentContainer - Unterer Bereich (40%)}                   |
| +-----------------------------------------------------------+ |
| | Tabs: [Dashboard] [Events] [Manager]                      | |
| +-----------------------------------------------------------+ |
| | (Content Area: Aktiver Tab-Inhalt)                        | |
| | - Dashboard: Aktuelle Zeit, Quick-Actions, Filter, Log     | |
| | - Events: Phänomene-Liste, Timeline/Table/Map              | |
| | - Manager: Kalender-Übersicht, Einstellungen              | |
| +-----------------------------------------------------------+ |
+---------------------------------------------------------------+
```

### 2.2 Layout (Schmal <520px)
```
+------------------------------------------+
| {CompactToolbar: [≡] [Modus ▼] [Einstellungen] (Travel ↗)}|
+------------------------------------------+
| [ModeSwitcherDrawer] (overlay)           |
|  Dashboard                               |
|  Manager                                 |
|  Events                                  |
|------------------------------------------|
| Hinweis: Travel-Kalender im Cartographer |
+------------------------------------------+
| {Content Area untereinander gestapelt}   |
```

### 2.3 Fehler- & Leerstaaten
```
+------------------------------------------------+
| Banner: "Modus konnte nicht geladen werden" [↻] |
| [Zurück zum Dashboard]                          |
+------------------------------------------------+
```
```
+------------------------------------------------+
| (Illustration) "Noch keine Kalender oder Phänomene" |
| [Kalender anlegen]  [Phänomen erstellen]            |
+------------------------------------------------+
```
## 3. Dashboard
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

## 4. Kalender-Manager
## 5. Events-Modus
### 5.1 Timeline-Ansicht (Breit)
```
+----------------------------------------------------------------+
| {EventsToolbar: [Timeline] [Tabelle] [Karte]  Filterchips}     |
| Zeitfenster: [◀ 90d] [Heute] [90d ▶]  [Export ▼]               |
+----------------------------------------------------------------+
|  Frühling (Kategorie: Season)                                  |
|  ├─ 14 Rainfall 10:45   [Kalender: Oberwasser] [Hook: Wetter=Regen] |
|  └─ 18 Harvest Moon 20:00 [Kalender: Oberwasser, Tiefsee]      |
|----------------------------------------------------------------|
|  Wetterfront "Sturm" (Kategorie: Weather)                      |
|  ├─ 15 Rainfall 06:00 -> 16 Rainfall 18:00                     |
|  └─ Auswirkungen: -2 Sicht, +1 Wellengang                      |
+----------------------------------------------------------------+
```

### 5.2 Tabellenansicht
```
+----------------------------------------------------------------+
| Name           | Kategorie | Kalender        | Nächstes Auftreten | Aktionen |
|----------------|-----------|-----------------|--------------------|----------|
| Harvest Moon   | Astronomy | Oberwasser      | 18 Rainfall 20:00  | [Öffnen] |
| Spring Bloom   | Season    | Alle            | 01 Bloom 08:00     | [Öffnen] |
| Storm Surge    | Weather   | Tiefsee         | 15 Tide 03:00      | [Öffnen] |
+----------------------------------------------------------------+
```

### 5.3 Karten/Heatmap-Ansicht (optional)
```
+------------------------------------------+
| Karte (Raster pro Tag)                   |
| [Day] [Night] Toggle                     |
| ◼ = Phänomen vorhanden (Kategorie-Farbe) |
| Tooltip: Name, Kalender, Auswirkungen    |
+------------------------------------------+
```

### 5.4 Leerstaat & Fehler
```
+--------------------------------------------------+
| (Illustration) "Noch keine Phänomene"             |
| [Phänomen hinzufügen]  [Aus Vorlage importieren] |
+--------------------------------------------------+
```
```
+--------------------------------------------------+
| Banner (rot): "Phänomene konnten nicht geladen werden." [Retry] |
+--------------------------------------------------+
```

### 5.5 Responsive (<520px)
```
+--------------------------------------+
| {Toolbar: [Tim][Tab][Map] [Filter]}  |
+--------------------------------------+
| Accordion "Filter"                   |
| Accordion "Nächste Phänomene"        |
| Timeline-Karten stapeln vertikal     |
+--------------------------------------+
```

### 4.1 Header & Moduswechsel
```
+----------------------------------------------------------------+
| {ManagerToolbar: [← Zurück] [Kalenderansicht | Übersicht] (Tabs)}|
| {ZoomToolbar (wenn Kalenderansicht): [Monat] [Woche] [Tag] [Stunde] [Heute]}|
| {Actions: [Neuer Kalender] [Import] [Default setzen ▼]}         |
+----------------------------------------------------------------+
```

### 4.2 Kalenderansicht – Monatsmodus (Breit)
```
+----------------------------------------------------------------+
| {ManagerHeader: Kalenderansicht · Monat (Oberwasser)}             |
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

### 4.3 Kalenderansicht – Fehlerzustand
```
+----------------------------------------------------------------+
| {Toolbar + Banner [Fehler beim Laden der Ereignisse] [Retry]}  |
| Grid bleibt leer (Schraffur)                                   |
+----------------------------------------------------------------+
```

### 4.4 Kalender-Übersicht (Breit)
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

## 6. Cartographer › Travel-Kalender {#cartographer-travel}
### 4.1 Monatsmodus (Breit 360px Leaf)
```
+----------------------------------------+
| {Header: Cartographer › Travel-Kalender  [Mon][Woc][Tag][Next] [×]}|
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

## 7. Verweise
- Komponenten: [COMPONENTS.md](./COMPONENTS.md#calendar-ui-komponenten)
- State: [STATE_MACHINE.md](./STATE_MACHINE.md#zustandsuebersicht)
- UX-Flows: [UX_SPEC.md](./UX_SPEC.md)
