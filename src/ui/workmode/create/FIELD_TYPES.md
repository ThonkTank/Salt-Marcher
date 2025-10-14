# CreateSpec Field Types & Configuration Guide

## Übersicht

Diese Dokumentation beschreibt, wie eine `*-spec.ts` Datei strukturiert sein muss, um ein deklaratives Create-Modal zu definieren. Das System verwendet TypeScript-Interfaces, um Formulare ohne imperativen DOM-Code zu erstellen.

## Grundstruktur einer Spec-Datei

```typescript
import type { CreateSpec, AnyFieldSpec, DataSchema } from "../../../ui/workmode/create/types";

// 1. Schema definieren (optional, für Validierung)
const mySchema: DataSchema<MyDataType> = {
  parse: (data: unknown) => data as MyDataType,
  safeParse: (data: unknown) => {
    try {
      return { success: true, data: data as MyDataType };
    } catch (error) {
      return { success: false, error };
    }
  },
};

// 2. Felder definieren
const fields: AnyFieldSpec[] = [
  { id: "name", label: "Name", type: "text", required: true },
  { id: "description", label: "Beschreibung", type: "textarea" },
  // ... weitere Felder
];

// 3. Spec exportieren
export const mySpec: CreateSpec<MyDataType> = {
  kind: "my-entity",
  title: "Entity erstellen",
  subtitle: "Neue Entity für deine Kampagne",
  schema: mySchema,
  fields: fields,
  storage: {
    format: "md-frontmatter",
    pathTemplate: "SaltMarcher/MyEntities/{name}.md",
    filenameFrom: "name",
    directory: "SaltMarcher/MyEntities",
    frontmatter: ["name", "description", "customField"],
  },
  ui: {
    submitLabel: "Erstellen",
    cancelLabel: "Abbrechen",
    enableNavigation: true,
    sections: [
      {
        id: "basic",
        label: "Grunddaten",
        description: "Basisinformationen",
        fieldIds: ["name", "description"],
      },
    ],
  },
};
```

## CreateSpec Interface

### Erforderliche Eigenschaften

```typescript
interface CreateSpec<TData> {
  // Eindeutiger Identifier für diese Spec
  kind: string;

  // Titel des Modals
  title: string;

  // Felddefintionen
  fields: AnyFieldSpec[];

  // Storage-Konfiguration
  storage: StorageConfig;
}
```

### Optionale Eigenschaften

```typescript
interface CreateSpec<TData> {
  // Untertitel (wird unter dem Titel angezeigt)
  subtitle?: string;

  // Schema für Validierung und Type-Safety
  schema?: DataSchema<TData>;

  // UI-Konfiguration (Navigation, Buttons, Sections)
  ui?: {
    submitLabel?: string;      // Standard: "Erstellen"
    cancelLabel?: string;       // Standard: "Abbrechen"
    enableNavigation?: boolean; // Standard: false
    sections?: SectionSpec[];   // Für Tab-Navigation
  };
}
```

## Feld-Typen (Field Types)

### 1. **text** - Einzeiliges Textfeld

Für kurze Texteingaben wie Namen, IDs, oder einfache Werte.

```typescript
{
  id: "name",
  label: "Name",
  type: "text",
  placeholder: "Namen eingeben...",
  required: true,
  default: "",
}
```

**Eigenschaften:**
- `placeholder?: string` - Platzhaltertext
- `default?: string` - Standardwert

---

### 2. **textarea** - Mehrzeiliges Textfeld

Für längere Texteingaben wie Beschreibungen oder Notizen.

```typescript
{
  id: "description",
  label: "Beschreibung",
  type: "textarea",
  placeholder: "Beschreibung eingeben...",
  config: {
    rows: 5,
    minHeight: 100,
  },
}
```

**Config-Optionen:**
- `rows?: number` - Anzahl der sichtbaren Zeilen (Standard: 4)
- `minHeight?: number` - Minimale Höhe in Pixeln

---

### 3. **markdown** - Markdown-Editor

Für formatierte Texteingaben mit Markdown-Unterstützung.

```typescript
{
  id: "notes",
  label: "Notizen",
  type: "markdown",
  placeholder: "Markdown eingeben...",
  config: {
    enablePreview: true,
  },
}
```

**Config-Optionen:**
- `enablePreview?: boolean` - Preview-Modus aktivieren (Standard: false)

---

### 4. **number-stepper** - Zahleneingabe mit Buttons

Für numerische Werte mit Inkrement/Dekrement-Buttons.

```typescript
{
  id: "level",
  label: "Level",
  type: "number-stepper",
  min: 1,
  max: 20,
  step: 1,
  default: 1,
}
```

**Eigenschaften:**
- `min?: number` - Minimalwert
- `max?: number` - Maximalwert
- `step?: number` - Schrittweite (Standard: 1)
- `default?: number` - Standardwert

---

### 5. **select** - Dropdown-Auswahl (Einfach)

Für Einzelauswahl aus vordefinierten Optionen.

```typescript
{
  id: "size",
  label: "Größe",
  type: "select",
  options: [
    { value: "small", label: "Klein" },
    { value: "medium", label: "Mittel" },
    { value: "large", label: "Groß" },
  ],
  default: "medium",
}
```

**Eigenschaften:**
- `options: Array<{ value: string; label: string }>` - Auswahl-Optionen (erforderlich)
- `default?: string` - Standardwert (muss ein `value` aus `options` sein)

---

### 6. **multiselect** - Mehrfachauswahl

Für Mehrfachauswahl aus vordefinierten Optionen.

```typescript
{
  id: "tags",
  label: "Tags",
  type: "multiselect",
  options: [
    { value: "combat", label: "Kampf" },
    { value: "social", label: "Sozial" },
    { value: "exploration", label: "Erkundung" },
  ],
  default: [],
}
```

**Eigenschaften:**
- `options: Array<{ value: string; label: string }>` - Auswahl-Optionen (erforderlich)
- `default?: string[]` - Standardwerte (Array von `value`s aus `options`)

---

### 7. **toggle** - Boolean-Schalter

Für Ja/Nein- oder An/Aus-Werte.

```typescript
{
  id: "isActive",
  label: "Aktiv",
  type: "toggle",
  default: true,
}
```

**Eigenschaften:**
- `default?: boolean` - Standardwert (Standard: false)

---

### 8. **color** - Farbwähler

Für Farbauswahl mit Hex-Code.

```typescript
{
  id: "themeColor",
  label: "Farbe",
  type: "color",
  default: "#3b82f6",
}
```

**Eigenschaften:**
- `default?: string` - Standardfarbe als Hex-Code (Standard: "#000000")

---

### 9. **tags** - Chips/Token-Editor

Für dynamische Liste von Text-Tags mit optionalen Vorschlägen.

```typescript
{
  id: "languages",
  label: "Sprachen",
  type: "tags",
  placeholder: "Sprache hinzufügen...",
  config: {
    suggestions: ["Gemeinsam", "Elfisch", "Zwergisch", "Orkisch"],
  },
  default: [],
}
```

**Config-Optionen:**
- `suggestions?: string[]` - Vorschlagsliste für Autovervollständigung
- **Keyboard-Navigation:** ↑/↓ für Navigation, Enter zum Auswählen, Escape zum Schließen

**Eigenschaften:**
- `placeholder?: string` - Platzhaltertext
- `default?: string[]` - Standard-Tags

---

### 10. **structured-tags** - Strukturierte Token mit Typ und Wert

Für dynamische Listen von strukturierten Token, bei denen jeder Token einen Typ (aus Vorschlägen) und einen editierbaren Wert hat. Ideal für Bewegungsraten, Skill-Boni, Schadensresistenzen mit Bedingungen, etc.

```typescript
{
  id: "speeds",
  label: "Bewegungsraten",
  type: "structured-tags",
  placeholder: "Bewegungsart auswählen...",
  config: {
    suggestions: [
      { key: "walk", label: "Gehen" },
      { key: "fly", label: "Fliegen" },
      { key: "swim", label: "Schwimmen" },
      { key: "climb", label: "Klettern" },
      { key: "burrow", label: "Graben" },
    ],
    valueConfig: {
      placeholder: "z.B. 30 ft.",
      unit: "ft.",  // Optional: wird nach dem Input angezeigt
    },
  },
  default: [],
}
```

**Config-Optionen:**
- `suggestions: Array<{ key: string; label: string }>` - Vorschläge für Token-Typen (erforderlich)
- `valueConfig.placeholder?: string` - Platzhaltertext für Wert-Input
- `valueConfig.unit?: string` - Optionale Einheit, die nach dem Wert angezeigt wird (z.B. "ft.", "%", "m")
- `valueConfig.pattern?: string` - Regex-Pattern für Validierung (noch nicht implementiert)

**Eigenschaften:**
- `placeholder?: string` - Platzhaltertext für Typ-Auswahl
- `default?: Array<{ type: string; value: string }>` - Standard-Tokens

**Features:**
- **Autocomplete:** Typ-Auswahl mit Filterfunktion (nach key oder label)
- **Keyboard-Navigation:** ↑/↓ für Navigation in Vorschlägen, Enter zum Auswählen, Tab zum Wert-Input wechseln
- **Auto-sizing Value Input:** Passt sich automatisch an Inhaltslänge an (min. 3 Zeichen)
- **Inline-Editing:** Werte können direkt im Chip bearbeitet werden
- **Optional Unit Label:** Zeigt Einheit neben dem Wert an (z.B. "30 ft.")

**Darstellung:**
```
[Gehen] [30] ft. [×]
[Fliegen] [60] ft. [×]
```

**Datenformat:**
Speichert als Array von Objekten: `[{ type: "walk", value: "30" }, { type: "fly", value: "60" }]`

**Anwendungsfälle:**
- Bewegungsraten mit verschiedenen Fortbewegungsarten
- Skill-Boni mit verschiedenen Skills
- Schadensresistenzen mit Bedingungen (z.B. "Feuer (nur bei Regen)")
- Jede Situation, wo Typ + Wert kombiniert werden müssen

---

### 11. **composite** - Gruppierte Felder

Für zusammenhängende Felder, die als Gruppe dargestellt werden (z.B. Attribute).

```typescript
{
  id: "abilities",
  label: "Attribute",
  type: "composite",
  config: {
    fields: [
      { id: "str", label: "STR", type: "number-stepper", min: 1, max: 30, default: 10 },
      { id: "dex", label: "DEX", type: "number-stepper", min: 1, max: 30, default: 10 },
      { id: "con", label: "CON", type: "number-stepper", min: 1, max: 30, default: 10 },
      { id: "int", label: "INT", type: "number-stepper", min: 1, max: 30, default: 10 },
      { id: "wis", label: "WIS", type: "number-stepper", min: 1, max: 30, default: 10 },
      { id: "cha", label: "CHA", type: "number-stepper", min: 1, max: 30, default: 10 },
    ],
  },
}
```

**Config-Optionen:**
- `fields: AnyFieldSpec[]` - Liste von Feld-Spezifikationen (erforderlich)

**Hinweis:** Composite-Felder werden in einem Grid-Layout mit automatischem Umbruch dargestellt.

---

### 12. **repeating** - Dynamische Liste

Für Listen von Einträgen, die der Benutzer hinzufügen/entfernen/umsortieren kann (z.B. Aktionen, Zauber).

```typescript
{
  id: "actions",
  label: "Aktionen",
  type: "repeating",
  config: {
    categories: [
      { id: "action", label: "Aktion" },
      { id: "bonus", label: "Bonusaktion" },
      { id: "reaction", label: "Reaktion" },
    ],
    card: createActionCardConfig, // Funktion für Card-Rendering
    insertPosition: "end", // oder "start"
  },
  itemTemplate: {
    category: { type: "select", default: "action" },
    name: { type: "text", default: "" },
    description: { type: "textarea", default: "" },
  },
  default: [],
}
```

**Config-Optionen:**
- `categories: Array<{ id: string; label: string }>` - Kategorien für neue Einträge (erforderlich)
- `card?: EntryCardConfigFactory` - Funktion für Custom-Rendering (optional)
- `insertPosition?: "start" | "end"` - Position für neue Einträge (Standard: "start")
- `filters?: Array<{ id: string; label: string; hint?: string; predicate: (entry) => boolean }>` - Filter-Optionen

**Eigenschaften:**
- `itemTemplate: Record<string, { type: string; default: any }>` - Template für neue Einträge (erforderlich)
- `default?: any[]` - Standard-Einträge

**Custom Card Rendering:**
```typescript
import { createEntryCardRenderer, type EntryCardConfigFactory } from "../components/entry-system";

const createActionCardConfig: EntryCardConfigFactory<ActionEntry> = (context) => ({
  type: (ctx) => ctx.entry.category,
  badge: (ctx) => ({ text: ctx.entry.category.toUpperCase(), variant: ctx.entry.category }),
  renderName: (nameBox, ctx) => {
    const input = nameBox.createEl("input", {
      type: "text",
      placeholder: "Aktionsname",
      value: ctx.entry.name,
    });
    input.addEventListener("input", (e) => {
      ctx.entry.name = (e.target as HTMLInputElement).value;
      ctx.requestRender();
    });
    return input;
  },
  renderBody: (card, ctx) => {
    const textarea = card.createEl("textarea", {
      placeholder: "Beschreibung...",
      value: ctx.entry.description,
    });
    textarea.addEventListener("input", (e) => {
      ctx.entry.description = (e.target as HTMLTextAreaElement).value;
    });
  },
});
```

---

### 13. **autocomplete** - Textfeld mit Vorschlägen

Für Texteingabe mit Autovervollständigung aus vordefinierten Werten.

```typescript
{
  id: "spellSchool",
  label: "Schule",
  type: "autocomplete",
  placeholder: "Schule auswählen...",
  config: {
    suggestions: ["Beschwörung", "Verwandlung", "Bannzauber", "Verzauberung", "Hervorrufung", "Illusion", "Erkenntniszauber", "Nekromantie"],
  },
}
```

**Config-Optionen:**
- `suggestions?: string[]` - Vorschlagsliste
- **Keyboard-Navigation:** Wie bei `tags`

---

### 14. **display** - Berechnetes/Angezeigtes Feld (Read-Only)

Für computed/berechnete Werte, die basierend auf anderen Feldern automatisch angezeigt werden. Ideal für Modifikatoren, abgeleitete Werte, oder Formeln.

```typescript
{
  id: "strModifier",
  label: "STR Mod",
  type: "display",
  config: {
    compute: (data) => {
      const str = data.str as number || 10;
      return Math.floor((str - 10) / 2);
    },
    prefix: "+",  // Optional: Präfix für positive Werte
    suffix: "",   // Optional: Suffix (z.B. " ft.", " %")
    className: "modifier-display",  // Optional: Zusätzliche CSS-Klasse
  },
}
```

**Config-Optionen:**
- `compute: (data: Record<string, unknown>) => string | number` - Berechnungsfunktion (erforderlich)
  - `data`: Alle aktuellen Formular-Werte (bei Composite-Feldern: nur die Werte des Composite-Parents)
  - Return: Berechneter Wert als String oder Number
- `prefix?: string | ((data: Record<string, unknown>) => string)` - Text vor dem Wert (z.B. "+", "-", "$") oder Funktion für dynamische Präfixe
- `suffix?: string | ((data: Record<string, unknown>) => string)` - Text nach dem Wert (z.B. "ft.", "%", "GP") oder Funktion für dynamische Suffixe
- `className?: string` - Zusätzliche CSS-Klasse für Styling

**Eigenschaften:**
- Das Feld ist **read-only** und kann nicht direkt bearbeitet werden
- Der Wert wird **automatisch neu berechnet**, wenn sich abhängige Felder ändern
- Ideal für **Modifikatoren, Boni, oder abgeleitete Statistiken**

**Hinweis:** Bei Verwendung in Composite-Feldern erhält die `compute`-Funktion nur die Werte des übergeordneten Composite-Feldes, nicht des gesamten Formulars.

**Beispiel: D&D Attribut-Modifikator**
```typescript
// In einem Composite-Feld für Attribute
{
  id: "abilities",
  type: "composite",
  config: {
    fields: [
      { id: "str", label: "STR", type: "number-stepper", min: 1, max: 30, default: 10 },
      {
        id: "strMod",
        label: "Mod",
        type: "display",
        config: {
          compute: (data) => {
            const score = data.str as number || 10;
            const mod = Math.floor((score - 10) / 2);
            return mod;
          },
          prefix: (data) => {
            const score = data.str as number || 10;
            const mod = Math.floor((score - 10) / 2);
            return mod >= 0 ? "+" : "";
          },
        },
      },
    ],
  },
}
```

**Beispiel: Berechneter Save mit Proficiency Bonus**
```typescript
{
  id: "strSave",
  label: "Save",
  type: "display",
  config: {
    compute: (data) => {
      const mod = Math.floor(((data.str as number || 10) - 10) / 2);
      const pb = data.pb as number || 2;
      const hasProficiency = data.strSaveProf as boolean || false;
      return hasProficiency ? mod + pb : mod;
    },
    prefix: (data) => {
      // Dynamischer Präfix basierend auf Wert
      const value = // ... berechne Wert wie oben
      return value >= 0 ? "+" : "";
    },
  },
  visibleIf: (data) => data.strSaveProf === true,  // Nur sichtbar wenn Proficiency aktiv
}
```

**Use Cases:**
- **Attribute-Modifikatoren** in D&D/Pathfinder (Berechnung: `floor((score-10)/2)`)
- **Saving Throw Werte** (Modifikator + Proficiency Bonus)
- **Initiative-Bonus** (DEX Modifikator + spezielle Boni)
- **Passive Wahrnehmung** (10 + WIS Modifikator + Proficiency wenn skilled)
- **Angriffs-Boni** (Attribut-Modifikator + Proficiency Bonus)
- **Spell DC** (8 + Proficiency Bonus + Spellcasting Ability Modifier)
- Alle Situationen, wo ein Wert aus anderen Feldern berechnet werden soll

**Conditional Visibility:**
Display-Felder können mit `visibleIf` kombiniert werden, um berechnete Werte nur dann anzuzeigen, wenn bestimmte Bedingungen erfüllt sind.

**Styling:**
Display-Felder erhalten automatisch die CSS-Klasse `.sm-cc-display-field` und werden mit:
- Monospace-Font für bessere Lesbarkeit von Zahlen
- Zentrierter Text
- Gedämpfte Hintergrundfarbe zur Unterscheidung von editierbaren Feldern
- Grau getönter Text (`--text-muted`)

---

## Universelle Feld-Eigenschaften

Alle Feld-Typen unterstützen diese Eigenschaften:

```typescript
interface BaseFieldSpec {
  // Eindeutiger Identifier (verwendet für Daten-Keys)
  id: string;

  // Angezeigtes Label (kann leer sein: "")
  label: string;

  // Feld-Typ (siehe oben)
  type: FieldType;

  // Optionale Eigenschaften:

  // Pflichtfeld-Markierung
  required?: boolean;

  // Hilfetext unter dem Feld
  help?: string;

  // Bedingte Sichtbarkeit
  visibleIf?: (formData: Record<string, unknown>) => boolean;

  // Custom-Validierung
  validate?: (value: unknown, formData: Record<string, unknown>) => string | null;

  // Wert-Transformation vor Speicherung
  transform?: (value: unknown) => unknown;

  // Standardwert
  default?: unknown;

  // ⭐ Layout-Hints für dynamisches Grid-Layout
  minWidth?: number;        // Mindestbreite des Controls in Pixeln (überschreibt Type-Default)
  preferWide?: boolean;     // Präferenz für volle Breite auch wenn nicht erforderlich
}
```

### Layout-Hints: minWidth und preferWide

Das Create-Modal verwendet ein **intelligentes, datengesteuertes Grid-Layout**, das sich automatisch an die verfügbare Breite anpasst.

**minWidth** (in Pixeln):
- Überschreibt den Type-Default für die minimale Control-Breite
- Nützlich für Felder mit langen Platzhaltern oder viel Inhalt
- Beispiel: `minWidth: 300` für ein Textfeld mit langem Placeholder

**preferWide**:
- Markiert ein Feld, das lieber volle Breite nutzen soll
- Überschreibt nicht die Type-Defaults für wide fields (textarea, repeating, etc.)
- Nützlich für Textfelder mit Freitext-Eingabe

**Type-Defaults** (automatisch gesetzt basierend auf `type`):
- `text`: 180px
- `select`: 160px
- `number-stepper`: 152px (3 Buttons + Gaps)
- `tags`: 228px (Input + Gap + Button)
- `toggle`: 60px (fixed)
- `color`: 80px (fixed)
- `textarea`, `markdown`, `repeating`, `composite`: Immer wide (überspannen alle Spalten)

### Beispiel für bedingte Sichtbarkeit:

```typescript
{
  id: "subtype",
  label: "Untertyp",
  type: "text",
  visibleIf: (data) => data.type === "Humanoid",
}
```

### Beispiel für Custom-Validierung:

```typescript
{
  id: "email",
  label: "E-Mail",
  type: "text",
  validate: (value) => {
    if (typeof value !== "string") return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : "Ungültige E-Mail-Adresse";
  },
}
```

## Storage Configuration

```typescript
interface StorageConfig {
  // Format (im Moment nur "md-frontmatter" unterstützt)
  format: "md-frontmatter";

  // Pfad-Template mit Variablen-Substitution
  // z.B. "SaltMarcher/Creatures/{name}.md"
  pathTemplate: string;

  // Feld-ID für Dateinamen (erforderlich)
  filenameFrom: string;

  // Zielverzeichnis
  directory: string;

  // Felder, die im Frontmatter gespeichert werden sollen
  frontmatter?: string[];

  // Felder, die im Body gespeichert werden sollen
  body?: string[];

  // Optional: Template-String für Body-Inhalt
  bodyTemplate?: string;
}
```

### Beispiel:

```typescript
storage: {
  format: "md-frontmatter",
  pathTemplate: "SaltMarcher/Creatures/{name}.md",
  filenameFrom: "name",
  directory: "SaltMarcher/Creatures",
  frontmatter: ["name", "size", "type", "cr"],
  bodyTemplate: "{description}\n\n## Aktionen\n{actions}",
}
```

## Section Configuration

Für Tab-Navigation können Sie Sections definieren:

```typescript
interface SectionSpec {
  // Eindeutiger Identifier
  id: string;

  // Tab-Label
  label: string;

  // Beschreibung (wird unter dem Label angezeigt)
  description?: string;

  // Liste von Feld-IDs, die in dieser Section angezeigt werden
  fieldIds: string[];
}
```

### Beispiel:

```typescript
ui: {
  enableNavigation: true,
  sections: [
    {
      id: "basic",
      label: "Grunddaten",
      description: "Name, Größe, Typ und Gesinnung",
      fieldIds: ["name", "size", "type", "alignment"],
    },
    {
      id: "combat",
      label: "Kampfwerte",
      description: "AC, HP, Initiative und CR",
      fieldIds: ["ac", "hp", "initiative", "cr"],
    },
  ],
}
```

## Vollständiges Beispiel: Zauber-Spec

```typescript
import type { CreateSpec, AnyFieldSpec } from "../../../ui/workmode/create/types";

interface SpellData {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string[];
  duration: string;
  description: string;
  upcast?: string;
}

const spellFields: AnyFieldSpec[] = [
  {
    id: "name",
    label: "Name",
    type: "text",
    required: true,
    placeholder: "Zaubername eingeben...",
  },
  {
    id: "level",
    label: "Grad",
    type: "number-stepper",
    min: 0,
    max: 9,
    default: 1,
  },
  {
    id: "school",
    label: "Schule",
    type: "select",
    options: [
      { value: "abjuration", label: "Bannzauber" },
      { value: "conjuration", label: "Beschwörung" },
      { value: "divination", label: "Erkenntniszauber" },
      { value: "enchantment", label: "Verzauberung" },
      { value: "evocation", label: "Hervorrufung" },
      { value: "illusion", label: "Illusion" },
      { value: "necromancy", label: "Nekromantie" },
      { value: "transmutation", label: "Verwandlung" },
    ],
  },
  {
    id: "castingTime",
    label: "Zeitaufwand",
    type: "text",
    placeholder: "z.B. 1 Aktion",
  },
  {
    id: "range",
    label: "Reichweite",
    type: "text",
    placeholder: "z.B. 30 Fuß",
  },
  {
    id: "components",
    label: "Komponenten",
    type: "multiselect",
    options: [
      { value: "V", label: "Verbal (V)" },
      { value: "S", label: "Somatisch (S)" },
      { value: "M", label: "Material (M)" },
    ],
    default: [],
  },
  {
    id: "duration",
    label: "Wirkungsdauer",
    type: "text",
    placeholder: "z.B. Augenblicklich",
  },
  {
    id: "description",
    label: "Beschreibung",
    type: "textarea",
    required: true,
    placeholder: "Zauberbeschreibung...",
    config: { rows: 8 },
  },
  {
    id: "upcast",
    label: "Auf höherem Grad",
    type: "textarea",
    placeholder: "Effekt bei höherem Zaubergrad...",
    config: { rows: 3 },
    visibleIf: (data) => (data.level as number) < 9,
  },
];

export const spellSpec: CreateSpec<SpellData> = {
  kind: "spell",
  title: "Zauber erstellen",
  subtitle: "Neuer Zauber für deine Kampagne",
  fields: spellFields,
  storage: {
    format: "md-frontmatter",
    pathTemplate: "SaltMarcher/Spells/{name}.md",
    filenameFrom: "name",
    directory: "SaltMarcher/Spells",
    frontmatter: ["name", "level", "school", "castingTime", "range", "components", "duration"],
  },
  ui: {
    submitLabel: "Zauber erstellen",
    cancelLabel: "Abbrechen",
    enableNavigation: true,
    sections: [
      {
        id: "basic",
        label: "Grunddaten",
        description: "Name, Grad und Schule",
        fieldIds: ["name", "level", "school"],
      },
      {
        id: "mechanics",
        label: "Mechanik",
        description: "Zeitaufwand, Reichweite, Komponenten und Dauer",
        fieldIds: ["castingTime", "range", "components", "duration"],
      },
      {
        id: "description",
        label: "Beschreibung",
        description: "Zaubereffekt und Hochstufung",
        fieldIds: ["description", "upcast"],
      },
    ],
  },
};
```

## Best Practices

1. **Feld-IDs:** Verwende camelCase und beschreibende Namen (`hitPoints` statt `hp` für bessere Lesbarkeit im Code)

2. **Labels:** Kurze, prägnante Labels verwenden. Bei Platzmangel Abkürzungen nutzen (z.B. "AC" statt "Rüstungsklasse")

3. **Sections:** Logisch zusammenhängende Felder gruppieren. Nicht zu viele Sections (3-7 ist optimal)

4. **Default-Werte:** Immer sinnvolle Standardwerte setzen, um leere Formulare zu vermeiden

5. **Validierung:** Required-Flag für Pflichtfelder nutzen, Custom-Validierung nur wenn nötig

6. **Repeating Fields:** Custom Card-Renderer verwenden für bessere UX bei komplexen Einträgen

7. **Tags mit Suggestions:** Immer Vorschläge hinzufügen, um Tipparbeit zu reduzieren

8. **Composite Fields:** Für zusammenhängende Werte verwenden (z.B. Attribute, Bewegungsraten)

9. **Storage:** Wichtige Felder im Frontmatter, lange Texte im Body speichern

10. **Help-Text:** Sparsam einsetzen, nur bei unklaren Feldern. Labels sollten selbsterklärend sein.

## Bekannte Einschränkungen

- Nested Composite Fields werden nicht unterstützt
- Repeating Fields können keine anderen Repeating Fields enthalten
- Storage-Format ist auf "md-frontmatter" beschränkt
- Conditional Fields (`visibleIf`) werden bei Section-Navigation nicht neu bewertet

## Weitere Ressourcen

- Vollständiges Beispiel: `src/apps/library/create/creature/creature-spec.ts`
- Type-Definitionen: `src/ui/workmode/create/types.ts`
- Modal-Implementierung: `src/ui/workmode/create/modal.ts`
- Entry-System: `src/ui/workmode/create/components/entry-system.ts`
- Token-Editor: `src/ui/workmode/create/components/token-editor.ts`
