// src/apps/library/create/creature/entry-model.ts
function inferEntryType(entry) {
  if (entry.entryType) return entry.entryType;
  if (entry.spellGroups || entry.spellAbility) return "spellcasting";
  if (entry.to_hit || entry.to_hit_from || entry.damage || entry.damage_from || entry.kind) {
    return "attack";
  }
  if (entry.save_ability && entry.save_dc) return "save-action";
  if (entry.name?.toLowerCase().includes("multiattack")) return "multiattack";
  if (entry.category === "trait") return "passive";
  return "passive";
}
function validateEntry(entry, index) {
  const issues = [];
  const label = entry.name?.trim() || `Eintrag ${index + 1}`;
  if (entry.save_ability && (entry.save_dc == null || Number.isNaN(entry.save_dc))) {
    issues.push(`${label}: Save-DC angeben, wenn ein Attribut gew\xE4hlt wurde.`);
  }
  if (entry.save_dc != null && !Number.isNaN(entry.save_dc) && !entry.save_ability) {
    issues.push(`${label}: Ein Save-DC ben\xF6tigt ein Attribut.`);
  }
  if (entry.save_effect && !entry.save_ability) {
    issues.push(`${label}: Save-Effekt ohne Attribut ist unklar.`);
  }
  if (entry.to_hit_from && !entry.to_hit_from.ability) {
    issues.push(`${label}: Automatische Attacke ben\xF6tigt ein Attribut.`);
  }
  if (entry.damage_from && !entry.damage_from.dice?.trim()) {
    issues.push(`${label}: Automatischer Schaden ben\xF6tigt W\xFCrfelangaben.`);
  }
  return issues;
}
function spellcastingDataToEntry(spellcastingData) {
  const groups = [];
  for (const group of spellcastingData.groups || []) {
    if (group.type === "at-will") {
      groups.push({
        type: "at-will",
        label: group.title || "At Will",
        spells: (group.spells || []).map((s) => s.name || s)
      });
    } else if (group.type === "per-day") {
      groups.push({
        type: "per-day",
        label: group.uses || "1/Day each",
        spells: (group.spells || []).map((s) => s.name || s)
      });
    } else if (group.type === "level") {
      groups.push({
        type: "level",
        level: group.level || 1,
        slots: group.slots,
        label: group.title,
        spells: (group.spells || []).map((s) => s.name || s)
      });
    }
  }
  return {
    category: "action",
    entryType: "spellcasting",
    name: spellcastingData.title || "Spellcasting",
    text: spellcastingData.summary,
    spellAbility: spellcastingData.ability,
    spellDcOverride: spellcastingData.saveDcOverride,
    spellAttackOverride: spellcastingData.attackBonusOverride,
    spellGroups: groups
  };
}
var init_entry_model = __esm({
  "src/apps/library/create/creature/entry-model.ts"() {
    "use strict";
  }
});

// src/apps/library/core/creature-presets.ts
var creature_presets_exports = {};
__export(creature_presets_exports, {
  PRESETS_DIR: () => PRESETS_DIR,
  ensurePresetDir: () => ensurePresetDir,
  findCreaturePresets: () => findCreaturePresets,
  getPresetCategories: () => getPresetCategories,
  listPresetFiles: () => listPresetFiles,
  loadCreaturePreset: () => loadCreaturePreset,
  watchPresetDir: () => watchPresetDir
});
function parseAlignment(text) {
  if (!text) return {};
  const normalized = text.toLowerCase().trim();
  if (normalized === "unaligned" || normalized === "any alignment") {
    return { override: text };
  }
  if (normalized === "neutral") {
    return { lawChaos: "Neutral", goodEvil: "Neutral" };
  }
  const words = text.split(/\s+/);
  if (words.length === 2) {
    return { lawChaos: words[0], goodEvil: words[1] };
  } else if (words.length === 1) {
    const word = words[0];
    if (["Good", "Evil"].some((w) => w.toLowerCase() === word.toLowerCase())) {
      return { goodEvil: word };
    } else if (["Lawful", "Chaotic"].some((w) => w.toLowerCase() === word.toLowerCase())) {
      return { lawChaos: word };
    }
  }
  return { override: text };
}
function calculatePBFromCR(cr) {
  if (!cr) return void 0;
  let crValue;
  if (cr.includes("/")) {
    const [num, denom] = cr.split("/").map(Number);
    crValue = num / denom;
  } else {
    crValue = Number(cr);
  }
  if (isNaN(crValue)) return void 0;
  if (crValue <= 4) return "+2";
  if (crValue <= 8) return "+3";
  if (crValue <= 12) return "+4";
  if (crValue <= 16) return "+5";
  if (crValue <= 20) return "+6";
  if (crValue <= 24) return "+7";
  if (crValue <= 28) return "+8";
  return "+9";
}
async function loadCreaturePreset(app, file) {
  const cache = app.metadataCache.getFileCache(file);
  if (!cache?.frontmatter) {
    throw new Error(`No frontmatter found in ${file.path}`);
  }
  const fm2 = cache.frontmatter;
  const parseJson = (value, fieldName) => {
    if (!value) return void 0;
    try {
      return JSON.parse(value);
    } catch (err) {
      console.warn(`Failed to parse ${fieldName}:`, err);
      return void 0;
    }
  };
  const alignmentParts = parseAlignment(fm2.alignment);
  const abilities = fm2.abilities_json ? parseJson(fm2.abilities_json, "abilities_json") : void 0;
  let initiative = fm2.initiative;
  if (!initiative && abilities) {
    const dexAbility = abilities.find((a) => a.ability === "dex");
    if (dexAbility) {
      const modifier = Math.floor((dexAbility.score - 10) / 2);
      initiative = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    }
  }
  const data = {
    // Basic identity
    name: fm2.name ?? file.basename,
    size: fm2.size,
    type: fm2.type,
    typeTags: fm2.type_tags ?? fm2.typeTags,
    // Alignment (use explicit fields or parse from combined)
    alignmentLawChaos: fm2.alignmentLawChaos ?? alignmentParts.lawChaos,
    alignmentGoodEvil: fm2.alignmentGoodEvil ?? alignmentParts.goodEvil,
    alignmentOverride: fm2.alignmentOverride ?? alignmentParts.override,
    // Combat stats
    ac: fm2.ac,
    initiative,
    hp: fm2.hp,
    hitDice: fm2.hit_dice ?? fm2.hitDice,
    // Abilities
    abilities,
    pb: fm2.pb ?? calculatePBFromCR(fm2.cr),
    // Fallback: berechne aus CR
    // CR & XP
    cr: fm2.cr,
    xp: fm2.xp,
    // Speeds
    speeds: fm2.speeds_json ? parseJson(fm2.speeds_json, "speeds_json") : void 0,
    // Saves & Skills
    saves: fm2.saves_json ? parseJson(fm2.saves_json, "saves_json") : void 0,
    skills: fm2.skills_json ? parseJson(fm2.skills_json, "skills_json") : void 0,
    // Senses & Languages
    sensesList: fm2.senses,
    languagesList: fm2.languages,
    passivesList: fm2.passives,
    // Defenses
    damageVulnerabilitiesList: fm2.damage_vulnerabilities,
    damageResistancesList: fm2.damage_resistances,
    damageImmunitiesList: fm2.damage_immunities,
    conditionImmunitiesList: fm2.condition_immunities,
    gearList: fm2.gear,
    // Entries & Spellcasting (JSON fields)
    entries: fm2.entries_structured_json ? parseJson(fm2.entries_structured_json, "entries_structured_json") : void 0,
    spellcasting: fm2.spellcasting_json ? parseJson(fm2.spellcasting_json, "spellcasting_json") : void 0,
    // Legacy fields
    traits: fm2.traits,
    actions: fm2.actions,
    legendary: fm2.legendary
  };
  if (!data.speeds && (fm2.speed_walk || fm2.speed_fly || fm2.speed_swim || fm2.speed_climb || fm2.speed_burrow)) {
    data.speeds = {};
    if (fm2.speed_walk) data.speeds.walk = { distance: fm2.speed_walk };
    if (fm2.speed_fly) {
      data.speeds.fly = {
        distance: fm2.speed_fly,
        hover: fm2.speed_fly_hover === true || fm2.speed_fly_hover === "true"
      };
    }
    if (fm2.speed_swim) data.speeds.swim = { distance: fm2.speed_swim };
    if (fm2.speed_climb) data.speeds.climb = { distance: fm2.speed_climb };
    if (fm2.speed_burrow) data.speeds.burrow = { distance: fm2.speed_burrow };
  }
  if (data.spellcasting && !data.entries) {
    try {
      console.log(`[Preset Migration] Migrating spellcasting data for ${data.name}`);
      const spellEntry = spellcastingDataToEntry(data.spellcasting);
      if (!spellEntry.name) {
        spellEntry.name = "Spellcasting";
      }
      data.entries = [spellEntry];
      delete data.spellcasting;
      console.log(`[Preset Migration] Successfully migrated spellcasting for ${data.name}`);
    } catch (err) {
      console.error(`[Preset Migration] Failed to migrate spellcasting for ${data.name}:`, err);
    }
  } else if (data.spellcasting && data.entries) {
    const hasSpellcastingEntry = data.entries.some(
      (entry) => entry.entryType === "spellcasting" || entry.spellGroups || entry.spellAbility
    );
    if (!hasSpellcastingEntry) {
      try {
        console.log(`[Preset Migration] Adding missing spellcasting entry for ${data.name}`);
        const spellEntry = spellcastingDataToEntry(data.spellcasting);
        if (!spellEntry.name) {
          spellEntry.name = "Spellcasting";
        }
        data.entries.push(spellEntry);
        delete data.spellcasting;
        console.log(`[Preset Migration] Successfully added spellcasting entry for ${data.name}`);
      } catch (err) {
        console.error(`[Preset Migration] Failed to add spellcasting entry for ${data.name}:`, err);
      }
    } else {
      console.log(`[Preset Migration] Removing duplicate spellcasting_json for ${data.name}`);
      delete data.spellcasting;
    }
  }
  console.log("[Preset Loader] Loaded preset:", data.name, {
    type: data.type,
    size: data.size,
    typeTags: data.typeTags,
    alignmentLawChaos: data.alignmentLawChaos,
    alignmentGoodEvil: data.alignmentGoodEvil,
    alignmentOverride: data.alignmentOverride,
    initiative: data.initiative,
    pb: data.pb,
    hasEntries: !!data.entries,
    entriesCount: data.entries?.length ?? 0,
    hasSpellcasting: !!data.spellcasting,
    hasSpeeds: !!data.speeds,
    hasSaves: !!data.saves,
    hasSkills: !!data.skills,
    hasSenses: !!data.sensesList,
    hasLanguages: !!data.languagesList,
    hasPassives: !!data.passivesList
  });
  return data;
}
async function findCreaturePresets(app, query, options = {}) {
  const { limit = 10, category } = options;
  const files = await listPresetFiles(app);
  const results = [];
  for (const file of files) {
    if (category) {
      const inCategory = file.path.includes(`/${category}/`);
      if (!inCategory) continue;
    }
    const name = file.basename.toLowerCase();
    const q = query.toLowerCase();
    let score = 0;
    if (name === q) {
      score = 1e3;
    } else if (name.startsWith(q)) {
      score = 900 - Math.abs(name.length - q.length);
    } else if (name.includes(q)) {
      score = 700 - name.indexOf(q);
    } else {
      const tokens = name.split(/[\s-]/);
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].startsWith(q)) {
          score = 600 - i * 10;
          break;
        }
      }
    }
    if (score > 0) {
      try {
        const data = await loadCreaturePreset(app, file);
        results.push({ file, data, score });
      } catch (err) {
        console.warn(`Failed to load preset ${file.path}:`, err);
      }
    }
    if (results.length >= limit * 2) break;
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
async function getPresetCategories(app) {
  const files = await listPresetFiles(app);
  const categories = /* @__PURE__ */ new Set();
  for (const file of files) {
    const match = file.path.match(/\/Presets\/Creatures\/([^/]+)\//);
    if (match) {
      categories.add(match[1]);
    }
  }
  return Array.from(categories).sort();
}
var PRESETS_DIR, PRESET_PIPELINE, ensurePresetDir, listPresetFiles, watchPresetDir;
var init_creature_presets = __esm({
  "src/apps/library/core/creature-presets.ts"() {
    "use strict";
    init_file_pipeline();
    init_entry_model();
    PRESETS_DIR = "SaltMarcher/Presets/Creatures";
    PRESET_PIPELINE = createVaultFilePipeline({
      dir: PRESETS_DIR,
      defaultBaseName: "Preset",
      getBaseName: (data) => data.name,
      toContent: () => "",
      // Presets werden nicht geschrieben, nur gelesen
      sanitizeName: (name) => name.replace(/[\\/:*?"<>|]/g, "-")
    });
    ensurePresetDir = PRESET_PIPELINE.ensure;
    listPresetFiles = PRESET_PIPELINE.list;
    watchPresetDir = PRESET_PIPELINE.watch;
  }
});

// src/apps/library/core/spell-files.ts
function asStringArray(value) {
  if (!Array.isArray(value)) return void 0;
  return value.map((entry) => typeof entry === "string" ? entry : String(entry ?? ""));
function asBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  return void 0;
async function loadSpellFile(app, file) {
  const cache = app.metadataCache.getFileCache(file);
  const frontmatter = cache?.frontmatter ?? {};
  const rawLevel = frontmatter.level;
  const level = typeof rawLevel === "number" ? rawLevel : typeof rawLevel === "string" ? Number(rawLevel) : void 0;
  const data = {
    name: typeof frontmatter.name === "string" && frontmatter.name.trim().length > 0 ? frontmatter.name.trim() : file.basename,
    level: Number.isFinite(level) ? level : void 0,
    school: typeof frontmatter.school === "string" ? frontmatter.school : void 0,
    casting_time: typeof frontmatter.casting_time === "string" ? frontmatter.casting_time : void 0,
    range: typeof frontmatter.range === "string" ? frontmatter.range : void 0,
    components: asStringArray(frontmatter.components),
    materials: typeof frontmatter.materials === "string" ? frontmatter.materials : void 0,
    duration: typeof frontmatter.duration === "string" ? frontmatter.duration : void 0,
    concentration: asBoolean(frontmatter.concentration),
    ritual: asBoolean(frontmatter.ritual),
    classes: asStringArray(frontmatter.classes),
    save_ability: typeof frontmatter.save_ability === "string" ? frontmatter.save_ability : void 0,
    save_effect: typeof frontmatter.save_effect === "string" ? frontmatter.save_effect : void 0,
    attack: typeof frontmatter.attack === "string" ? frontmatter.attack : void 0,
    damage: typeof frontmatter.damage === "string" ? frontmatter.damage : void 0,
    damage_type: typeof frontmatter.damage_type === "string" ? frontmatter.damage_type : void 0,
    description: typeof frontmatter.description === "string" ? frontmatter.description : void 0,
    higher_levels: typeof frontmatter.higher_levels === "string" ? frontmatter.higher_levels : void 0
  };
  return data;
}
var LibrarySourceWatcherHub = class {
  constructor() {
    this.registry = /* @__PURE__ */ new Map();
  }
  subscribe(source, factory, listener) {
    let entry = this.registry.get(source);
    if (!entry) {
      const listeners2 = /* @__PURE__ */ new Set();
      const stop = factory(() => {
        for (const cb of listeners2) {
          try {
            cb();
          } catch (err) {
            console.error("Library watch callback failed", err);
          }
        }
      });
      entry = { stop, listeners: listeners2 };
      this.registry.set(source, entry);
    }
    entry.listeners.add(listener);
    return () => {
      const current = this.registry.get(source);
      if (!current) return;
      current.listeners.delete(listener);
      if (current.listeners.size === 0) {
        try {
          current.stop?.();
        } catch (err) {
          console.error("Failed to stop library watcher", err);
        }
        this.registry.delete(source);
      }
    };
  }
};
init_creature_files();
  constructor(app, preset, onSubmit) {
    if (typeof preset === "string" || preset === void 0) {
      const presetName = typeof preset === "string" ? preset : void 0;
      this.data = { name: presetName?.trim() || "Neuer Zauber" };
    } else {
      this.data = {
        ...preset,
        components: preset.components ? [...preset.components] : void 0,
        classes: preset.classes ? [...preset.classes] : void 0
      };
    }
      const initial = Number.isFinite(this.data.level) ? String(this.data.level) : "0";
      dd.setValue(initial);
      this.data.level = parseInt(initial, 10);
        const parsed = parseInt(v, 10);
        this.data.level = Number.isFinite(parsed) ? parsed : void 0;
      const schools = ["", "Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
      for (const s of schools) dd.addOption(s, s || "(keine)");
      dd.setValue(this.data.school || "");
      dd.onChange((v) => this.data.school = v || void 0);
      t.setPlaceholder("1 Aktion").setValue(this.data.casting_time || "").onChange((v) => this.data.casting_time = v.trim() || void 0);
      t.setPlaceholder("60 Fu\xDF").setValue(this.data.range || "").onChange((v) => this.data.range = v.trim() || void 0);
    let cV = this.data.components?.includes("V") ?? false;
    let cS = this.data.components?.includes("S") ?? false;
    let cM = this.data.components?.includes("M") ?? false;
    const mkCb = (label, on, initial) => {
      cb.checked = initial;
    mkCb("V", (v) => cV = v, cV);
    mkCb("S", (v) => cS = v, cS);
    }, cM);
    updateComps();
      t.setPlaceholder("winzige Kugel aus Guano und Schwefel").setValue(this.data.materials || "").onChange((v) => this.data.materials = v.trim() || void 0);
      t.setPlaceholder("Augenblicklich / Konzentration, bis zu 1 Minute").setValue(this.data.duration || "").onChange((v) => this.data.duration = v.trim() || void 0);
    cbConc.checked = !!this.data.concentration;
    cbConc.addEventListener("change", () => this.data.concentration = cbConc.checked);
    cbRit.checked = !!this.data.ritual;
      dd.setValue(this.data.attack || "");
      dd.setValue(this.data.save_ability || "");
      t.setPlaceholder("Half on save / Negates \u2026").setValue(this.data.save_effect || "").onChange((v) => this.data.save_effect = v.trim() || void 0);
      t.setPlaceholder("8d6").setValue(this.data.damage || "").onChange((v) => this.data.damage = v.trim() || void 0);
      t.setPlaceholder("fire / radiant \u2026").setValue(this.data.damage_type || "").onChange((v) => this.data.damage_type = v.trim() || void 0);
// src/apps/library/core/data-sources.ts
init_creature_files();
init_spell_files();
init_item_files();
init_equipment_files();
async function readFrontmatter(app, file) {
  const cached = app.metadataCache.getFileCache(file)?.frontmatter;
  if (cached && typeof cached === "object") {
    return cached;
  }
  const content = await app.vault.read(file);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const lines = match[1].split(/\r?\n/);
  const data = {};
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const rawKey = line.slice(0, idx).trim();
    if (!rawKey) continue;
    let rawValue = line.slice(idx + 1).trim();
    if (!rawValue) {
      data[rawKey] = rawValue;
      continue;
    if (/^".*"$/.test(rawValue)) {
      rawValue = rawValue.slice(1, -1);
    }
    const num = Number(rawValue);
    data[rawKey] = Number.isFinite(num) && rawValue === String(num) ? num : rawValue;
  return data;
}
async function loadCreatureEntry(app, file) {
  const fm2 = await readFrontmatter(app, file);
  const type = typeof fm2.type === "string" ? fm2.type : void 0;
  const crValue = typeof fm2.cr === "string" ? fm2.cr : typeof fm2.cr === "number" ? String(fm2.cr) : void 0;
  return { file, name: file.basename, type, cr: crValue };
}
async function loadSpellEntry(app, file) {
  const fm2 = await readFrontmatter(app, file);
  const school = typeof fm2.school === "string" ? fm2.school : void 0;
  const rawLevel = fm2.level;
  const level = typeof rawLevel === "number" ? rawLevel : typeof rawLevel === "string" ? Number(rawLevel) : void 0;
  const casting_time = typeof fm2.casting_time === "string" ? fm2.casting_time : void 0;
  const duration = typeof fm2.duration === "string" ? fm2.duration : void 0;
  const concentration = typeof fm2.concentration === "boolean" ? fm2.concentration : void 0;
  const ritual = typeof fm2.ritual === "boolean" ? fm2.ritual : void 0;
  const description = typeof fm2.description === "string" ? fm2.description : void 0;
    name: file.basename,
    school,
    level: Number.isFinite(level) ? level : void 0,
    casting_time,
    duration,
    concentration,
    ritual,
    description
async function loadItemEntry(app, file) {
  const fm2 = await readFrontmatter(app, file);
  const category = typeof fm2.category === "string" ? fm2.category : void 0;
  const rarity = typeof fm2.rarity === "string" ? fm2.rarity : void 0;
  return { file, name: file.basename, category, rarity };
}
async function loadEquipmentEntry(app, file) {
  const fm2 = await readFrontmatter(app, file);
  const type = typeof fm2.type === "string" ? fm2.type : void 0;
  const roleCandidate = [
    fm2.weapon_category,
    fm2.armor_category,
    fm2.tool_category,
    fm2.gear_category
  ].find((value) => typeof value === "string" && value.length > 0);
  return { file, name: file.basename, type, role: roleCandidate };
}
var LIBRARY_DATA_SOURCES = {
  creatures: {
    id: "creatures",
    list: (app) => listCreatureFiles(app),
    watch: (app, onChange) => watchCreatureDir(app, onChange),
    load: loadCreatureEntry
  },
  spells: {
    id: "spells",
    list: (app) => listSpellFiles(app),
    watch: (app, onChange) => watchSpellDir(app, onChange),
    load: loadSpellEntry
  },
  items: {
    id: "items",
    list: (app) => listItemFiles(app),
    watch: (app, onChange) => watchItemDir(app, onChange),
    load: loadItemEntry
  },
  equipment: {
    id: "equipment",
    list: (app) => listEquipmentFiles(app),
    watch: (app, onChange) => watchEquipmentDir(app, onChange),
    load: loadEquipmentEntry
};

// src/apps/library/view/filter-registry.ts
var RARITY_ORDER = /* @__PURE__ */ new Map([
  ["common", 0],
  ["uncommon", 1],
  ["rare", 2],
  ["very rare", 3],
  ["legendary", 4],
  ["artifact", 5]
]);
function rarityOrder(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  return RARITY_ORDER.get(value.toLowerCase()) ?? Number.POSITIVE_INFINITY;
}
function parseCr(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  if (value.includes("/")) {
    const [num, denom] = value.split("/").map((part) => Number(part.trim()));
    if (Number.isFinite(num) && Number.isFinite(denom) && denom !== 0) {
      return num / denom;
    }
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}
function formatSpellLevel(level) {
  if (level == null) return "Unknown";
  if (level === 0) return "Cantrip";
  return `Level ${level}`;
}
var LIBRARY_LIST_SCHEMAS = {
  creatures: {
    filters: [
      {
        id: "type",
        label: "Type",
        getValues: (entry) => [entry.type]
      },
      {
        id: "cr",
        label: "CR",
        getValues: (entry) => [entry.cr],
        sortComparator: (a, b) => parseCr(a) - parseCr(b)
      }
    ],
    sorts: [
      {
        id: "name",
        label: "Name",
        compare: (a, b) => a.name.localeCompare(b.name)
      },
      {
        id: "type",
        label: "Type",
        compare: (a, b) => (a.type || "").localeCompare(b.type || "") || a.name.localeCompare(b.name)
      },
      {
        id: "cr",
        label: "CR",
        compare: (a, b) => parseCr(a.cr) - parseCr(b.cr) || a.name.localeCompare(b.name)
      }
    ],
    search: (entry) => [entry.type, entry.cr].filter((value) => Boolean(value))
  },
  spells: {
    filters: [
      {
        id: "school",
        label: "School",
        getValues: (entry) => [entry.school]
      },
      {
        id: "level",
        label: "Level",
        getValues: (entry) => [entry.level != null ? String(entry.level) : void 0],
        sortComparator: (a, b) => Number(a) - Number(b),
        formatOption: (value) => formatSpellLevel(Number(value))
      },
      {
        id: "ritual",
        label: "Ritual",
        getValues: (entry) => [entry.ritual == null ? void 0 : entry.ritual ? "true" : "false"],
        emptyLabel: "All",
        formatOption: (value) => value === "true" ? "Only rituals" : "No rituals"
      }
    ],
    sorts: [
      {
        id: "name",
        label: "Name",
        compare: (a, b) => a.name.localeCompare(b.name)
      },
      {
        id: "level",
        label: "Level",
        compare: (a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name)
      },
      {
        id: "school",
        label: "School",
        compare: (a, b) => (a.school || "").localeCompare(b.school || "") || a.name.localeCompare(b.name)
      }
    ],
    search: (entry) => [
      entry.school,
      entry.level != null ? formatSpellLevel(entry.level) : void 0,
      entry.casting_time,
      entry.duration,
      entry.description
    ].filter((value) => Boolean(value))
  },
  items: {
    filters: [
      {
        id: "category",
        label: "Category",
        getValues: (entry) => [entry.category]
      },
      {
        id: "rarity",
        label: "Rarity",
        getValues: (entry) => [entry.rarity],
        sortComparator: (a, b) => rarityOrder(a) - rarityOrder(b) || a.localeCompare(b)
      }
    ],
    sorts: [
      {
        id: "name",
        label: "Name",
        compare: (a, b) => a.name.localeCompare(b.name)
      },
      {
        id: "rarity",
        label: "Rarity",
        compare: (a, b) => rarityOrder(a.rarity) - rarityOrder(b.rarity) || a.name.localeCompare(b.name)
      },
      {
        id: "category",
        label: "Category",
        compare: (a, b) => (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name)
      }
    ],
    search: (entry) => [entry.category, entry.rarity].filter((value) => Boolean(value))
  },
  equipment: {
    filters: [
      {
        id: "type",
        label: "Type",
        getValues: (entry) => [entry.type]
      },
      {
        id: "role",
        label: "Role",
        getValues: (entry) => [entry.role]
      }
    ],
    sorts: [
      {
        id: "name",
        label: "Name",
        compare: (a, b) => a.name.localeCompare(b.name)
      },
      {
        id: "type",
        label: "Type",
        compare: (a, b) => (a.type || "").localeCompare(b.type || "") || a.name.localeCompare(b.name)
      },
      {
        id: "role",
        label: "Role",
        compare: (a, b) => (a.role || "").localeCompare(b.role || "") || a.name.localeCompare(b.name)
      }
    ],
    search: (entry) => [entry.type, entry.role].filter((value) => Boolean(value))
  }
};

// src/apps/library/view/filterable-mode.ts
var LibraryListState = class {
  constructor(schema) {
    this.schema = schema;
    this.filters = /* @__PURE__ */ new Map();
    this.sortDirection = "asc";
  }
  ensureSortAvailable(sorts) {
    if (!sorts.length) {
      this.sortId = void 0;
      this.sortDirection = "asc";
      return;
    if (!this.sortId || !sorts.some((option) => option.id === this.sortId)) {
      this.sortId = sorts[0].id;
      this.sortDirection = "asc";
  }
  getSortId() {
    return this.sortId;
  }
  getSortDirection() {
    return this.sortDirection;
  }
  setSort(id) {
    if (this.sortId === id) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortId = id;
      this.sortDirection = "asc";
    }
  }
  getFilterValue(id) {
    return this.filters.get(id);
  }
  setFilterValue(id, value) {
    if (value) {
      this.filters.set(id, value);
    } else {
      this.filters.delete(id);
    }
  }
  hasFilters() {
    return this.filters.size > 0;
  }
  clearFilters() {
    this.filters.clear();
  }
  pruneInvalidFilters(options) {
    for (const [id, value] of Array.from(this.filters.entries())) {
      if (!value) continue;
      if (!options.get(id)?.includes(value)) {
        this.filters.delete(id);
      }
    }
  }
  matches(entry, filters) {
    if (!this.filters.size) return true;
    for (const [id, selected] of this.filters.entries()) {
      if (!selected) continue;
      const definition = filters.find((filter) => filter.id === id);
      if (!definition) continue;
      const values = (definition.getValues(entry) || []).map((value) => (value ?? "").trim()).filter((value) => Boolean(value));
      if (!values.includes(selected)) {
        return false;
      }
    }
    return true;
  }
};
function renderFeedback(container, kind, message) {
  container.createDiv({ cls: `sm-cc-feedback sm-cc-feedback--${kind}`, text: message });
}
var FilterableLibraryRenderer = class extends BaseModeRenderer {
  constructor(app, container, watchers, mode) {
    super(app, container);
    this.watchers = watchers;
    this.entries = [];
    this.renderToken = 0;
    this.mode = mode;
    this.source = LIBRARY_DATA_SOURCES[mode];
    this.schema = LIBRARY_LIST_SCHEMAS[mode];
    this.state = new LibraryListState(this.schema);
    await this.refreshEntries();
    if (this.isDisposed()) return;
    const unsubscribe = this.watchers.subscribe(this.mode, (onChange) => this.source.watch(this.app, onChange), () => {
      void this.handleSourceChange();
    this.registerCleanup(unsubscribe);
  render() {
    this.renderInternal();
  }
  getEmptyMessage() {
    return "No entries found.";
  }
  getErrorMessage() {
    return "Failed to load entries.";
  }
  async reloadEntries() {
    await this.refreshEntries();
    if (!this.isDisposed()) {
  }
  getFilterSelection(id) {
    return this.state.getFilterValue(id);
  }
  async handleSourceChange() {
    await this.refreshEntries();
    if (!this.isDisposed()) {
    }
  }
  async refreshEntries() {
    try {
      const files = await this.source.list(this.app);
      const entries = await Promise.all(files.map((file) => this.source.load(this.app, file)));
      this.entries = entries;
      this.loadError = void 0;
    } catch (err) {
      console.error("Failed to load library entries", err);
      this.entries = [];
      this.loadError = err;
    }
  }
  renderInternal() {
    const token = ++this.renderToken;
    const container = this.container;
    container.empty();
    if (this.loadError) {
      renderFeedback(container, "error", this.getErrorMessage());
      return;
    }
    const filters = this.schema.filters;
    const sorts = this.schema.sorts;
    this.state.ensureSortAvailable(sorts);
    const optionValues = this.collectFilterOptions(this.entries, filters);
    this.state.pruneInvalidFilters(optionValues);
    if (filters.length || sorts.length) {
      this.renderControls(container, filters, sorts, optionValues);
    }
    const query = this.query;
    const prepared = this.entries.map((entry) => ({
      entry,
      score: this.computeSearchScore(entry, query)
    }));
    const filtered = prepared.filter((item) => this.state.matches(item.entry, filters));
    const visible = query ? filtered.filter((item) => item.score > -Infinity) : filtered;
    const sortDef = sorts.find((option) => option.id === this.state.getSortId()) ?? sorts[0];
    visible.sort((a, b) => {
      if (query && a.score !== b.score) {
        return b.score - a.score;
      }
      let comparison = sortDef ? sortDef.compare(a.entry, b.entry) : a.entry.name.localeCompare(b.entry.name);
      if (comparison === 0) {
        comparison = a.entry.name.localeCompare(b.entry.name);
      }
      return this.state.getSortDirection() === "asc" ? comparison : -comparison;
    if (token !== this.renderToken || this.isDisposed()) {
      return;
    }
    if (!visible.length) {
      renderFeedback(container, "empty", this.getEmptyMessage());
      return;
    }
    for (const item of visible) {
      const row = container.createDiv({ cls: "sm-cc-item" });
      this.renderEntry(row, item.entry);
    }
  }
  collectFilterOptions(entries, filters) {
    const options = /* @__PURE__ */ new Map();
    for (const filter of filters) {
      const values = /* @__PURE__ */ new Set();
      for (const entry of entries) {
        const rawValues = filter.getValues(entry) || [];
        for (const raw of rawValues) {
          const value = (raw ?? "").trim();
          if (value) {
            values.add(value);
          }
        }
      }
      const list = Array.from(values);
      const comparator = filter.sortComparator ?? ((a, b) => a.localeCompare(b, void 0, { sensitivity: "base" }));
      list.sort(comparator);
      options.set(filter.id, list);
    }
    return options;
  }
  renderControls(container, filters, sorts, optionValues) {
    const controls = container.createDiv({ cls: "sm-cc-controls" });
    if (filters.length) {
      const filterContainer = controls.createDiv({ cls: "sm-cc-filters" });
      filterContainer.createEl("h4", { text: "Filter", cls: "sm-cc-section-header" });
      const filterContent = filterContainer.createDiv({ cls: "sm-cc-filter-content" });
      for (const filter of filters) {
        const wrapper = filterContent.createDiv({ cls: "sm-cc-filter" });
        wrapper.createEl("label", { text: `${filter.label}: ` });
        const select = wrapper.createEl("select");
        select.createEl("option", { value: "", text: filter.emptyLabel ?? "All" });
        const values = optionValues.get(filter.id) ?? [];
        for (const value of values) {
          select.createEl("option", { value, text: filter.formatOption ? filter.formatOption(value) : value });
        select.value = this.state.getFilterValue(filter.id) ?? "";
        select.onchange = () => {
          this.state.setFilterValue(filter.id, select.value);
          this.render();
        };
      }
      if (this.state.hasFilters()) {
        const clearBtn = filterContent.createEl("button", { text: "Clear filters", cls: "sm-cc-clear-filters" });
        clearBtn.onclick = () => {
          this.state.clearFilters();
          this.render();
        };
      }
    }
    if (sorts.length) {
      const sortContainer = controls.createDiv({ cls: "sm-cc-sorting" });
      sortContainer.createEl("h4", { text: "Sort", cls: "sm-cc-section-header" });
      const sortContent = sortContainer.createDiv({ cls: "sm-cc-sort-content" });
      const sortWrapper = sortContent.createDiv({ cls: "sm-cc-sort" });
      sortWrapper.createEl("label", { text: "Sort by: " });
      const select = sortWrapper.createEl("select");
      for (const option of sorts) {
        select.createEl("option", { value: option.id, text: option.label });
      }
      const currentSort = this.state.getSortId();
      if (currentSort) {
        select.value = currentSort;
      }
      select.onchange = () => {
        this.state.setSort(select.value);
        updateDirectionVisuals();
        this.render();
      };
      const directionBtn = sortContent.createEl("button", {
        cls: "sm-cc-sort-direction",
        attr: { "aria-label": this.state.getSortDirection() === "asc" ? "Sort ascending" : "Sort descending" }
      });
      const updateDirectionVisuals = () => {
        directionBtn.innerHTML = this.state.getSortDirection() === "asc" ? "\u2191" : "\u2193";
        directionBtn.title = this.state.getSortDirection() === "asc" ? "Ascending" : "Descending";
      };
      updateDirectionVisuals();
      directionBtn.onclick = () => {
        const targetId = this.state.getSortId() ?? sorts[0]?.id;
        if (!targetId) return;
        this.state.setSort(targetId);
        updateDirectionVisuals();
        this.render();
  computeSearchScore(entry, query) {
    if (!query) return 1e-4;
    const candidates = [entry.name, ...this.schema.search(entry)];
    let best = -Infinity;
    for (const candidate of candidates) {
      if (!candidate) continue;
      const score = scoreName(candidate.toLowerCase(), query);
      if (score > best) {
        best = score;
      }
    }
    return best;
  }
};

// src/apps/library/view/creatures.ts
var CreaturesRenderer = class extends FilterableLibraryRenderer {
  constructor(app, container, watchers) {
    super(app, container, watchers, "creatures");
  }
  renderEntry(row, entry) {
    const nameContainer = row.createDiv({ cls: "sm-cc-item__name-container" });
    nameContainer.createDiv({ cls: "sm-cc-item__name", text: entry.name });
    const infoContainer = row.createDiv({ cls: "sm-cc-item__info" });
    if (entry.type) {
      infoContainer.createEl("span", { cls: "sm-cc-item__type", text: entry.type });
    }
    if (entry.cr) {
      infoContainer.createEl("span", { cls: "sm-cc-item__cr", text: `CR ${entry.cr}` });
    }
    const actions = row.createDiv({ cls: "sm-cc-item__actions" });
    const openBtn = actions.createEl("button", { text: "Open", cls: "sm-cc-item__action" });
    openBtn.onclick = async () => {
      await this.app.workspace.openLinkText(entry.file.path, entry.file.path, true);
    };
    const editBtn = actions.createEl("button", { text: "Edit", cls: "sm-cc-item__action sm-cc-item__action--edit" });
    editBtn.onclick = async () => {
      try {
        const creatureData = await this.loadCreatureData(entry.file);
        new CreateCreatureModal(this.app, creatureData.name, async (data) => {
          const file = await createCreatureFile(this.app, data);
          await this.reloadEntries();
          await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
        }, creatureData).open();
      } catch (err) {
        console.error("Failed to load creature for editing", err);
      }
    };
    const duplicateBtn = actions.createEl("button", { text: "Duplicate", cls: "sm-cc-item__action" });
    duplicateBtn.onclick = async () => {
      try {
        await this.duplicateCreature(entry.file);
      } catch (err) {
        console.error("Failed to duplicate creature", err);
      }
    };
    const deleteBtn = actions.createEl("button", { text: "Delete", cls: "sm-cc-item__action sm-cc-item__action--danger" });
    deleteBtn.onclick = async () => {
      const question = `Delete ${entry.name}? This moves the file to the trash.`;
      const confirmation = typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm(question) : true;
      if (!confirmation) return;
      try {
        await this.app.vault.trash(entry.file, true);
        await this.reloadEntries();
      } catch (err) {
        console.error("Failed to delete creature", err);
      }
    };
      await this.reloadEntries();
      await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
  async loadCreatureData(file) {
    return await loadCreaturePreset(this.app, file);
  }
  async duplicateCreature(file) {
    const data = await this.loadCreatureData(file);
    const duplicateName = this.buildDuplicateName(data.name);
    const duplicateData = { ...data, name: duplicateName };
    const duplicateFile = await createCreatureFile(this.app, duplicateData);
    await this.reloadEntries();
    await this.app.workspace.openLinkText(duplicateFile.path, duplicateFile.path, true, { state: { mode: "source" } });
  }
  buildDuplicateName(originalName) {
    const base = originalName.trim() || "Creature";
    const suffix = " copy";
    if (!base.endsWith(suffix)) {
      return `${base}${suffix}`;
    }
    const match = base.match(/ copy (\d+)$/);
    if (!match) {
      return `${base} 2`;
    }
    const next = Number(match[1]) + 1;
    return base.replace(/ copy \d+$/, ` copy ${next}`);
  }
var SpellsRenderer = class extends FilterableLibraryRenderer {
  constructor(app, container, watchers) {
    super(app, container, watchers, "spells");
  }
  renderEntry(row, entry) {
    const table = row.createDiv({ cls: "sm-cc-spell" });
    const header = table.createDiv({ cls: "sm-cc-spell__header" });
    header.createDiv({ cls: "sm-cc-item__name", text: entry.name });
    const meta = table.createDiv({ cls: "sm-cc-spell__meta" });
    meta.createEl("span", { cls: "sm-cc-spell__level", text: formatSpellLevel(entry.level) });
    if (entry.school) {
      meta.createEl("span", { cls: "sm-cc-spell__school", text: entry.school });
    }
    if (entry.casting_time) {
      meta.createEl("span", { cls: "sm-cc-spell__casting", text: entry.casting_time });
    }
    if (entry.duration) {
      meta.createEl("span", { cls: "sm-cc-spell__duration", text: entry.duration });
    }
    const flags = meta.createDiv({ cls: "sm-cc-spell__flags" });
    if (entry.concentration) {
      flags.createEl("span", { cls: "sm-cc-spell__flag", text: "Concentration" });
    }
    if (entry.ritual) {
      flags.createEl("span", { cls: "sm-cc-spell__flag", text: "Ritual" });
    }
    const actions = table.createDiv({ cls: "sm-cc-item__actions" });
    const openBtn = actions.createEl("button", { text: "Open", cls: "sm-cc-item__action" });
    openBtn.onclick = async () => {
      await this.app.workspace.openLinkText(entry.file.path, entry.file.path, true);
    };
    const editBtn = actions.createEl("button", { text: "Edit", cls: "sm-cc-item__action sm-cc-item__action--edit" });
    editBtn.onclick = async () => {
      try {
        const spellData = await loadSpellFile(this.app, entry.file);
        new CreateSpellModal(this.app, spellData, async (data) => {
          const content = spellToMarkdown(data);
          await this.app.vault.modify(entry.file, content);
          await this.reloadEntries();
        }).open();
      } catch (err) {
        console.error("Failed to load spell for editing", err);
      }
    };
    const copyBtn = actions.createEl("button", { text: "Copy", cls: "sm-cc-item__action" });
    copyBtn.onclick = async () => {
      try {
        const content = await this.app.vault.read(entry.file);
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(content);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = content;
          textarea.setAttribute("readonly", "");
          textarea.style.position = "absolute";
          textarea.style.left = "-9999px";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
      } catch (err) {
        console.error("Failed to copy spell", err);
      }
    };
    const preset = this.buildSpellPreset(name);
    new CreateSpellModal(this.app, preset, async (data) => {
      await this.reloadEntries();
      await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
  buildSpellPreset(name) {
    const trimmed = name.trim();
    const preset = { name: trimmed || "Neuer Zauber" };
    const levelFilter = this.getFilterSelection("level");
    if (levelFilter) {
      const parsed = Number(levelFilter);
      if (Number.isFinite(parsed)) preset.level = parsed;
    }
    const schoolFilter = this.getFilterSelection("school");
    if (schoolFilter) preset.school = schoolFilter;
    const ritualFilter = this.getFilterSelection("ritual");
    if (ritualFilter === "true") preset.ritual = true;
    if (ritualFilter === "false") preset.ritual = false;
    return preset;
  }
var ItemsRenderer = class extends FilterableLibraryRenderer {
  constructor(app, container, watchers) {
    super(app, container, watchers, "items");
  }
  renderEntry(row, entry) {
    row.createDiv({ cls: "sm-cc-item__name", text: entry.name });
    const info = row.createDiv({ cls: "sm-cc-item__info" });
    if (entry.category) {
      info.createEl("span", { cls: "sm-cc-item__type", text: entry.category });
    }
    if (entry.rarity) {
      info.createEl("span", { cls: "sm-cc-item__cr", text: entry.rarity });
    }
    const actions = row.createDiv({ cls: "sm-cc-item__actions" });
    const importBtn = actions.createEl("button", { text: "Import", cls: "sm-cc-item__action" });
    importBtn.onclick = async () => {
      await this.handleImport(entry.file);
    };
    const openBtn = actions.createEl("button", { text: "Open", cls: "sm-cc-item__action" });
    openBtn.onclick = async () => {
      await this.app.workspace.openLinkText(entry.file.path, entry.file.path, true);
    };
  async handleCreate(name) {
    new CreateItemModal(this.app, name, async (data) => {
      const file = await createItemFile(this.app, data);
      await this.reloadEntries();
      await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
    }).open();
        await this.reloadEntries();
        await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
      console.error("Failed to import item", err);
var EquipmentRenderer = class extends FilterableLibraryRenderer {
  constructor(app, container, watchers) {
    super(app, container, watchers, "equipment");
  }
  renderEntry(row, entry) {
    row.createDiv({ cls: "sm-cc-item__name", text: entry.name });
    const info = row.createDiv({ cls: "sm-cc-item__info" });
    if (entry.type) {
      info.createEl("span", { cls: "sm-cc-item__type", text: entry.type });
    }
    if (entry.role) {
      info.createEl("span", { cls: "sm-cc-item__cr", text: entry.role });
    }
    const actions = row.createDiv({ cls: "sm-cc-item__actions" });
    const importBtn = actions.createEl("button", { text: "Import", cls: "sm-cc-item__action" });
    importBtn.onclick = async () => {
      await this.handleImport(entry.file);
    };
    const openBtn = actions.createEl("button", { text: "Open", cls: "sm-cc-item__action" });
    openBtn.onclick = async () => {
      await this.app.workspace.openLinkText(entry.file.path, entry.file.path, true);
    };
  async handleCreate(name) {
    new CreateEquipmentModal(this.app, name, async (data) => {
      const file = await createEquipmentFile(this.app, data);
      await this.reloadEntries();
      await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
    }).open();
        await this.reloadEntries();
        await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
      console.error("Failed to import equipment", err);
    this.queries = /* @__PURE__ */ new Map();
    this.watchers = new LibrarySourceWatcherHub();
    search.value = this.getQueryForMode(this.mode);
      const trimmed = search.value.trim();
      this.queries.set(this.mode, trimmed);
      this.activeRenderer?.setQuery(trimmed);
      const query2 = this.getQueryForMode(mode);
      if (this.searchInput) this.searchInput.value = query2;
      this.activeRenderer.setQuery(query2);
    const query = this.getQueryForMode(mode);
    if (this.searchInput) this.searchInput.value = query;
    renderer.setQuery(query);
        return new CreaturesRenderer(this.app, container, this.watchers);
        return new SpellsRenderer(this.app, container, this.watchers);
        return new ItemsRenderer(this.app, container, this.watchers);
        return new EquipmentRenderer(this.app, container, this.watchers);
  getQueryForMode(mode) {
    return this.queries.get(mode) ?? "";
  }
