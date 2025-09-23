// src/apps/library/create/creature/section-entries.ts
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import type {
  CreatureEntry,
  CreatureEntryDamagePart,
  CreatureEntryUsage,
  StatblockData,
} from "../../core/creature-files";
import { formatEntryUsage, resolveEntryAutoDamage } from "../../core/creature-files";
import { abilityMod, formatSigned, parseIntSafe } from "../shared/stat-utils";
import {
  CREATURE_ABILITY_SELECTIONS,
  CREATURE_ENTRY_CATEGORIES,
  CREATURE_SAVE_OPTIONS,
} from "./presets";

type Entry = CreatureEntry;
type Usage = CreatureEntryUsage;
type UsageType = Usage["type"];
type Category = Entry["category"];

const USAGE_OPTIONS: Array<[UsageType, string]> = [
  ["passive", "Passive"],
  ["recharge", "Recharge"],
  ["limited", "Limited Use"],
];

const CATEGORY_LABEL = new Map<string, string>(CREATURE_ENTRY_CATEGORIES);

type AbilityOption = (typeof CREATURE_ABILITY_SELECTIONS)[number];

function normalizeLegacyUsage(entry: Entry): void {
  if (entry.usage) return;
  const legacy = entry.recharge?.trim();
  if (!legacy) return;
  const match = legacy.match(/recharge\s*(\d+)(?:\s*[-–—]\s*(\d+))?/i);
  if (match) {
    const min = Number.parseInt(match[1] ?? "", 10);
    const max = match[2] ? Number.parseInt(match[2], 10) : min;
    entry.usage = {
      type: "recharge",
      min: Number.isFinite(min) ? min : undefined,
      max: Number.isFinite(max) ? max : undefined,
    };
    return;
  }
  entry.usage = { type: "limited", charges: legacy };
}

function ensureUsage(entry: Entry): Usage {
  normalizeLegacyUsage(entry);
  if (!entry.usage) entry.usage = { type: "passive" };
  return entry.usage;
}

function synchronizeUsage(entry: Entry): void {
  if (!entry.usage) return;
  entry.recharge = formatEntryUsage(entry) || undefined;
}

function usageBadgeText(entry: Entry): string {
  if (!entry.usage) return entry.recharge?.trim() ?? "";
  if (entry.usage.type === "passive") return "Passive";
  return formatEntryUsage(entry) ?? "";
}

function parseRechargeValue(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function populateAbilitySelect(select: HTMLSelectElement, current?: AbilityOption | undefined) {
  for (const value of CREATURE_ABILITY_SELECTIONS) {
    const option = select.createEl("option", { text: value || "(von)" });
    (option as HTMLOptionElement).value = value;
  }
  if (current) select.value = current;
  try {
    enhanceSelectToSearch(select, "Such-dropdown…");
  } catch {}
}

function ensureDamageExtras(entry: Entry): CreatureEntryDamagePart[] {
  if (!Array.isArray(entry.damage_extra)) entry.damage_extra = [];
  return entry.damage_extra;
}

export function mountEntriesSection(parent: HTMLElement, data: StatblockData) {
  if (!Array.isArray(data.entries)) data.entries = [] as Entry[];

  const entries = data.entries as Entry[];
  let focusEntry: Entry | null = null;

  const wrap = parent.createDiv({ cls: "setting-item sm-cc-entries" });
  wrap.createDiv({ cls: "setting-item-info", text: "Einträge (Traits, Aktionen, …)" });
  const ctl = wrap.createDiv({ cls: "setting-item-control" });

  const tabBar = ctl.createDiv({ cls: "sm-cc-entry-tabs-nav" });
  const panelsRoot = ctl.createDiv({ cls: "sm-cc-entry-tabs" });

  const hosts = new Map<Category, { button: HTMLButtonElement; panel: HTMLDivElement }>();
  for (const [value, label] of CREATURE_ENTRY_CATEGORIES) {
    const btn = tabBar.createEl("button", { text: label, cls: "sm-cc-entry-tab" });
    const panel = panelsRoot.createDiv({ cls: "sm-cc-entry-panel" });
    hosts.set(value, { button: btn as HTMLButtonElement, panel });
  }

  let activeTab = (entries[0]?.category ?? CREATURE_ENTRY_CATEGORIES[0][0]) as Category;

  const updateActive = () => {
    for (const [value, { button, panel }] of hosts) {
      const isActive = value === activeTab;
      button.classList.toggle("is-active", isActive);
      panel.toggleClass("is-active", isActive);
      (panel.style as CSSStyleDeclaration).display = isActive ? "" : "none";
    }
  };

  const setActive = (category: Category) => {
    activeTab = category;
    updateActive();
  };

  for (const [value] of CREATURE_ENTRY_CATEGORIES) {
    const host = hosts.get(value as Category);
    if (!host) continue;
    host.button.onclick = () => {
      setActive(value as Category);
    };
  }

  const renderUsageControls = (
    entry: Entry,
    usageBadge: HTMLElement,
    container: HTMLElement,
  ) => {
    container.empty();
    const usageRow = container.createDiv({ cls: "sm-cc-entry-usage-row" });
    usageRow.createEl("label", { text: "Verwendung" });
    const usageSelect = usageRow.createEl("select") as HTMLSelectElement;
    for (const [value, label] of USAGE_OPTIONS) {
      const option = usageSelect.createEl("option", { text: label });
      (option as HTMLOptionElement).value = value;
    }
    try {
      enhanceSelectToSearch(usageSelect, "Such-dropdown…");
    } catch {}

    const rechargeWrap = container.createDiv({ cls: "sm-cc-entry-usage-recharge" });
    const minInput = rechargeWrap.createEl("input", {
      attr: { type: "number", placeholder: "von", "aria-label": "Recharge von" },
    }) as HTMLInputElement;
    const dash = rechargeWrap.createSpan({ text: "–" });
    dash.addClass("sm-cc-entry-usage-dash");
    const maxInput = rechargeWrap.createEl("input", {
      attr: { type: "number", placeholder: "bis", "aria-label": "Recharge bis" },
    }) as HTMLInputElement;

    const limitedWrap = container.createDiv({ cls: "sm-cc-entry-usage-limited" });
    const chargesInput = limitedWrap.createEl("input", {
      attr: { type: "text", placeholder: "Charges / 3/Day", "aria-label": "Charges" },
    }) as HTMLInputElement;
    const costInput = limitedWrap.createEl("input", {
      attr: { type: "text", placeholder: "Kosten", "aria-label": "Kosten" },
    }) as HTMLInputElement;

    const updateBadge = () => {
      synchronizeUsage(entry);
      const label = usageBadgeText(entry);
      usageBadge.setText(label);
      usageBadge.toggleClass("is-hidden", !label);
    };

    const updateFields = () => {
      const usage = ensureUsage(entry);
      usageSelect.value = usage.type;
      rechargeWrap.style.display = usage.type === "recharge" ? "" : "none";
      limitedWrap.style.display = usage.type === "limited" ? "" : "none";
      if (usage.type === "recharge") {
        minInput.value = usage.min != null ? String(usage.min) : "";
        maxInput.value = usage.max != null ? String(usage.max) : "";
      }
      if (usage.type === "limited") {
        chargesInput.value = usage.charges ?? "";
        costInput.value = usage.cost ?? "";
      }
      updateBadge();
    };

    usageSelect.onchange = () => {
      const next = usageSelect.value as UsageType;
      if (next === "passive") entry.usage = { type: "passive" };
      else if (next === "recharge") entry.usage = { type: "recharge", min: 5, max: 6 };
      else entry.usage = { type: "limited" };
      updateFields();
    };

    minInput.oninput = () => {
      const usage = ensureUsage(entry);
      if (usage.type !== "recharge") return;
      usage.min = parseRechargeValue(minInput.value);
      updateBadge();
    };
    maxInput.oninput = () => {
      const usage = ensureUsage(entry);
      if (usage.type !== "recharge") return;
      usage.max = parseRechargeValue(maxInput.value);
      updateBadge();
    };

    chargesInput.oninput = () => {
      const usage = ensureUsage(entry);
      if (usage.type !== "limited") return;
      usage.charges = chargesInput.value.trim() || undefined;
      updateBadge();
    };
    costInput.oninput = () => {
      const usage = ensureUsage(entry);
      if (usage.type !== "limited") return;
      usage.cost = costInput.value.trim() || undefined;
      updateBadge();
    };

    updateFields();
  };

  const renderEntryCard = (panel: HTMLElement, entry: Entry, index: number) => {
    ensureUsage(entry);
    synchronizeUsage(entry);

    const card = panel.createDiv({ cls: "sm-cc-skill-group sm-cc-entry-card" });
    const head = card.createDiv({ cls: "sm-cc-skill sm-cc-entry-head" });

    const catSelect = head.createEl("select") as HTMLSelectElement;
    for (const [value, label] of CREATURE_ENTRY_CATEGORIES) {
      const option = catSelect.createEl("option", { text: label });
      (option as HTMLOptionElement).value = value;
      if (value === entry.category) (option as HTMLOptionElement).selected = true;
    }
    catSelect.onchange = () => {
      entry.category = catSelect.value as Category;
      focusEntry = entry;
      setActive(entry.category);
      render();
    };
    try {
      enhanceSelectToSearch(catSelect, "Such-dropdown…");
    } catch {}

    const usageBadge = head.createSpan({ cls: "sm-cc-entry-usage-badge" });

    head.createEl("label", { text: "Name" });
    const nameInput = head.createEl("input", {
      cls: "sm-cc-entry-name",
      attr: { type: "text", placeholder: "Name (z. B. Multiattack)", "aria-label": "Name" },
    }) as HTMLInputElement;
    nameInput.value = entry.name || "";
    nameInput.oninput = () => {
      entry.name = nameInput.value.trim();
    };
    (nameInput.style as CSSStyleDeclaration).width = "26ch";
    if (focusEntry === entry) {
      setTimeout(() => nameInput.focus(), 0);
      focusEntry = null;
    }

    const del = head.createEl("button", { text: "🗑" });
    del.onclick = () => {
      entries.splice(index, 1);
      render();
    };

    const usageContainer = card.createDiv({ cls: "sm-cc-entry-usage" });
    renderUsageControls(entry, usageBadge, usageContainer);

    const grid = card.createDiv({ cls: "sm-cc-grid sm-cc-entry-grid" });
    grid.createEl("label", { text: "Art" });
    const kind = grid.createEl("input", {
      attr: { type: "text", placeholder: "Melee/Ranged …", "aria-label": "Art" },
    }) as HTMLInputElement;
    kind.value = entry.kind || "";
    kind.oninput = () => {
      entry.kind = kind.value.trim() || undefined;
    };
    (kind.style as CSSStyleDeclaration).width = "24ch";

    grid.createEl("label", { text: "Reichweite" });
    const rng = grid.createEl("input", {
      attr: { type: "text", placeholder: "reach 5 ft. / range 30 ft.", "aria-label": "Reichweite" },
    }) as HTMLInputElement;
    rng.value = entry.range || "";
    rng.oninput = () => {
      entry.range = rng.value.trim() || undefined;
    };
    (rng.style as CSSStyleDeclaration).width = "30ch";

    grid.createEl("label", { text: "Ziel" });
    const tgt = grid.createEl("input", {
      attr: { type: "text", placeholder: "one target", "aria-label": "Ziel" },
    }) as HTMLInputElement;
    tgt.value = entry.target || "";
    tgt.oninput = () => {
      entry.target = tgt.value.trim() || undefined;
    };
    (tgt.style as CSSStyleDeclaration).width = "16ch";

    const autoRow = card.createDiv({ cls: "sm-cc-auto" });
    const hitGroup = autoRow.createDiv({ cls: "sm-auto-group" });
    hitGroup.createSpan({ text: "To hit:" });
    const toHitAbil = hitGroup.createEl("select") as HTMLSelectElement;
    populateAbilitySelect(toHitAbil, entry.to_hit_from?.ability as AbilityOption | undefined);

    const toHitProf = hitGroup.createEl("input", {
      attr: { type: "checkbox", id: `hit-prof-${index}` },
    }) as HTMLInputElement;
    toHitProf.checked = !!entry.to_hit_from?.proficient;
    hitGroup.createEl("label", { text: "Prof", attr: { for: `hit-prof-${index}` } });

    const hit = hitGroup.createEl("input", {
      cls: "sm-auto-tohit",
      attr: { type: "text", placeholder: "+7", "aria-label": "To hit" },
    }) as HTMLInputElement;
    (hit.style as CSSStyleDeclaration).width = "6ch";
    hit.value = entry.to_hit || "";
    hit.addEventListener("input", () => {
      entry.to_hit = hit.value.trim() || undefined;
    });

    const dmgGroup = autoRow.createDiv({ cls: "sm-auto-group" });
    dmgGroup.createSpan({ text: "Damage:" });
    const dmgDice = dmgGroup.createEl("input", {
      attr: { type: "text", placeholder: "1d8", "aria-label": "Würfel" },
    }) as HTMLInputElement;
    (dmgDice.style as CSSStyleDeclaration).width = "10ch";
    dmgDice.value = entry.damage_from?.dice || "";

    const dmgAbil = dmgGroup.createEl("select") as HTMLSelectElement;
    populateAbilitySelect(dmgAbil, entry.damage_from?.ability as AbilityOption | undefined);

    const dmgBonus = dmgGroup.createEl("input", {
      attr: { type: "text", placeholder: "piercing / slashing …", "aria-label": "Art" },
    }) as HTMLInputElement;
    (dmgBonus.style as CSSStyleDeclaration).width = "12ch";
    dmgBonus.value = entry.damage_from?.bonus || "";

    const dmg = dmgGroup.createEl("input", {
      cls: "sm-auto-dmg",
      attr: { type: "text", placeholder: "1d8 +3 piercing", "aria-label": "Schaden" },
    }) as HTMLInputElement;
    (dmg.style as CSSStyleDeclaration).width = "20ch";
    dmg.value = entry.damage || "";
    dmg.addEventListener("input", () => {
      entry.damage = dmg.value.trim() || undefined;
    });

    const extrasHost = card.createDiv({ cls: "sm-cc-entry-damage-extras" });

    const applyAuto = () => {
      const pb = parseIntSafe(data.pb as any) || 0;
      if (entry.to_hit_from) {
        const ability = entry.to_hit_from.ability as AbilityOption | undefined;
        let abilMod = 0;
        if (ability === "best_of_str_dex") {
          abilMod = Math.max(abilityMod(data.str as any), abilityMod(data.dex as any));
        } else if (ability) {
          abilMod = abilityMod((data as any)[ability]) ?? 0;
        }
        const total = abilMod + (entry.to_hit_from.proficient ? pb : 0);
        entry.to_hit = formatSigned(total);
        hit.value = entry.to_hit;
      }
      const autoDamage = resolveEntryAutoDamage(entry, data);
      if (autoDamage) {
        entry.damage = autoDamage;
        dmg.value = autoDamage;
      }
      synchronizeUsage(entry);
      const label = usageBadgeText(entry);
      usageBadge.setText(label);
      usageBadge.toggleClass("is-hidden", !label);
    };

    const updateToHitSource = () => {
      const ability = toHitAbil.value as AbilityOption | "";
      if (ability) {
        entry.to_hit_from = { ability: ability as AbilityOption, proficient: toHitProf.checked };
      } else {
        entry.to_hit_from = undefined;
      }
      applyAuto();
    };
    toHitAbil.onchange = updateToHitSource;
    toHitProf.onchange = updateToHitSource;

    const updateBaseDamage = () => {
      const dice = dmgDice.value.trim();
      const ability = (dmgAbil.value as AbilityOption) || undefined;
      const bonus = dmgBonus.value.trim() || undefined;
      if (!dice && !ability && !bonus) entry.damage_from = undefined;
      else entry.damage_from = { dice, ability, bonus };
      applyAuto();
    };
    dmgDice.oninput = updateBaseDamage;
    dmgAbil.onchange = updateBaseDamage;
    dmgBonus.oninput = updateBaseDamage;

    const renderExtras = () => {
      extrasHost.empty();
      const extras = ensureDamageExtras(entry);
      extras.forEach((part, idx) => {
        const row = extrasHost.createDiv({ cls: "sm-auto-group sm-cc-entry-damage-extra-row" });
        row.createSpan({ text: "+" });
        const extraDice = row.createEl("input", {
          attr: { type: "text", placeholder: "1d6", "aria-label": "Zusatzwürfel" },
        }) as HTMLInputElement;
        (extraDice.style as CSSStyleDeclaration).width = "10ch";
        extraDice.value = part.dice || "";

        const extraAbil = row.createEl("select") as HTMLSelectElement;
        populateAbilitySelect(extraAbil, part.ability as AbilityOption | undefined);

        const extraBonus = row.createEl("input", {
          attr: { type: "text", placeholder: "z. B. poison", "aria-label": "Zusatz" },
        }) as HTMLInputElement;
        (extraBonus.style as CSSStyleDeclaration).width = "14ch";
        extraBonus.value = part.bonus || "";

        const remove = row.createEl("button", { text: "✕", cls: "sm-cc-entry-remove-dmg" });
        remove.onclick = () => {
          extras.splice(idx, 1);
          renderExtras();
          applyAuto();
        };

        const updatePart = () => {
          part.dice = extraDice.value.trim();
          part.ability = (extraAbil.value as AbilityOption) || undefined;
          part.bonus = extraBonus.value.trim() || undefined;
          applyAuto();
        };
        extraDice.oninput = updatePart;
        extraAbil.onchange = updatePart;
        extraBonus.oninput = updatePart;
      });

      const addBtn = extrasHost.createEl("button", {
        text: "+ Zusatzschaden",
        cls: "sm-cc-entry-add-dmg",
      });
      addBtn.onclick = () => {
        ensureDamageExtras(entry).push({ dice: "", ability: undefined, bonus: undefined });
        renderExtras();
      };
    };
    renderExtras();

    const misc = card.createDiv({ cls: "sm-cc-grid sm-cc-entry-grid" });
    misc.createEl("label", { text: "Save" });
    const saveAb = misc.createEl("select") as HTMLSelectElement;
    for (const value of CREATURE_SAVE_OPTIONS) {
      const option = saveAb.createEl("option", { text: value || "(kein)" });
      (option as HTMLOptionElement).value = value;
      if (value === (entry.save_ability || "")) (option as HTMLOptionElement).selected = true;
    }
    saveAb.onchange = () => {
      entry.save_ability = saveAb.value || undefined;
    };

    misc.createEl("label", { text: "DC" });
    const saveDc = misc.createEl("input", {
      attr: { type: "number", placeholder: "DC", "aria-label": "DC" },
    }) as HTMLInputElement;
    (saveDc.style as CSSStyleDeclaration).width = "4ch";
    saveDc.value = entry.save_dc != null ? String(entry.save_dc) : "";
    saveDc.oninput = () => {
      entry.save_dc = saveDc.value ? Number.parseInt(saveDc.value, 10) : undefined;
    };

    misc.createEl("label", { text: "Save-Effekt" });
    const saveFx = misc.createEl("input", {
      attr: { type: "text", placeholder: "half on save …", "aria-label": "Save-Effekt" },
    }) as HTMLInputElement;
    (saveFx.style as CSSStyleDeclaration).width = "18ch";
    saveFx.value = entry.save_effect || "";
    saveFx.oninput = () => {
      entry.save_effect = saveFx.value.trim() || undefined;
    };

    card.createEl("label", { text: "Details" });
    const ta = card.createEl("textarea", {
      cls: "sm-cc-entry-text",
      attr: { placeholder: "Details (Markdown)" },
    }) as HTMLTextAreaElement;
    ta.value = entry.text || "";
    ta.addEventListener("input", () => {
      entry.text = ta.value;
    });

    const badgeLabel = usageBadgeText(entry);
    usageBadge.setText(badgeLabel);
    usageBadge.toggleClass("is-hidden", !badgeLabel);
  };

  const renderCategory = (category: Category, panel: HTMLDivElement) => {
    panel.empty();
    const addBar = panel.createDiv({ cls: "sm-cc-entry-addbar" });
    const label = CATEGORY_LABEL.get(category) ?? "Eintrag";
    const addBtn = addBar.createEl("button", {
      text: `+ ${label}`,
      cls: "sm-cc-entry-add-btn",
    });
    addBtn.onclick = () => {
      const next: Entry = { category, name: "", usage: { type: "passive" } };
      entries.unshift(next);
      focusEntry = next;
      setActive(category);
      render();
    };

    const list = panel.createDiv({ cls: "sm-cc-entry-list" });
    const catEntries = entries
      .map((entry, idx) => [entry, idx] as const)
      .filter(([entry]) => entry.category === category);

    if (!catEntries.length) {
      list.createDiv({ cls: "sm-cc-entry-empty", text: "Noch keine Einträge" });
      return;
    }

    for (const [entry, idx] of catEntries) {
      renderEntryCard(list, entry, idx);
    }
  };

  const render = () => {
    for (const [value, host] of hosts) {
      renderCategory(value, host.panel);
    }
    updateActive();
  };

  render();
}
