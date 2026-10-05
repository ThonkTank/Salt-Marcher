import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const auditRoot = process.argv[2];
if (!auditRoot) throw new Error("Pfad zum abgeschlossenen Audit fehlt.");

const acceptancePath = resolve("acceptance.json");
const acceptance = JSON.parse(await readFile(acceptancePath, "utf8"));
if (acceptance.strictParity)
  throw new Error("Die verbindliche Fallliste existiert bereits; kein erneuter Import.");

const areas = ["bau", "material", "objekte", "verwaltung"];
const cases = [];
for (const area of areas) {
  const rows = JSON.parse(await readFile(resolve(auditRoot, area, "matrix.json"), "utf8"));
  for (const row of rows) {
    cases.push({
      id: row.id,
      parent: row.parent,
      area,
      path: row.path,
      command: row.command,
      scope: row.parent === "DD-037" ? "excluded" : "required",
      original: row.original,
      target: row.comparison.target,
      baseline: {
        editor: row.editor,
        comparison: row.comparison,
        checks: row.checks,
      },
      implementation: { state: "not_started", changes: [], evidence: [] },
      hostCheck: {
        state: "open",
        build: null,
        evidence: [],
        gap: "Gleichwertigkeit am neuen isolierten Host noch nicht belegt.",
      },
    });
  }
}

const ids = new Set(cases.map(({ id }) => id));
if (cases.length !== 723 || ids.size !== 723)
  throw new Error(`Erwartet: 723 eindeutige Fälle; gefunden: ${cases.length}/${ids.size}.`);
if (cases.filter(({ scope }) => scope === "required").length !== 711)
  throw new Error("Der beschlossene Pflichtumfang muss 711 Fälle umfassen.");

acceptance.strictParity = {
  reference: "Dungeondraft 1.2.0.1 Opulent Kirin",
  audit: resolve(auditRoot),
  inventoryStatus: "conditional_original_ui_gaps",
  exclusion: {
    parent: "DD-037",
    cases: 12,
    decision: "Keine ausführbare Mod- oder Erweiterungsschnittstelle; Nutzerentscheidung für das private Projekt.",
  },
  acceptanceRule: "Pflichtfall erst nach direktem Originalbeleg, implementierter Wirkung, isoliertem Hostlauf und Nachweis am installierten Endstand geschlossen.",
  cases,
};
acceptance.notes += " Die alten Wurzelstatus sind historisch; die 711 Pflicht-Unterfälle stehen unter strictParity und gelten bis zur neuen Host- und Endstandsabnahme als offen.";
await writeFile(acceptancePath, JSON.stringify(acceptance, null, 2) + "\n");
console.log(`Importiert: ${cases.length} Fälle, davon 711 Pflicht und 12 beschlossene Ausnahmen.`);
