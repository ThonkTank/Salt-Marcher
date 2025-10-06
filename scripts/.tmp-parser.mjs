// src/apps/library/core/reference-parser.ts
function parseReferenceStatblock(markdown) {
  const lines = markdown.split("\n").map((line) => line.trim());
  const data = { name: "" };
  data.name = extractH1(lines);
  const subtitle = extractSubtitle(lines);
  if (subtitle) {
    const parsed = parseSubtitle(subtitle);
    data.size = parsed.size;
    data.type = parsed.type;
    data.typeTags = parsed.typeTags;
    data.alignmentLawChaos = parsed.alignmentLawChaos;
    data.alignmentGoodEvil = parsed.alignmentGoodEvil;
    data.alignmentOverride = parsed.alignmentOverride;
  }
  const bullets = extractBulletStats(lines);
  data.ac = bullets.get("armor class");
  const initiativeText = bullets.get("initiative");
  if (initiativeText) {
    const match = initiativeText.match(/^([+\-]?\d+)/);
    data.initiative = match ? match[1] : initiativeText;
  }
  const hpText = bullets.get("hit points");
  if (hpText) {
    const { hp, hitDice } = parseHitPoints(hpText);
    data.hp = hp;
    data.hitDice = hitDice;
  }
  const speedText = bullets.get("speed");
  if (speedText) {
    data.speeds = parseSpeed(speedText);
  }
  const skillsText = bullets.get("skills");
  if (skillsText) {
    data.skillsProf = parseSkills(skillsText);
  }
  const sensesText = bullets.get("senses");
  if (sensesText) {
    const { senses, passives } = parseSenses(sensesText);
    data.sensesList = senses;
    data.passivesList = passives;
  }
  const languagesText = bullets.get("languages");
  if (languagesText) {
    data.languagesList = parseList(languagesText);
  }
  const gearText = bullets.get("gear");
  if (gearText) {
    data.gearList = parseList(gearText);
  }
  const immunitiesText = bullets.get("immunities");
  if (immunitiesText) {
    data.damageImmunitiesList = parseList(immunitiesText);
  }
  const resistancesText = bullets.get("resistances");
  if (resistancesText) {
    data.damageResistancesList = parseList(resistancesText);
  }
  const vulnerabilitiesText = bullets.get("vulnerabilities");
  if (vulnerabilitiesText) {
    data.damageVulnerabilitiesList = parseList(vulnerabilitiesText);
  }
  const crText = bullets.get("cr");
  if (crText) {
    const { cr, xp, pb } = parseCRLine(crText);
    data.cr = cr;
    data.xp = xp;
    data.pb = pb || calculatePBFromCR(cr);
  }
  const abilityTable = extractAbilityTable(lines);
  if (abilityTable) {
    data.str = abilityTable.str.score;
    data.dex = abilityTable.dex.score;
    data.con = abilityTable.con.score;
    data.int = abilityTable.int.score;
    data.wis = abilityTable.wis.score;
    data.cha = abilityTable.cha.score;
    data.saveProf = determineSaveProficiencies(abilityTable, data.pb);
  }
  const sections = extractSections(lines);
  data.entries = parseSections(sections, data);
  data.spellcasting = extractSpellcasting(data.entries || []);
  return data;
}
function extractH1(lines) {
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)$/);
    if (match) return match[1].trim();
  }
  return "Unknown Creature";
}
function extractSubtitle(lines) {
  for (const line of lines) {
    const match = line.match(/^\*(.+)\*$/);
    if (match) return match[1].trim();
  }
  return null;
}
function parseSubtitle(subtitle) {
  const parts = subtitle.split(",").map((p) => p.trim());
  if (parts.length === 0) return {};
  const firstPart = parts[0];
  const secondPart = parts[1];
  const result = {};
  const typeMatch = firstPart.match(/^(\w+)\s+(.+)$/);
  if (typeMatch) {
    result.size = typeMatch[1];
    const typeWithTags = typeMatch[2];
    const tagMatch = typeWithTags.match(/^(.+?)\s*\((.+)\)$/);
    if (tagMatch) {
      result.type = tagMatch[1].trim();
      result.typeTags = tagMatch[2].split(",").map((t) => t.trim());
    } else {
      result.type = typeWithTags;
    }
  }
  if (secondPart) {
    const alignment = parseAlignment(secondPart);
    result.alignmentLawChaos = alignment.lawChaos;
    result.alignmentGoodEvil = alignment.goodEvil;
    result.alignmentOverride = alignment.override;
  }
  return result;
}
function parseAlignment(text) {
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
    if (["Good", "Evil"].includes(word)) {
      return { goodEvil: word };
    } else if (["Lawful", "Chaotic"].includes(word)) {
      return { lawChaos: word };
    }
  }
  return { override: text };
}
function extractBulletStats(lines) {
  const stats = /* @__PURE__ */ new Map();
  for (const line of lines) {
    let match = line.match(/^-?\s*\*\*(.+?):\*\*\s*(.+)$/);
    if (match) {
      const label = match[1].toLowerCase().trim();
      const value = match[2].trim();
      stats.set(label, value);
      continue;
    }
    match = line.match(/^-?\s*\*\*(.+?)\*\*:?\s+(.+)$/);
    if (match) {
      const label = match[1].toLowerCase().trim();
      const value = match[2].trim();
      stats.set(label, value);
    }
  }
  return stats;
}
function parseHitPoints(text) {
  const match = text.match(/^(\d+)\s*(?:\((.+?)\))?/);
  if (match) {
    return {
      hp: match[1],
      hitDice: match[2] || void 0
    };
  }
  return { hp: text };
}
function parseSpeed(text) {
  const speeds = {};
  const parts = text.split(",").map((p) => p.trim());
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === 0 && !part.match(/^(walk|climb|fly|swim|burrow)/i)) {
      const match2 = part.match(/^(\d+\s*ft\.?)/);
      if (match2) {
        speeds.walk = { distance: match2[1] };
      }
      continue;
    }
    const match = part.match(/^(walk|climb|fly|swim|burrow)\s+(\d+\s*ft\.?)(\s*\(hover\))?/i);
    if (match) {
      const type = match[1].toLowerCase();
      const distance = match[2];
      const hover = !!match[3];
      if (type === "walk" || type === "climb" || type === "fly" || type === "swim" || type === "burrow") {
        speeds[type] = { distance };
        if (type === "fly" && hover) {
          speeds.fly.hover = true;
        }
      }
    }
  }
  return speeds;
}
function parseSkills(text) {
  const skills = [];
  const parts = text.split(",").map((p) => p.trim());
  for (const part of parts) {
    const match = part.match(/^(.+?)\s+[+\-]\d+/);
    if (match) {
      skills.push(match[1].trim());
    }
  }
  return skills;
}
function parseSenses(text) {
  const parts = text.split(";").map((p) => p.trim());
  const senses = [];
  const passives = [];
  for (const part of parts) {
    if (part.toLowerCase().startsWith("passive")) {
      passives.push(part);
    } else if (part) {
      senses.push(...part.split(",").map((s) => s.trim()).filter(Boolean));
    }
  }
  return { senses, passives };
}
function parseList(text) {
  return text.split(/[,;]/).map((item) => item.trim()).filter(Boolean);
}
function parseCRLine(text) {
  const result = {};
  const crMatch = text.match(/^([\d/]+)/);
  if (crMatch) {
    result.cr = crMatch[1];
  }
  const xpMatch = text.match(/XP\s+([\d,]+)/);
  if (xpMatch) {
    result.xp = xpMatch[1].replace(/,/g, "");
  }
  const pbMatch = text.match(/PB\s+([+\-]?\d+)/);
  if (pbMatch) {
    result.pb = pbMatch[1];
  }
  return result;
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
function extractAbilityTable(lines) {
  let tableStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("| STAT |") || lines[i].includes("|STAT|")) {
      tableStart = i;
      break;
    }
  }
  if (tableStart === -1) return null;
  const result = {};
  for (let i = tableStart + 2; i < tableStart + 8 && i < lines.length; i++) {
    const line = lines[i];
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 4) {
      const stat = cells[0].toLowerCase();
      const score = cells[1];
      const mod = parseInt(cells[2].replace(/[+\-]/g, ""));
      const save = parseInt(cells[3].replace(/[+\-]/g, ""));
      if (["str", "dex", "con", "int", "wis", "cha"].includes(stat)) {
        result[stat] = { score, mod, save };
      }
    }
  }
  return result;
}
function determineSaveProficiencies(table, pb) {
  const proficiencies = {};
  const pbValue = pb ? parseInt(pb.replace(/[+\-]/g, "")) : 0;
  for (const [key, data] of Object.entries(table)) {
    if (Math.abs(data.save) > Math.abs(data.mod) + 0.5) {
      proficiencies[key] = true;
    }
  }
  return proficiencies;
}
function extractSections(lines) {
  const sections = [];
  let currentSection = null;
  for (const line of lines) {
    const headerMatch = line.match(/^###\s+(.+)$/);
    if (headerMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        category: headerMatch[1].trim(),
        content: []
      };
    } else if (currentSection && line) {
      currentSection.content.push(line);
    }
  }
  if (currentSection) {
    sections.push(currentSection);
  }
  return sections;
}
function parseSections(sections, data) {
  const entries = [];
  const categoryMap = {
    "traits": "trait",
    "actions": "action",
    "bonus actions": "bonus",
    "reactions": "reaction",
    "legendary actions": "legendary"
  };
  for (const section of sections) {
    const category = categoryMap[section.category.toLowerCase()];
    if (!category) continue;
    const parsedEntries = parseEntries(section.content, category, data);
    entries.push(...parsedEntries);
  }
  return entries.length > 0 ? entries : void 0;
}
function parseEntries(lines, category, data) {
  const entries = [];
  let currentEntry = null;
  for (const line of lines) {
    const entryMatch = line.match(/^\*\*\*(.+?)\.\*\*\*(.*)$/);
    if (entryMatch) {
      if (currentEntry) {
        entries.push(currentEntry);
      }
      const nameAndRecharge = entryMatch[1];
      const rest = entryMatch[2].trim();
      const rechargeMatch = nameAndRecharge.match(/^(.+?)\s*\((Recharge\s+\d+-?\d*|\d+\/Day)\)$/i);
      const name = rechargeMatch ? rechargeMatch[1].trim() : nameAndRecharge.trim();
      const recharge = rechargeMatch ? rechargeMatch[2] : void 0;
      currentEntry = {
        category,
        name,
        recharge,
        text: rest
      };
    } else if (currentEntry && line) {
      currentEntry.text = (currentEntry.text ? currentEntry.text + " " : "") + line;
    }
  }
  if (currentEntry) {
    entries.push(currentEntry);
  }
  for (const entry of entries) {
    if (entry.text) {
      parseEntryDetails(entry, data);
    }
  }
  return entries;
}
function parseEntryDetails(entry, data) {
  if (!entry.text) return;
  const text = entry.text;
  const attackMatch = text.match(/\*(Melee|Ranged)\s+Attack\s+Roll:\*\s*([+\-]\d+),\s*(?:reach|range)\s+([^.]+)/i);
  if (attackMatch) {
    entry.kind = `${attackMatch[1]} Attack Roll`;
    entry.to_hit = attackMatch[2];
    entry.range = attackMatch[3].trim();
  }
  const targetMatch = text.match(/\b(one\s+(?:target|creature)|all\s+creatures?|each\s+creature\s+(?:in|within)[^.]*)/i);
  if (targetMatch) {
    entry.target = targetMatch[1].trim();
  }
  const damageMatch = text.match(/(\d+)\s*\(([^)]+)\)\s+(\w+)\s+damage/i);
  if (damageMatch) {
    entry.damage = `${damageMatch[1]} (${damageMatch[2]}) ${damageMatch[3]}`;
  }
  const saveMatch = text.match(/\*(\w+)\s+Saving\s+Throw\*:\s*DC\s+(\d+)/i);
  if (saveMatch) {
    entry.save_ability = saveMatch[1].substring(0, 3).toUpperCase();
    entry.save_dc = parseInt(saveMatch[2]);
  }
  const successMatch = text.match(/\*Success:\*\s*([^.*]+)/i);
  if (successMatch) {
    entry.save_effect = successMatch[1].trim();
  }
}
function extractSpellcasting(entries) {
  const spellcastingEntry = entries.find(
    (e) => e.category === "action" && e.name.toLowerCase().includes("spellcasting")
  );
  if (!spellcastingEntry || !spellcastingEntry.text) return void 0;
  const text = spellcastingEntry.text;
  const data = {
    title: spellcastingEntry.name,
    groups: []
  };
  const dcMatch = text.match(/spell\s+save\s+DC\s+(\d+)/i);
  if (dcMatch) {
    data.saveDcOverride = parseInt(dcMatch[1]);
  }
  const abilityMatch = text.match(/using\s+(\w+)\s+as\s+the\s+spellcasting\s+ability/i);
  if (abilityMatch) {
    const abilityName = abilityMatch[1].toLowerCase();
    const abilityMap = {
      "strength": "str",
      "dexterity": "dex",
      "constitution": "con",
      "intelligence": "int",
      "wisdom": "wis",
      "charisma": "cha"
    };
    data.ability = abilityMap[abilityName];
  }
  data.summary = text;
  return data;
}
export {
  parseReferenceStatblock
};
