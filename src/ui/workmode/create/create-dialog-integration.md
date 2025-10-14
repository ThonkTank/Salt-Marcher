# Create-Dialog Integration für Workmode-Tabs

Dieses Tutorial zeigt, wie der "Create entry"-Button eines Workmode-Tabs den gemeinsamen Create-Dialog öffnet und neue Einträge in der zugrunde liegenden Datenquelle speichert. Die Schritte basieren auf der Atlas-App (Terrains & Regionen), funktionieren aber analog in anderen Tabs.

## Voraussetzungen

- Der Tab nutzt `createWorkmodeHeader` aus `src/ui/workmode` und hat im `action`-Callback Zugriff auf die aktive Renderer-Instanz (`handleCreate`).
- Die Daten lassen sich über einen Store lesen und schreiben (z. B. `loadRegions`, `saveRegions`).
- Für den Store existiert eine Serialisierung (z. B. `stringifyRegionsBlock`) oder ein anderes Persistenz-Backend, das der Create-Dialog ansteuern kann.

## Schritt 1: Formular- und Persistenzschema definieren

1. Lege ein Interface für die Formularwerte an (`RegionFormValues`).
2. Erstelle ein Persistenz-Payload (`RegionPersistPayload`), das die vollständige Datensammlung enthält, die nach dem Speichern in die Datei geschrieben werden soll.
3. Implementiere ein `DataSchema`, das Benutzereingaben validiert (z. B. Pflichtfelder, eindeutige Namen, Zahlenbereiche) und das Persistenz-Payload vorbereitet.

```ts
const schema = createRegionSchema(existingRegions);
```

Das Schema wird vom Create-Dialog verwendet, um Eingabefehler anzuzeigen und die endgültigen Daten für den `storage`-Block vorzubereiten.

## Schritt 2: `CreateSpec` zusammenstellen

Erzeuge pro Renderer eine Hilfsfunktion `createModalSpec`, die ein `CreateSpec` beschreibt:

- `kind` und `title` definieren Copy des Dialogs.
- `fields` legt Eingabe-Felder fest (Text, Select, Zahlen, etc.).
- `defaults` kann den Suchvorschlag (`presetName`) aus dem Header übernehmen.
- `storage` beschreibt, wie der Dialog die Daten persistiert (Dateipfad, Format, Hooks).

```ts
const spec: CreateSpec<RegionFormValues, RegionPersistPayload> = {
  kind: "region",
  title: "Neue Region",
  schema,
  defaults: ({ presetName }) => ({ name: presetName ?? "" }),
  fields: [ /* … */ ],
  storage: {
    format: "codeblock",
    pathTemplate: REGIONS_FILE,
    filenameFrom: "name",
    blockRenderer: {
      language: "regions",
      serialize: (values) => stringifyRegionsBlock(values.regions ?? []),
    },
    hooks: {
      ensureDirectory: async (app) => { await ensureRegionsFile(app); },
    },
  },
};
```

## Schritt 3: Dialog aus `handleCreate` aufrufen

`handleCreate` wird vom Workmode-Header aufgerufen. Rufe hier `openCreateModal` mit dem `CreateSpec` auf und übergib die Obsidian-`app` Instanz:

```ts
const result = await openCreateModal<RegionFormValues, RegionPersistPayload>(spec, {
  app: this.app,
  preset: presetName || undefined,
});
if (!result) return; // Benutzer hat abgebrochen
this.regions = await loadRegions(this.app);
this.render();
```

Fehler sollten geloggt werden, damit Integrationsprobleme sichtbar bleiben.

## Schritt 4: Renderer aktualisieren

Lade nach erfolgreichem Speichern die Daten erneut aus dem Store (damit externe Änderungen berücksichtigt werden) und rendere die Liste neu. Bereits registrierte Dateiwächter (`watchRegions`, `watchTerrains` etc.) bleiben unverändert.

## Referenzimplementierungen

- `src/apps/atlas/view/terrains.ts` – erster Tab mit Create-Dialog.
- `src/apps/atlas/view/regions.ts` – Regions-Tab mit identischer Integration.

Diese Dateien dienen als Blaupause, wie `CreateSpec`, Schema-Validierung und Renderer-Update zusammenspielen.
