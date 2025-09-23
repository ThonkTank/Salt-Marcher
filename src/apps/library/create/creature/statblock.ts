import { abilityMod, formatSigned, parseIntSafe } from "../shared/stat-utils";

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type SavingThrow = {
    enabled: boolean;
    override: string;
};

export type SkillEntry = {
    name: string;
    bonus: string;
};

export type SpellListGroup = {
    label: string;
    spells: string[];
};

export interface CreatureStatblock {
    name: string;
    size: string;
    type: string;
    alignment: string;
    armorClass: string;
    hitPoints: string;
    hitDice: string;
    speed: string;
    abilityScores: Record<AbilityKey, string>;
    proficiencyBonus: string;
    challengeRating: string;
    initiativeEnabled: boolean;
    initiative: string;
    savingThrows: Record<AbilityKey, SavingThrow>;
    skills: SkillEntry[];
    senses: string[];
    languages: string[];
    resistances: string[];
    immunities: string[];
    vulnerabilities: string[];
    traits: string;
    actions: string;
    bonusActions: string;
    reactions: string;
    legendaryActions: string;
    spellcastingAbility: string;
    spellSaveDc: string;
    spellAttackBonus: string;
    spellcastingAtWill: string[];
    spellcastingPerDay: SpellListGroup[];
    spellcastingPerRest: SpellListGroup[];
    spellcastingBySlot: SpellListGroup[];
    spellcastingOther: SpellListGroup[];
    equipment: string;
    xpEnabled: boolean;
    experiencePoints: string;
}

export const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export const ABILITY_LABEL: Record<AbilityKey, string> = {
    str: "Strength",
    dex: "Dexterity",
    con: "Constitution",
    int: "Intelligence",
    wis: "Wisdom",
    cha: "Charisma",
};

const SKILL_ABILITIES: Record<string, AbilityKey> = {
    Athletics: "str",
    Acrobatics: "dex",
    "Sleight of Hand": "dex",
    Stealth: "dex",
    Arcana: "int",
    History: "int",
    Investigation: "int",
    Nature: "int",
    Religion: "int",
    "Animal Handling": "wis",
    Insight: "wis",
    Medicine: "wis",
    Perception: "wis",
    Survival: "wis",
    Deception: "cha",
    Intimidation: "cha",
    Performance: "cha",
    Persuasion: "cha",
};

export const SKILL_OPTIONS = Object.keys(SKILL_ABILITIES).sort((a, b) => a.localeCompare(b));

function normalizeListInput(values: string[]): string[] {
    return values
        .map((value) => value?.trim())
        .filter((value): value is string => !!value)
        .map((value) => value.replace(/\s+/g, " "));
}

export function createEmptyStatblock(): CreatureStatblock {
    const abilityScores: Record<AbilityKey, string> = {
        str: "",
        dex: "",
        con: "",
        int: "",
        wis: "",
        cha: "",
    };
    const savingThrows: Record<AbilityKey, SavingThrow> = {
        str: { enabled: false, override: "" },
        dex: { enabled: false, override: "" },
        con: { enabled: false, override: "" },
        int: { enabled: false, override: "" },
        wis: { enabled: false, override: "" },
        cha: { enabled: false, override: "" },
    };
    return {
        name: "Neue Kreatur",
        size: "",
        type: "",
        alignment: "",
        armorClass: "",
        hitPoints: "",
        hitDice: "",
        speed: "",
        abilityScores,
        proficiencyBonus: "",
        challengeRating: "",
        initiativeEnabled: false,
        initiative: "",
        savingThrows,
        skills: [],
        senses: [],
        languages: [],
        resistances: [],
        immunities: [],
        vulnerabilities: [],
        traits: "",
        actions: "",
        bonusActions: "",
        reactions: "",
        legendaryActions: "",
        spellcastingAbility: "",
        spellSaveDc: "",
        spellAttackBonus: "",
        spellcastingAtWill: [],
        spellcastingPerDay: [],
        spellcastingPerRest: [],
        spellcastingBySlot: [],
        spellcastingOther: [],
        equipment: "",
        xpEnabled: false,
        experiencePoints: "",
    };
}

export function cloneStatblock(statblock: CreatureStatblock): CreatureStatblock {
    return {
        ...statblock,
        abilityScores: { ...statblock.abilityScores },
        savingThrows: {
            str: { ...statblock.savingThrows.str },
            dex: { ...statblock.savingThrows.dex },
            con: { ...statblock.savingThrows.con },
            int: { ...statblock.savingThrows.int },
            wis: { ...statblock.savingThrows.wis },
            cha: { ...statblock.savingThrows.cha },
        },
        skills: statblock.skills.map((skill) => ({ ...skill })),
        senses: [...statblock.senses],
        languages: [...statblock.languages],
        resistances: [...statblock.resistances],
        immunities: [...statblock.immunities],
        vulnerabilities: [...statblock.vulnerabilities],
        spellcastingAtWill: [...statblock.spellcastingAtWill],
        spellcastingPerDay: statblock.spellcastingPerDay.map((group) => ({ label: group.label, spells: [...group.spells] })),
        spellcastingPerRest: statblock.spellcastingPerRest.map((group) => ({ label: group.label, spells: [...group.spells] })),
        spellcastingBySlot: statblock.spellcastingBySlot.map((group) => ({ label: group.label, spells: [...group.spells] })),
        spellcastingOther: statblock.spellcastingOther.map((group) => ({ label: group.label, spells: [...group.spells] })),
    };
}

function abilityModFormatted(score: string): string {
    const mod = abilityMod(score);
    return formatSigned(mod);
}

function buildSavingThrows(statblock: CreatureStatblock): string | null {
    const { savingThrows, abilityScores, proficiencyBonus } = statblock;
    const pb = parseIntSafe(proficiencyBonus);
    const entries: string[] = [];
    (Object.keys(savingThrows) as AbilityKey[]).forEach((key) => {
        const option = savingThrows[key];
        if (!option.enabled) return;
        const override = option.override.trim();
        const label = key.toUpperCase();
        if (override) {
            entries.push(`${label} ${override}`);
            return;
        }
        const mod = abilityMod(abilityScores[key]);
        const bonus = Number.isNaN(pb) ? mod : mod + pb;
        entries.push(`${label} ${formatSigned(bonus)}`);
    });
    if (!entries.length) return null;
    return `Saving Throws ${entries.join(", ")}`;
}

function buildSkills(statblock: CreatureStatblock): string | null {
    if (!statblock.skills.length) return null;
    const entries = statblock.skills
        .map((skill) => {
            const ability = SKILL_ABILITIES[skill.name];
            if (!ability) return `${skill.name} ${skill.bonus || ""}`.trim();
            const base = abilityMod(statblock.abilityScores[ability]);
            const bonusRaw = skill.bonus.trim();
            if (!bonusRaw) {
                return `${skill.name} ${formatSigned(base)}`;
            }
            const bonus = parseIntSafe(bonusRaw);
            if (Number.isNaN(bonus)) return `${skill.name} ${bonusRaw}`;
            return `${skill.name} ${formatSigned(bonus)}`;
        })
        .filter((entry) => !!entry.trim());
    if (!entries.length) return null;
    return `Skills ${entries.join(", ")}`;
}

function buildListLine(label: string, values: string[]): string | null {
    if (!values.length) return null;
    return `${label} ${values.join(", ")}`;
}

function buildSpellcastingSection(statblock: CreatureStatblock): string[] {
    const lines: string[] = [];
    const { spellcastingAbility, spellSaveDc, spellAttackBonus } = statblock;
    const summaryParts = normalizeListInput([
        spellcastingAbility ? `Ability ${spellcastingAbility}` : "",
        spellSaveDc ? `Save DC ${spellSaveDc}` : "",
        spellAttackBonus ? `Spell Attack ${spellAttackBonus}` : "",
    ]);
    if (
        summaryParts.length === 0 &&
        !statblock.spellcastingAtWill.length &&
        !statblock.spellcastingPerDay.length &&
        !statblock.spellcastingPerRest.length &&
        !statblock.spellcastingBySlot.length &&
        !statblock.spellcastingOther.length
    ) {
        return lines;
    }
    lines.push("## Spellcasting\n");
    if (summaryParts.length) {
        lines.push(summaryParts.join("; "));
        if (
            statblock.spellcastingAtWill.length ||
            statblock.spellcastingPerDay.length ||
            statblock.spellcastingPerRest.length ||
            statblock.spellcastingBySlot.length ||
            statblock.spellcastingOther.length
        ) {
            lines.push("");
        }
    }
    const pushList = (header: string, spells: string[]) => {
        if (!spells.length) return;
        lines.push(`- ${header}:`);
        spells.forEach((spell) => {
            lines.push(`  - ${spell}`);
        });
    };
    pushList("At Will", statblock.spellcastingAtWill);
    const pushGroups = (groups: SpellListGroup[]) => {
        groups.forEach((group) => {
            if (!group.label.trim() || !group.spells.length) return;
            pushList(group.label.trim(), group.spells);
        });
    };
    pushGroups(statblock.spellcastingPerDay);
    pushGroups(statblock.spellcastingPerRest);
    pushGroups(statblock.spellcastingBySlot);
    pushGroups(statblock.spellcastingOther);
    if (lines[lines.length - 1] !== "") lines.push("");
    return lines;
}

export function buildStatblockMarkdown(statblock: CreatureStatblock): string {
    const lines: string[] = [];
    const name = statblock.name.trim() || "Unnamed Creature";
    lines.push(`# ${name}`);
    const header = normalizeListInput([statblock.size, statblock.type, statblock.alignment]).join(", ");
    if (header) lines.push(header);
    lines.push("");

    const ac = statblock.armorClass.trim();
    const hp = statblock.hitPoints.trim();
    const hitDice = statblock.hitDice.trim();
    const initiativeLine = statblock.initiativeEnabled && statblock.initiative.trim()
        ? `Initiative ${statblock.initiative.trim()}`
        : "";
    const acParts = normalizeListInput([
        ac ? `AC ${ac}` : "",
        initiativeLine,
    ]);
    if (acParts.length) lines.push(acParts.join("    "));
    if (hp || hitDice) {
        lines.push(`HP ${hp || "-"}${hitDice ? ` (${hitDice})` : ""}`);
    }
    if (statblock.speed.trim()) {
        lines.push(`Speed ${statblock.speed.trim()}`);
    }
    lines.push("");

    lines.push("| Ability | Score |");
    lines.push("| ------: | :---- |");
    (Object.keys(statblock.abilityScores) as AbilityKey[]).forEach((key) => {
        const score = statblock.abilityScores[key];
        if (!score.trim()) return;
        const label = key.toUpperCase();
        lines.push(`| ${label} | ${score.trim()} (${abilityModFormatted(score)}) |`);
    });
    lines.push("");

    const savingThrows = buildSavingThrows(statblock);
    if (savingThrows) lines.push(savingThrows);
    const skills = buildSkills(statblock);
    if (skills) lines.push(skills);
    const resistances = buildListLine("Damage Resistances", statblock.resistances);
    if (resistances) lines.push(resistances);
    const immunities = buildListLine("Damage Immunities", statblock.immunities);
    if (immunities) lines.push(immunities);
    const vulnerabilities = buildListLine("Damage Vulnerabilities", statblock.vulnerabilities);
    if (vulnerabilities) lines.push(vulnerabilities);
    const senses = buildListLine("Senses", statblock.senses);
    if (senses) lines.push(senses);
    const languages = buildListLine("Languages", statblock.languages);
    if (languages) lines.push(languages);

    const cr = statblock.challengeRating.trim();
    const pbRaw = statblock.proficiencyBonus.trim();
    const xp = statblock.xpEnabled ? statblock.experiencePoints.trim() : "";
    const crLine = normalizeListInput([
        cr ? `CR ${cr}` : "",
        pbRaw ? `PB ${pbRaw}` : "",
        xp ? `XP ${xp}` : "",
    ]).join("; ");
    if (crLine) {
        lines.push(crLine);
    }
    lines.push("");

    const pushSection = (title: string, body: string) => {
        if (!body.trim()) return;
        lines.push(`## ${title}\n`);
        lines.push(body.trim());
        lines.push("");
    };

    pushSection("Traits", statblock.traits);
    pushSection("Actions", statblock.actions);
    pushSection("Bonus Actions", statblock.bonusActions);
    pushSection("Reactions", statblock.reactions);
    pushSection("Legendary Actions", statblock.legendaryActions);

    const spellcasting = buildSpellcastingSection(statblock);
    lines.push(...spellcasting);

    if (statblock.equipment.trim()) {
        lines.push("## Equipment & Notes\n");
        lines.push(statblock.equipment.trim());
        lines.push("");
    }

    return lines.join("\n");
}

export function parseListInput(raw: string): string[] {
    return normalizeListInput(raw.split(/[\n,]/g));
}

export function ensureSkillName(name: string): string {
    return name in SKILL_ABILITIES ? name : name.trim();
}

export function createSpellGroup(label = ""): SpellListGroup {
    return { label, spells: [] };
}

