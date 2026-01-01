// Ziel: Tabellen-Schema Definitionen für Tasks und Bugs
// Siehe: docs/tools/taskTool.md#datenmodell

/**
 * Task-Tabellen-Spalten
 */
export const TASK_COLUMNS = {
  id: { index: 0, header: '#', align: 'right' },
  status: { index: 1, header: 'Status', align: 'center' },
  domain: { index: 2, header: 'Domain', align: 'left' },
  layer: { index: 3, header: 'Layer', align: 'left' },
  beschreibung: { index: 4, header: 'Beschreibung', align: 'left' },
  prio: { index: 5, header: 'Prio', align: 'center' },
  mvp: { index: 6, header: 'MVP?', align: 'center' },
  deps: { index: 7, header: 'Deps', align: 'left' },
  spec: { index: 8, header: 'Spec', align: 'left' },
  impl: { index: 9, header: 'Imp.', align: 'left' },
};

/**
 * Bug-Tabellen-Spalten
 */
export const BUG_COLUMNS = {
  id: { index: 0, header: 'b#', align: 'right' },
  status: { index: 1, header: 'Status', align: 'center' },
  beschreibung: { index: 2, header: 'Beschreibung', align: 'left' },
  prio: { index: 3, header: 'Prio', align: 'center' },
  deps: { index: 4, header: 'Deps', align: 'left' },
};

/**
 * Status-Symbole mit Metadaten
 */
export const STATUS = {
  open: { symbol: '⬜', priority: 3, workflow: 'vorbereitung.txt' },
  ready: { symbol: '🟢', priority: 1, workflow: 'umsetzung.txt' },
  partial: { symbol: '🔶', priority: 2, workflow: 'konformitaet.txt' },
  broken: { symbol: '⚠️', priority: 4, workflow: 'reparatur.txt' },
  review: { symbol: '📋', priority: 5, workflow: 'review.txt' },
  blocked: { symbol: '⛔', priority: 6, workflow: null },
  claimed: { symbol: '🔒', priority: 7, workflow: null },
  done: { symbol: '✅', priority: 8, workflow: null },
};

/**
 * Reverse-Lookup: Symbol -> Status-Key
 */
export const SYMBOL_TO_STATUS = Object.fromEntries(
  Object.entries(STATUS).map(([key, val]) => [val.symbol, key])
);

/**
 * Prioritäts-Reihenfolge (höher = wichtiger)
 */
export const PRIORITIES = {
  hoch: 3,
  mittel: 2,
  niedrig: 1,
};

/**
 * Gültige Implementation-Tags
 */
export const IMPL_TAGS = ['[neu]', '[ändern]', '[fertig]'];

/**
 * Basis-Layers (werden dynamisch erweitert aus docs/)
 * @type {string[]}
 */
export const BASE_LAYERS = [
  'services',
  'features',
  'types',
  'orchestration',
  'views',
  'infrastructure',
  'workflows',
  'constants',
  'architecture',
  'tools',
];

/**
 * Cache für dynamisch geladene Werte
 * @type {{ layers: string[] | null, domains: string[] | null }}
 */
const cache = {
  layers: null,
  domains: null,
};

/**
 * Lädt gültige Layers dynamisch aus docs/ Ordnerstruktur
 * @param {string} docsPath - Pfad zum docs/ Ordner
 * @returns {Promise<string[]>} Liste gültiger Layers
 */
export async function loadValidLayers(docsPath) {
  if (cache.layers) return cache.layers;

  const { readdir } = await import('node:fs/promises');
  const { join } = await import('node:path');

  try {
    const entries = await readdir(docsPath, { withFileTypes: true });
    const folders = entries
      .filter(e => e.isDirectory())
      .map(e => e.name);

    // Erweitere mit Sub-Layers (z.B. services/encounter)
    const subLayers = [];
    for (const folder of folders) {
      if (folder === 'services') {
        const subEntries = await readdir(join(docsPath, folder), { withFileTypes: true });
        for (const sub of subEntries.filter(e => e.isDirectory())) {
          subLayers.push(`services/${sub.name}`);
        }
      }
    }

    cache.layers = [...new Set([...folders, ...subLayers])];
    return cache.layers;
  } catch {
    return BASE_LAYERS;
  }
}

/**
 * Lädt gültige Domains dynamisch aus docs/ Struktur
 * @param {string} docsPath - Pfad zum docs/ Ordner
 * @returns {Promise<string[]>} Liste gültiger Domains
 */
export async function loadValidDomains(docsPath) {
  if (cache.domains) return cache.domains;

  const { readdir } = await import('node:fs/promises');
  const { join } = await import('node:path');

  try {
    const domains = new Set();

    // Domains aus docs/services/ (Ordner + Dateien ohne .md)
    const servicesPath = join(docsPath, 'services');
    const serviceEntries = await readdir(servicesPath, { withFileTypes: true });
    for (const entry of serviceEntries) {
      const name = entry.isDirectory() ? entry.name : entry.name.replace('.md', '');
      domains.add(name);
      domains.add(name.charAt(0).toUpperCase() + name.slice(1)); // Capitalized
    }

    // Domains aus docs/features/ (Dateien ohne .md)
    const featuresPath = join(docsPath, 'features');
    const featureEntries = await readdir(featuresPath);
    for (const entry of featureEntries) {
      const name = entry.replace('.md', '').replace('-', '');
      domains.add(name);
    }

    // Domains aus docs/types/ (Dateien ohne .md)
    const typesPath = join(docsPath, 'types');
    const typeEntries = await readdir(typesPath);
    for (const entry of typeEntries) {
      const name = entry.replace('.md', '').replace('-', '');
      domains.add(name);
    }

    cache.domains = [...domains];
    return cache.domains;
  } catch {
    return [];
  }
}

/**
 * Setzt den Cache zurück (für Tests)
 */
export function resetCache() {
  cache.layers = null;
  cache.domains = null;
}

/**
 * Hilfsfunktion: Status-Objekt für Symbol abrufen
 * @param {string} symbol - Status-Symbol (z.B. '⬜')
 * @returns {Object|null} Status-Objekt oder null
 */
export function getStatusBySymbol(symbol) {
  const key = SYMBOL_TO_STATUS[symbol];
  return key ? STATUS[key] : null;
}

/**
 * Hilfsfunktion: Status-Objekt für Key abrufen
 * @param {string} key - Status-Key (z.B. 'open')
 * @returns {Object|null} Status-Objekt oder null
 */
export function getStatusByKey(key) {
  return STATUS[key] || null;
}

/**
 * Hilfsfunktion: Prüft ob Status-Symbol gültig ist
 * @param {string} symbol - Zu prüfendes Symbol
 * @returns {boolean} true wenn gültig
 */
export function isValidStatus(symbol) {
  return symbol in SYMBOL_TO_STATUS;
}

/**
 * Hilfsfunktion: Prüft ob Priorität gültig ist
 * @param {string} prio - Zu prüfende Priorität
 * @returns {boolean} true wenn gültig
 */
export function isValidPrio(prio) {
  return prio in PRIORITIES;
}

/**
 * Hilfsfunktion: Prüft ob Layer gültig ist (async, gegen dynamische Liste)
 * @param {string} layer - Zu prüfender Layer (kann komma-separiert sein)
 * @param {string} docsPath - Pfad zum docs/ Ordner
 * @returns {Promise<boolean>} true wenn alle Layers gültig
 */
export async function isValidLayerAsync(layer, docsPath) {
  const layers = parseMultiValue(layer);
  const validLayers = await loadValidLayers(docsPath);
  return layers.every(l => validLayers.includes(l));
}

/**
 * Hilfsfunktion: Extrahiert Tag aus Impl-String
 * @param {string} impl - Impl-String (z.B. 'file.ts.func() [neu]')
 * @returns {string|null} Tag oder null
 */
export function parseImplTag(impl) {
  const match = impl.match(/\[(neu|ändern|fertig)\]/);
  return match ? `[${match[1]}]` : null;
}

/**
 * Hilfsfunktion: Prüft ob Domain gültig ist (async)
 * @param {string} domain - Zu prüfende Domain (kann komma-separiert sein)
 * @param {string} docsPath - Pfad zum docs/ Ordner
 * @returns {Promise<boolean>} true wenn alle Domains gültig
 */
export async function isValidDomainAsync(domain, docsPath) {
  const domains = parseMultiValue(domain);
  const validDomains = await loadValidDomains(docsPath);
  // Erlaube auch unbekannte Domains (flexibel)
  return domains.length > 0;
}

/**
 * Hilfsfunktion: Parst komma-separierte Multi-Werte
 * @param {string} value - Einzelwert oder komma-separierte Liste
 * @returns {string[]} Array der Werte
 */
export function parseMultiValue(value) {
  if (!value || value === '-') return [];
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

/**
 * Hilfsfunktion: Formatiert Array zu komma-separiertem String
 * @param {string[]} values - Array der Werte
 * @returns {string} Komma-separierter String oder '-'
 */
export function formatMultiValue(values) {
  if (!values || values.length === 0) return '-';
  return values.join(', ');
}
