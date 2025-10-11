# API Contract: Workmode Create Modal
Dieses Dokument definiert den vorgesehenen TypeScript-Contract für das zentrale Create-Modal. Ziel ist eine deklarative Spezifikation, die Felder, Validierung und Persistenz entkoppelt.

## Feld-Registry
```ts
export type FieldType =
  | 'text' | 'textarea' | 'number-stepper'
  | 'select' | 'multiselect' | 'tags'
  | 'toggle' | 'date' | 'color'
  | 'markdown' | 'array' | 'object' | 'composite-stat';

export type FieldOption<T extends string = string> = { value: T; label: string };

export interface FieldVisibilityRule {
  /** IDs der Felder, die als Abhängigkeit ausgewertet werden. */
  dependsOn?: string[];
  /** Predicate, das anhand der aktuellen Werte Visibility bestimmt. */
  visibleIf?: (values: Record<string, unknown>) => boolean;
}

export interface FieldSpec<T = unknown> extends FieldVisibilityRule {
  id: string;
  label: string;
  type: FieldType;
  section?: string; // optionaler Abschnitt für Gruppierung/Navigation
  required?: boolean;
  help?: string;
  placeholder?: string;
  min?: number; max?: number; step?: number;
  options?: FieldOption[];
  default?: T;
  /** Optionale Serialisierungs-ID, falls Storage-Namen abweichen sollen */
  storageKey?: string;
  validate?: (value: T, all: Record<string, unknown>) => string | null;
  transform?: (value: T, all: Record<string, unknown>) => unknown;
}

export interface CompositeFieldSpec<T = unknown> extends FieldSpec<T> {
  type: 'array' | 'object' | 'composite-stat';
  /** Kind-Felder (z. B. für Arrays von Objekten). */
  children?: FieldSpec[];
  /** Optionaler Renderer-Key, falls spezialisierte Widgets nötig sind. */
  widget?: string;
}

export type AnyFieldSpec = FieldSpec | CompositeFieldSpec;

export interface FieldRegistryEntry {
  /** Matching-Funktion für Feldtypen oder widget-Keys. */
  supports: (spec: AnyFieldSpec) => boolean;
  /** Renderer, der das Feld erzeugt und Form-State aktualisiert. */
  render: (args: RenderFieldArgs) => FieldRenderHandle;
}

export interface RenderFieldArgs {
  app: App;
  container: HTMLElement;
  spec: AnyFieldSpec;
  values: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  registerValidator: (runner: () => string[]) => void;
}

export interface FieldRenderHandle {
  focus?: () => void;
  update?: (value: unknown, all: Record<string, unknown>) => void;
  destroy?: () => void;
}
```

### Erweiterbarkeit der Feld-Registry
- Neue Widgets implementieren `FieldRegistryEntry` und werden über eine zentrale Registry registriert.
- `supports` kann nach `type` oder `widget` differenzieren (z. B. spezielle StatBlock-Renderer).
- Standardfelder (text, number, select, toggle, color, markdown) werden im Shared-Paket ausgeliefert; spezialisierte Workmodes liefern eigene Renderer, bleiben aber deklarativ.

## Validierung & Daten-Schema
```ts
export interface DataSchema<TDraft = Record<string, unknown>, TParsed = TDraft> {
  parse: (data: unknown) => TParsed;
  safeParse: (data: unknown) => { success: boolean; data?: TParsed; error?: unknown };
  /** Optional: partial parsing ohne Strict Mode (z. B. für Draft-Validierung). */
  partial?: (data: unknown) => { success: boolean; data?: TDraft; error?: unknown };
}
```
- Umsetzung basiert empfohlen auf Zod (`z.object({...})`), wird aber über Interface gekapselt.
- `FieldSpec.required` und `FieldSpec.validate` ergänzen Schema-Checks um UI-nahe Hinweise.
- `transform` ermöglicht Feld-spezifische Normalisierung (z. B. Strings → Zahlen) vor Schema-Validierung.

## Storage-Abstraktion
```ts
export type StorageFormat = 'md-frontmatter' | 'json' | 'yaml' | 'codeblock';

export interface StorageSpec {
  format: StorageFormat;
  /** Template relativ zum Vault-Root, z. B. "SaltMarcher/Creatures/{slug}.md" */
  pathTemplate: string;
  /** Feld-ID, deren Wert als Basis für den Dateinamen dient. */
  filenameFrom: string;
  /** Optional: statisches Verzeichnis erzwingen (überschreibt Template-Anteile). */
  directory?: string;
  /** Mapping Feld-ID → Frontmatter-Key (Markdown). */
  frontmatter?: Record<string, string> | string[];
  /** Liste der Felder, die in den Body übernommen werden. */
  bodyFields?: string[];
  /** Template-Funktion für Body-Rendering (Markdown, JSON, YAML oder Codeblock). */
  bodyTemplate?: (data: Record<string, any>) => string;
  /** Optional: Formatter für Codeblock-Listen (Terrains/Regions). */
  blockRenderer?: {
    language: string; // z. B. "terrain"
    serialize: (data: Record<string, any>) => string;
    parse?: (source: string) => Record<string, any>;
  };
  /** Zusätzliche Hooks (z. B. Duplicate Detection, Auto-Folder-Erstellung). */
  hooks?: {
    ensureDirectory?: (app: App) => Promise<void>;
    beforeWrite?: (payload: SerializedPayload) => Promise<void> | void;
    afterWrite?: (result: PersistResult) => Promise<void> | void;
  };
}

export interface SerializedPayload {
  content: string | Record<string, unknown>;
  path: string;
  metadata?: Record<string, unknown>;
}

export interface PersistResult {
  filePath: string;
  file?: TFile;
}
```
- Für Markdown-Dateien erzeugt das Modal auf Basis von `frontmatter` und `bodyTemplate` den Content.
- `codeblock`-Format deckt Terrains/Regions ab; `blockRenderer.serialize` erstellt den vollständigen Codeblock.
- `hooks.ensureDirectory` ersetzt bisherige `ensure*`-Funktionen.

## Create-Spezifikation & Modal-API
```ts
export interface CreateSpec<TDraft = Record<string, unknown>, TSerialized = unknown, TResult = unknown> {
  kind: 'creature' | 'spell' | 'equipment' | 'region' | 'terrain' | string;
  title: string;
  subtitle?: string;
  schema: DataSchema<TDraft, TSerialized>;
  fields: AnyFieldSpec[];
  storage: StorageSpec;
  defaults?: Partial<TDraft> | ((context: { presetName?: string }) => Partial<TDraft>);
  transformers?: {
    preSave?: (values: TDraft) => TDraft;
    postSave?: (filePath: string, values: TDraft) => Promise<void> | void;
  };
  ui?: {
    submitLabel?: string;
    cancelLabel?: string;
    enableNavigation?: boolean;
    sections?: Array<{ id: string; label: string; description?: string; fieldIds: string[]; }>;
  };
  behavior?: {
    autoSlugify?: boolean; // Dateinamen automatisch normalisieren
    allowDraftSave?: boolean; // Optionaler Draft-Modus (z. B. Regions Autosave)
  };
}

export interface OpenCreateModalOptions {
  preset?: Record<string, unknown> | string;
  /** Optional: Input-Werte noch vor dem Rendern überschreiben (z. B. Filtervoreinstellungen). */
  initialize?: (draft: Record<string, unknown>) => Record<string, unknown>;
}

export interface OpenCreateModalResult {
  filePath: string;
  values: Record<string, any>;
}

export function openCreateModal(
  spec: CreateSpec,
  options?: OpenCreateModalOptions
): Promise<OpenCreateModalResult | null>;
```
- `schema.parse` validiert die finalen Daten vor `preSave`/Storage.
- `fields.section` + `ui.sections` steuern Navigation und Layout.
- `transformers.preSave` erlaubt Migrationslogik (z. B. Spellcasting → Entries). `postSave` kann Dateien öffnen oder Listen aktualisieren.
- Rückgabewert `null` signalisiert Abbruch durch Benutzer.

## Fehlerbehandlung
- Schemafehler → aggregierte Anzeige im Modal (Mapping aus `safeParse.error`).
- Feld-Validatoren liefern Strings und markieren betroffene Felder über Handles.
- Persistenzfehler werfen Exceptions; `openCreateModal` zeigt Notices und lässt erneutes Speichern zu.
- `StorageSpec.hooks.beforeWrite` kann Konflikte (z. B. existierende Datei) abfangen und alternative Pfade anbieten.

## Beispiele
### Creature-Spec (vereinfacht)
```ts
const CreatureCreateSpec: CreateSpec<StatblockData> = {
  kind: 'creature',
  title: 'Neuen Statblock erstellen',
  schema: createStatblockSchema(), // Zod
  fields: [
    { id: 'name', label: 'Name', type: 'text', required: true, default: 'Neue Kreatur' },
    { id: 'size', label: 'Größe', type: 'select', options: CREATURE_SIZES.map(value => ({ value, label: value })) },
    { id: 'speeds', label: 'Bewegung', type: 'composite-stat', widget: 'creature-movement' },
    { id: 'entries', label: 'Einträge', type: 'array', widget: 'creature-entry-manager' },
  ],
  storage: {
    format: 'md-frontmatter',
    pathTemplate: 'SaltMarcher/Creatures/{slug}.md',
    filenameFrom: 'name',
    frontmatter: { name: 'name', smType: 'smType', cr: 'cr' },
    bodyTemplate: renderCreatureMarkdown,
  },
  transformers: {
    preSave: migrateLegacySpellcasting,
    postSave: async (filePath) => openFileInSourceMode(filePath),
  },
  ui: {
    enableNavigation: true,
    sections: [
      { id: 'basics', label: 'Grundlagen', fieldIds: ['name', 'size'] },
      { id: 'entries', label: 'Einträge', fieldIds: ['entries'] },
    ],
  },
};
```

### Terrain-Spec (Listen-Datei)
```ts
const TerrainCreateSpec: CreateSpec<{ name: string; color: string; speed: number }> = {
  kind: 'terrain',
  title: 'Terrain-Eintrag',
  schema: terrainSchema,
  fields: [
    { id: 'name', label: 'Bezeichnung', type: 'text', required: true },
    { id: 'color', label: 'Farbe', type: 'color', default: '#888888' },
    { id: 'speed', label: 'Geschwindigkeitsfaktor', type: 'number-stepper', default: 1, min: 0, step: 0.1 },
  ],
  storage: {
    format: 'codeblock',
    pathTemplate: 'SaltMarcher/Terrains.md',
    filenameFrom: 'name',
    blockRenderer: {
      language: 'terrain',
      serialize: renderTerrainBlock,
      parse: parseTerrainBlock,
    },
  },
  behavior: {
    autoSlugify: false,
    allowDraftSave: true,
  },
};
```

## Erweiterbarkeit & Versionierung
- Neue Felder/Widgets registrieren zusätzliche `FieldRegistryEntry`-Instanzen.
- Storage-Formate lassen sich durch zusätzliche `StorageFormat`-Optionen erweitern (z. B. `frontmatter-only`).
- Vertragsänderungen erfolgen versioniert (z. B. `CreateSpecVersion = 1 | 2`), damit Workmodes migrationsfähig bleiben.

## Testempfehlungen
- **Unit**: Schema-Validierung (Zod), Transformer-Logik, Storage-Renderer.
- **Integration**: Modal-Rendering mit Mock-App, Pipeline-Persistenz in Temp-Vault.
- **Regression**: Snapshot der generierten Markdown-/Codeblock-Strukturen.
