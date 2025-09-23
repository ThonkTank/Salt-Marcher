// Re-export to keep feature-local import path while core still holds implementation
// src/apps/library/core/creature-files.ts
import { App, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";

export const CREATURES_DIR = "SaltMarcher/Creatures";

export type CreatureEntryAbilityKey = 'str'|'dex'|'con'|'int'|'wis'|'cha'|'best_of_str_dex';
export type CreatureEntryAbilitySource = { ability: CreatureEntryAbilityKey; proficient?: boolean };
export type CreatureEntryDamagePart = { dice: string; ability?: CreatureEntryAbilityKey; bonus?: string };
export type CreatureEntryUsage =
    | { type: 'passive' }
    | { type: 'recharge'; min?: number | null; max?: number | null }
    | { type: 'limited'; charges?: string | null; cost?: string | null };
export type CreatureEntryCategory = 'trait'|'action'|'bonus'|'reaction'|'legendary'|'lair';
export type CreatureEntry = {
    category: CreatureEntryCategory;
    name: string;
    kind?: string;
    to_hit?: string;
    to_hit_from?: CreatureEntryAbilitySource;
    range?: string;
    target?: string;
    save_ability?: string;
    save_dc?: number;
    save_effect?: string;
    damage?: string;
    damage_from?: CreatureEntryDamagePart;
    damage_extra?: CreatureEntryDamagePart[];
    usage?: CreatureEntryUsage;
    recharge?: string;
    text?: string;
};

export type SpellRef = { name: string; uses?: string; notes?: string };
export type SpellFrequencyMap = Record<string, SpellRef[]>;

export type StatblockData = {
    name: string;
    size?: string;
    type?: string;
    alignmentLawChaos?: string;
    alignmentGoodEvil?: string;
    ac?: string;
    initiative?: string;
    hp?: string;
    hitDice?: string;
    speedList?: string[];
    str?: string; dex?: string; con?: string; int?: string; wis?: string; cha?: string;
    pb?: string;
    saveProf?: { str?: boolean; dex?: boolean; con?: boolean; int?: boolean; wis?: boolean; cha?: boolean };
    skillsProf?: string[];
    skillsExpertise?: string[];
    sensesList?: string[];
    languagesList?: string[];
    resistances?: string[];
    immunities?: string[];
    vulnerabilities?: string[];
    equipmentNotes?: string;
    cr?: string;
    xp?: string;
    traits?: string; actions?: string; legendary?: string; lair?: string;
    entries?: CreatureEntry[];
    actionsList?: Array<{ name: string; kind?: string; to_hit?: string; range?: string; target?: string; save_ability?: string; save_dc?: number; save_effect?: string; damage?: string; recharge?: string; text?: string; }>;
    spellcastingAbility?: string;
    spellSaveDc?: string;
    spellAttackBonus?: string;
    spellsAtWill?: SpellRef[];
    spellsPerDay?: SpellFrequencyMap;
    spellsPerRest?: SpellFrequencyMap;
    spellsBySlot?: SpellFrequencyMap;
    spellsOther?: SpellFrequencyMap;
    /** @deprecated Legacy Feld, wird nur zum Import älterer Daten gelesen. */
    spellsKnown?: Array<{ name: string; level?: number; uses?: string; notes?: string }>;
};

type LegacySpeedFields = {
    speedWalk?: string | null;
    speedSwim?: string | null;
    speedFly?: string | null;
    speedBurrow?: string | null;
};

const LEGACY_SPEED_PREFIX: Record<Exclude<keyof LegacySpeedFields, "speedWalk">, string> = {
    speedSwim: "swim",
    speedFly: "fly",
    speedBurrow: "burrow",
};

const LEGACY_SPEED_KEYS: Array<keyof LegacySpeedFields> = [
    "speedWalk",
    "speedSwim",
    "speedFly",
    "speedBurrow",
];

const WALK_PREFIX = "walk ";

export function ensureSpeedList(d: StatblockData): string[] {
    const legacy = d as StatblockData & LegacySpeedFields;
    const out: string[] = [];
    const seen = new Set<string>();
    const pushNormalized = (value: string | null | undefined, typeKey?: string) => {
        if (typeof value !== "string") return;
        let trimmed = value.trim();
        if (!trimmed) return;
        if (typeKey) {
            const prefix = `${typeKey} `;
            if (!trimmed.toLowerCase().startsWith(prefix)) trimmed = `${typeKey} ${trimmed}`;
        } else if (trimmed.toLowerCase().startsWith(WALK_PREFIX)) {
            trimmed = trimmed.slice(WALK_PREFIX.length).trim();
        }
        const normalized = trimmed.replace(/\s+/g, " ").toLowerCase();
        if (seen.has(normalized)) return;
        seen.add(normalized);
        out.push(trimmed);
    };

    if (Array.isArray(d.speedList)) {
        for (const entry of d.speedList) {
            if (entry == null) continue;
            pushNormalized(typeof entry === "string" ? entry : String(entry));
        }
    }

    for (const key of LEGACY_SPEED_KEYS) {
        const value = legacy[key];
        const typeKey = key === "speedWalk" ? undefined : LEGACY_SPEED_PREFIX[key as Exclude<keyof LegacySpeedFields, "speedWalk">];
        pushNormalized(value, typeKey);
        if (value != null) delete legacy[key];
    }

    d.speedList = out;
    return d.speedList;
}

export async function ensureCreatureDir(app: App): Promise<TFolder> {
    const p = normalizePath(CREATURES_DIR);
    let f = app.vault.getAbstractFileByPath(p);
    if (f instanceof TFolder) return f;
    await app.vault.createFolder(p).catch(() => {});
    f = app.vault.getAbstractFileByPath(p);
    if (f instanceof TFolder) return f;
    throw new Error("Could not create creatures directory");
}

export function sanitizeFileName(name: string): string {
    const trimmed = (name || "Creature").trim();
    return trimmed.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").replace(/^\.+$/, "Creature").slice(0, 120);
}

export async function listCreatureFiles(app: App): Promise<TFile[]> {
    const dir = await ensureCreatureDir(app);
    const out: TFile[] = [];
    const walk = (folder: TFolder) => { for (const child of folder.children) { if (child instanceof TFolder) walk(child); else if (child instanceof TFile && child.extension === "md") out.push(child); } };
    walk(dir);
    return out;
}

export function watchCreatureDir(app: App, onChange: () => void): () => void {
    const base = normalizePath(CREATURES_DIR) + "/";
    const isInDir = (f: TAbstractFile) => (f instanceof TFile || f instanceof TFolder) && (f.path + "/").startsWith(base);
    const handler = (f: TAbstractFile) => { if (isInDir(f)) onChange?.(); };
    app.vault.on("create", handler); app.vault.on("delete", handler); app.vault.on("rename", handler); app.vault.on("modify", handler);
    return () => { app.vault.off("create", handler); app.vault.off("delete", handler); app.vault.off("rename", handler); app.vault.off("modify", handler); };
}

function yamlList(items?: string[]): string | undefined { if (!items || items.length === 0) return undefined; const safe = items.map(s => `"${(s ?? "").replace(/"/g, '\\"')}"`).join(", "); return `[${safe}]`; }
function parseNum(v?: string): number | null { if (!v) return null; const m = String(v).match(/-?\d+/); if (!m) return null; return Number(m[0]); }
function abilityMod(score?: string): number | null { const n = parseNum(score); if (n == null || Number.isNaN(n)) return null; return Math.floor((n - 10) / 2); }
function fmtSigned(n: number): string { return (n >= 0 ? "+" : "") + n; }
const SKILL_TO_ABILITY: Record<string, keyof Pick<StatblockData, 'str'|'dex'|'int'|'wis'|'cha'|'con'>> = { Athletics: 'str', Acrobatics: 'dex', 'Sleight of Hand': 'dex', Stealth: 'dex', Arcana: 'int', History: 'int', Investigation: 'int', Nature: 'int', Religion: 'int', 'Animal Handling': 'wis', Insight: 'wis', Medicine: 'wis', Perception: 'wis', Survival: 'wis', Deception: 'cha', Intimidation: 'cha', Performance: 'cha', Persuasion: 'cha', };
function composeAlignment(d: StatblockData): string | undefined { const a = d.alignmentLawChaos?.trim(); const b = d.alignmentGoodEvil?.trim(); if (!a && !b) return undefined; if ((a?.toLowerCase() === 'neutral') && (b?.toLowerCase() === 'neutral')) return 'Neutral'; return [a, b].filter(Boolean).join(' '); }

export function formatEntryUsage(entry: CreatureEntry): string | undefined {
    const usage = entry.usage;
    if (!usage) return entry.recharge || undefined;
    switch (usage.type) {
        case 'passive':
            return undefined;
        case 'recharge': {
            const { min, max } = usage;
            if (min != null && max != null) {
                if (min === max) return `Recharge ${min}`;
                return `Recharge ${min}–${max}`;
            }
            if (min != null) return `Recharge ${min}+`;
            if (max != null) return `Recharge ${max}`;
            return 'Recharge';
        }
        case 'limited': {
            const parts: string[] = [];
            if (usage.charges && usage.charges.trim()) parts.push(usage.charges.trim());
            if (usage.cost && usage.cost.trim()) parts.push(usage.cost.trim());
            if (parts.length === 0) return 'Limited Use';
            return `Limited Use (${parts.join('; ')})`;
        }
        default:
            return undefined;
    }
}

function abilityModForKey(d: StatblockData, ability?: CreatureEntryAbilityKey): number {
    if (!ability) return 0;
    if (ability === 'best_of_str_dex') return Math.max(abilityMod(d.str) ?? 0, abilityMod(d.dex) ?? 0);
    return abilityMod((d as any)[ability]) ?? 0;
}

function normalizeDamagePart(part?: CreatureEntryDamagePart | null): CreatureEntryDamagePart | null {
    if (!part) return null;
    const dice = part.dice?.trim();
    if (!dice) return null;
    return {
        dice,
        ability: part.ability,
        bonus: part.bonus?.trim() || undefined,
    };
}

function formatDamagePart(part: CreatureEntryDamagePart | null, d: StatblockData): string | null {
    if (!part) return null;
    const base = part.dice;
    if (!base) return null;
    const abilMod = abilityModForKey(d, part.ability);
    const modTxt = abilMod ? ` ${fmtSigned(abilMod)}` : '';
    const bonusTxt = part.bonus ? ` ${part.bonus}` : '';
    return `${base}${modTxt}${bonusTxt}`.trim();
}

export function computeEntryAutoDamageParts(entry: CreatureEntry, d: StatblockData): string[] {
    const out: string[] = [];
    const first = normalizeDamagePart(entry.damage_from);
    const extras = Array.isArray(entry.damage_extra) ? entry.damage_extra : [];
    const parts = [first, ...extras.map(normalizeDamagePart)];
    for (const p of parts) {
        const txt = formatDamagePart(p, d);
        if (txt) out.push(txt);
    }
    return out;
}

export function resolveEntryAutoDamage(entry: CreatureEntry, d: StatblockData): string | undefined {
    const parts = computeEntryAutoDamageParts(entry, d);
    if (!parts.length) return undefined;
    return parts.join('; ');
}

function sanitizeSpellRefLike(ref: { name?: string | null; uses?: string | null; notes?: string | null }): SpellRef | null {
    const name = ref.name?.trim();
    if (!name) return null;
    const uses = ref.uses?.trim() || undefined;
    const notes = ref.notes?.trim() || undefined;
    const out: SpellRef = { name };
    if (uses) out.uses = uses;
    if (notes) out.notes = notes;
    return out;
}

function sanitizeSpellList(list?: SpellRef[] | null): SpellRef[] | undefined {
    if (!Array.isArray(list)) return undefined;
    const sanitized = list
        .map((item) => sanitizeSpellRefLike(item))
        .filter((item): item is SpellRef => !!item);
    return sanitized.length ? sanitized : undefined;
}

function sanitizeSpellMap(map?: SpellFrequencyMap | null): SpellFrequencyMap | undefined {
    if (!map) return undefined;
    const out: SpellFrequencyMap = {};
    for (const [key, arr] of Object.entries(map)) {
        const trimmedKey = key?.trim();
        if (!trimmedKey) continue;
        const sanitizedList = sanitizeSpellList(arr);
        if (sanitizedList) out[trimmedKey] = sanitizedList;
    }
    return Object.keys(out).length ? out : undefined;
}

function formatSpellRefInline(ref: SpellRef): string {
    const extras = [ref.uses, ref.notes].map((v) => v?.trim()).filter((v): v is string => !!v);
    return extras.length ? `${ref.name} (${extras.join('; ')})` : ref.name;
}

function statblockToMarkdown(d: StatblockData): string {
    const hdr = [d.size || "", d.type || "", composeAlignment(d) || ""].filter(Boolean).join(", ");
    const name = d.name || "Unnamed Creature";
    const lines: string[] = [];
    const spellAbility = d.spellcastingAbility?.trim();
    const spellSaveDc = d.spellSaveDc?.trim();
    const spellAttackBonus = d.spellAttackBonus?.trim();
    let spellsAtWill = sanitizeSpellList(d.spellsAtWill);
    let spellsPerDay = sanitizeSpellMap(d.spellsPerDay);
    let spellsPerRest = sanitizeSpellMap(d.spellsPerRest);
    let spellsBySlot = sanitizeSpellMap(d.spellsBySlot);
    let spellsOther = sanitizeSpellMap(d.spellsOther);
    if (!spellsAtWill && !spellsPerDay && !spellsPerRest && !spellsBySlot && !spellsOther && Array.isArray(d.spellsKnown)) {
        for (const legacy of d.spellsKnown) {
            const sanitized = sanitizeSpellRefLike(legacy);
            if (!sanitized) continue;
            if (legacy.level == null) {
                (spellsOther ||= {});
                (spellsOther["Legacy"] ||= []).push(sanitized);
            } else {
                const key = String(legacy.level);
                (spellsBySlot ||= {});
                (spellsBySlot[key] ||= []).push(sanitized);
            }
        }
        spellsOther = sanitizeSpellMap(spellsOther);
        spellsBySlot = sanitizeSpellMap(spellsBySlot);
    }
    const hasSpellcastingData = !!(spellsAtWill || spellsPerDay || spellsPerRest || spellsBySlot || spellsOther);
    lines.push("---"); lines.push("smType: creature"); lines.push(`name: "${name.replace(/"/g, '\\"')}"`);
    if (d.size) lines.push(`size: "${d.size}"`); if (d.type) lines.push(`type: "${d.type}"`); const align = composeAlignment(d); if (align) lines.push(`alignment: "${align}"`);
    if (d.ac) lines.push(`ac: "${d.ac}"`); if (d.initiative) lines.push(`initiative: "${d.initiative}"`); if (d.hp) lines.push(`hp: "${d.hp}"`); if (d.hitDice) lines.push(`hit_dice: "${d.hitDice}"`);
    const speeds = ensureSpeedList(d);
    const speedsYaml = yamlList(speeds); if (speedsYaml) lines.push(`speeds: ${speedsYaml}`);
    if (d.str) lines.push(`str: "${d.str}"`); if (d.dex) lines.push(`dex: "${d.dex}"`); if (d.con) lines.push(`con: "${d.con}"`); if (d.int) lines.push(`int: "${d.int}"`); if (d.wis) lines.push(`wis: "${d.wis}"`); if (d.cha) lines.push(`cha: "${d.cha}"`); if (d.pb) lines.push(`pb: "${d.pb}"`);
    if (d.saveProf) { const profs = Object.entries(d.saveProf).filter(([, v]) => !!v).map(([k]) => k.toUpperCase()); if (profs.length) lines.push(`saves_prof: ${yamlList(profs)}`); }
    if (d.skillsProf && d.skillsProf.length) lines.push(`skills_prof: ${yamlList(d.skillsProf)}`); if (d.skillsExpertise && d.skillsExpertise.length) lines.push(`skills_expertise: ${yamlList(d.skillsExpertise)}`);
    const sensesYaml = yamlList(d.sensesList); if (sensesYaml) lines.push(`senses: ${sensesYaml}`);
    const langsYaml = yamlList(d.languagesList); if (langsYaml) lines.push(`languages: ${langsYaml}`);
    const resistancesYaml = yamlList(d.resistances); if (resistancesYaml) lines.push(`resistances: ${resistancesYaml}`);
    const immunitiesYaml = yamlList(d.immunities); if (immunitiesYaml) lines.push(`immunities: ${immunitiesYaml}`);
    const vulnerabilitiesYaml = yamlList(d.vulnerabilities); if (vulnerabilitiesYaml) lines.push(`vulnerabilities: ${vulnerabilitiesYaml}`);
    const equipmentNotes = d.equipmentNotes?.trim(); if (equipmentNotes) lines.push(`equipment_notes: "${equipmentNotes.replace(/"/g, '\\"').replace(/\r?\n/g, "\\n")}"`);
    if (d.cr) lines.push(`cr: "${d.cr}"`); if (d.xp) lines.push(`xp: "${d.xp}"`);
    if (spellAbility) lines.push(`spellcasting_ability: "${spellAbility.replace(/"/g, '\\"')}"`);
    if (spellSaveDc) lines.push(`spell_save_dc: "${spellSaveDc.replace(/"/g, '\\"')}"`);
    if (spellAttackBonus) lines.push(`spell_attack_bonus: "${spellAttackBonus.replace(/"/g, '\\"')}"`);
    const pushSpellJson = (key: string, value: unknown) => {
        const json = JSON.stringify(value).replace(/"/g, '\\"');
        lines.push(`${key}: "${json}"`);
    };
    if (spellsAtWill) pushSpellJson("spells_at_will_json", spellsAtWill);
    if (spellsPerDay) pushSpellJson("spells_per_day_json", spellsPerDay);
    if (spellsPerRest) pushSpellJson("spells_per_rest_json", spellsPerRest);
    if (spellsBySlot) pushSpellJson("spells_by_slot_json", spellsBySlot);
    if (spellsOther) pushSpellJson("spells_other_json", spellsOther);
    const entries = (d.entries && d.entries.length) ? d.entries : (d.actionsList && d.actionsList.length ? d.actionsList.map(a => ({ category: 'action' as const, ...a })) : undefined);
    if (entries && entries.length) { const json = JSON.stringify(entries).replace(/"/g, '\\"'); lines.push(`entries_structured_json: "${json}"`); }
    lines.push("---\n");
    lines.push(`# ${name}`); if (hdr) lines.push(hdr); lines.push("");
    if (d.ac || d.initiative) lines.push(`AC ${d.ac ?? "-"}    Initiative ${d.initiative ?? "-"}`);
    if (d.hp || d.hitDice) lines.push(`HP ${d.hp ?? "-"}${d.hitDice ? ` (${d.hitDice})` : ""}`);
    const speedsLine = speeds.slice(); if (speedsLine.length) lines.push(`Speed ${speedsLine.join(", ")}`);
    lines.push("");
    const abilities = [["STR", d.str],["DEX", d.dex],["CON", d.con],["INT", d.int],["WIS", d.wis],["CHA", d.cha]] as const; if (abilities.some(([_,v])=>!!v)) { lines.push("| Ability | Score |"); lines.push("| ------: | :---- |"); for (const [k,v] of abilities) if (v) lines.push(`| ${k} | ${v} |`); lines.push(""); }
    const pbNum = parseNum(d.pb) ?? 0; if (d.saveProf) { const parts: string[] = []; const map: Array<[keyof typeof d.saveProf, string, string|undefined]> = [['str','Str',d.str],['dex','Dex',d.dex],['con','Con',d.con],['int','Int',d.int],['wis','Wis',d.wis],['cha','Cha',d.cha]]; for (const [key,label,score] of map) { if (d.saveProf[key]) { const mod = abilityMod(score) ?? 0; parts.push(`${label} ${fmtSigned(mod + pbNum)}`); } } if (parts.length) lines.push(`Saves ${parts.join(", ")}`); }
    const getSet = (arr?: string[]) => new Set((arr || []).map(s => s.trim()).filter(Boolean)); const profSet = getSet(d.skillsProf); const expSet = getSet(d.skillsExpertise);
    if (profSet.size || expSet.size) { const parts: string[] = []; const allSkills = Array.from(new Set([...Object.keys(SKILL_TO_ABILITY)])); for (const sk of allSkills) { const hasProf = profSet.has(sk) || expSet.has(sk); if (!hasProf) continue; const abilKey = SKILL_TO_ABILITY[sk]; const mod = abilityMod((d as any)[abilKey]) ?? 0; const bonus = expSet.has(sk) ? pbNum * 2 : pbNum; parts.push(`${sk} ${fmtSigned(mod + bonus)}`); } if (parts.length) lines.push(`Skills ${parts.join(", ")}`); }
    if (d.resistances && d.resistances.length) lines.push(`Damage Resistances ${d.resistances.join(", ")}`);
    if (d.immunities && d.immunities.length) lines.push(`Damage Immunities ${d.immunities.join(", ")}`);
    if (d.vulnerabilities && d.vulnerabilities.length) lines.push(`Damage Vulnerabilities ${d.vulnerabilities.join(", ")}`);
    if (d.sensesList && d.sensesList.length) lines.push(`Senses ${d.sensesList.join(", ")}`);
    if (d.languagesList && d.languagesList.length) lines.push(`Languages ${d.languagesList.join(", ")}`);
    if (d.cr || d.pb || d.xp) { const bits: string[] = []; if (d.cr) bits.push(`CR ${d.cr}`); if (pbNum) bits.push(`PB ${fmtSigned(pbNum)}`); if (d.xp) bits.push(`XP ${d.xp}`); if (bits.length) lines.push(bits.join("; ")); }
    lines.push("");
    if (entries && entries.length) {
        const groups: Record<string, typeof entries> = { trait: [], action: [], bonus: [], reaction: [], legendary: [], lair: [] } as any;
        for (const e of entries) { (groups[e.category] ||= []).push(e); }
        const renderGroup = (title: string, arr: typeof entries) => {
            if (!arr || arr.length === 0) return;
            lines.push(`## ${title}\n`);
            for (const a of arr) {
                const usage = formatEntryUsage(a) ?? a.recharge;
                const headParts = [a.name || "Unnamed", usage].filter(Boolean).join(" – ");
                lines.push(`- **${headParts}**`);
                const sub: string[] = [];
                if (a.kind) sub.push(a.kind);
                if (a.to_hit) sub.push(`to hit ${a.to_hit}`);
                else if (a.to_hit_from) {
                    const pb = parseNum(d.pb) ?? 0;
                    const total = abilityModForKey(d, a.to_hit_from.ability) + (a.to_hit_from.proficient ? pb : 0);
                    sub.push(`to hit ${fmtSigned(total)}`);
                }
                if (a.range) sub.push(a.range);
                if (a.target) sub.push(a.target);
                const autoDamage = computeEntryAutoDamageParts(a, d);
                if (autoDamage.length) {
                    sub.push(`Damage ${autoDamage[0]}`);
                    for (const extra of autoDamage.slice(1)) sub.push(`+ ${extra}`);
                } else if (a.damage) {
                    sub.push(a.damage);
                }
                if (a.save_ability) sub.push(`Save ${a.save_ability}${a.save_dc ? ` DC ${a.save_dc}` : ''}${a.save_effect ? ` (${a.save_effect})` : ''}`);
                if (sub.length) lines.push(`  - ${sub.join(", ")}`);
                if (a.text && a.text.trim()) lines.push(`  ${a.text.trim()}`);
            }
            lines.push("");
        };
        renderGroup("Traits", groups.trait);
        renderGroup("Actions", groups.action);
        renderGroup("Bonus Actions", groups.bonus);
        renderGroup("Reactions", groups.reaction);
        renderGroup("Legendary Actions", groups.legendary);
        renderGroup("Lair Actions", groups.lair);
    } else {
        if (d.traits) { lines.push("## Traits\n"); lines.push(d.traits.trim()); lines.push(""); }
        if (d.actions) { lines.push("## Actions\n"); lines.push(d.actions.trim()); lines.push(""); }
        if (d.legendary) { lines.push("## Legendary Actions\n"); lines.push(d.legendary.trim()); lines.push(""); }
        if (d.lair) { lines.push("## Lair Actions\n"); lines.push(d.lair.trim()); lines.push(""); }
    }
    if (hasSpellcastingData) {
        lines.push("## Spellcasting\n");
        const summaryParts: string[] = [];
        if (spellAbility) summaryParts.push(`Ability ${spellAbility}`);
        if (spellSaveDc) summaryParts.push(`Save DC ${spellSaveDc}`);
        if (spellAttackBonus) summaryParts.push(`Spell Attack ${spellAttackBonus}`);
        const pushList = (header: string, spells: SpellRef[] | undefined) => {
            if (!spells || spells.length === 0) return;
            lines.push(`- ${header}:`);
            for (const spell of spells) lines.push(`  - ${formatSpellRefInline(spell)}`);
        };
        if (summaryParts.length) {
            lines.push(summaryParts.join("; "));
            const hasLists = Boolean(
                (spellsAtWill && spellsAtWill.length) ||
                (spellsPerDay && Object.keys(spellsPerDay).length) ||
                (spellsPerRest && Object.keys(spellsPerRest).length) ||
                (spellsBySlot && Object.keys(spellsBySlot).length) ||
                (spellsOther && Object.keys(spellsOther).length)
            );
            if (hasLists) lines.push("");
        }
        pushList("At Will", spellsAtWill);
        if (spellsPerDay) {
            const ordered = Object.entries(spellsPerDay).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" }));
            for (const [key, list] of ordered) pushList(key, list);
        }
        if (spellsPerRest) {
            const ordered = Object.entries(spellsPerRest).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" }));
            for (const [key, list] of ordered) pushList(key, list);
        }
        if (spellsBySlot) {
            const formatSlotKey = (key: string) => {
                const asNum = Number(key);
                if (Number.isFinite(asNum)) {
                    return asNum === 0 ? "Cantrips (Grad 0)" : `Grad ${asNum}`;
                }
                return key;
            };
            const ordered = Object.entries(spellsBySlot).sort((a, b) => {
                const numA = Number(a[0]);
                const numB = Number(b[0]);
                if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
                if (Number.isFinite(numA)) return -1;
                if (Number.isFinite(numB)) return 1;
                return a[0].localeCompare(b[0], undefined, { sensitivity: "base" });
            });
            for (const [key, list] of ordered) pushList(formatSlotKey(key), list);
        }
        if (spellsOther) {
            const ordered = Object.entries(spellsOther).sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }));
            for (const [key, list] of ordered) pushList(key, list);
        }
        lines.push("");
    }
    if (equipmentNotes) { lines.push("## Equipment & Notes\n"); lines.push(equipmentNotes); lines.push(""); }
    return lines.join("\n");
}

export async function createCreatureFile(app: App, d: StatblockData): Promise<TFile> {
    const folder = await ensureCreatureDir(app);
    const baseName = sanitizeFileName(d.name || "Creature");
    let fileName = `${baseName}.md`; let path = normalizePath(`${folder.path}/${fileName}`); let i = 2;
    while (app.vault.getAbstractFileByPath(path)) { fileName = `${baseName} (${i}).md`; path = normalizePath(`${folder.path}/${fileName}`); i++; }
    const content = statblockToMarkdown(d);
    const file = await app.vault.create(path, content);
    return file;
}

