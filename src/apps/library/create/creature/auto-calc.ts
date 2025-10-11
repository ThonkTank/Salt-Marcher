// src/apps/library/create/creature/auto-calc.ts
// Kapselt Auto-Calculation-Logik für To-Hit und Damage

import type { StatblockData } from "../../core/creature-files";
import { abilityMod, formatSigned, parseIntSafe } from "./stat-utils";

/**
 * Configuration for automatic to-hit calculation
 */
export interface ToHitAutoConfig {
  ability: string; // e.g. "str", "dex", "best_of_str_dex"
  proficient: boolean;
}

/**
 * Configuration for automatic damage calculation
 */
export interface DamageAutoConfig {
  dice: string; // e.g. "1d8"
  ability?: string; // e.g. "str", "dex", "best_of_str_dex"
  bonus?: string; // e.g. "piercing", "fire", "slashing"
}

/**
 * Calculates to-hit modifier from configuration and creature stats
 */
export function calculateToHit(
  config: ToHitAutoConfig,
  creatureData: StatblockData
): string {
  const pb = parseIntSafe(creatureData.pb as any) || 0;
  const abil = config.ability;

  let abilMod = 0;
  if (abil === "best_of_str_dex") {
    const strMod = abilityMod(creatureData.str as any);
    const dexMod = abilityMod(creatureData.dex as any);
    abilMod = Math.max(strMod, dexMod);
  } else {
    abilMod = abilityMod((creatureData as any)[abil]);
  }

  const total = abilMod + (config.proficient ? pb : 0);
  return formatSigned(total);
}

/**
 * Calculates damage string from configuration and creature stats
 */
export function calculateDamage(
  config: DamageAutoConfig,
  creatureData: StatblockData
): string {
  let abilMod = 0;

  if (config.ability) {
    if (config.ability === "best_of_str_dex") {
      const strMod = abilityMod(creatureData.str as any);
      const dexMod = abilityMod(creatureData.dex as any);
      abilMod = Math.max(strMod, dexMod);
    } else {
      abilMod = abilityMod((creatureData as any)[config.ability]);
    }
  }

  const base = config.dice;
  const abilPart = abilMod ? ` ${formatSigned(abilMod)}` : "";
  const bonusPart = config.bonus ? ` ${config.bonus}` : "";

  return `${base}${abilPart}${bonusPart}`.trim();
}

/**
 * Generates a human-readable tooltip explaining the to-hit calculation
 */
export function getToHitTooltip(
  config: ToHitAutoConfig,
  creatureData: StatblockData
): string {
  const pb = parseIntSafe(creatureData.pb as any) || 0;
  const abil = config.ability;

  let abilMod = 0;
  let abilName = "";

  if (abil === "best_of_str_dex") {
    const strMod = abilityMod(creatureData.str as any);
    const dexMod = abilityMod(creatureData.dex as any);
    abilMod = Math.max(strMod, dexMod);
    abilName = strMod >= dexMod ? "STR" : "DEX";
  } else {
    abilMod = abilityMod((creatureData as any)[abil]);
    abilName = abil.toUpperCase();
  }

  const parts: string[] = [];
  parts.push(`${formatSigned(abilMod)} (${abilName})`);

  if (config.proficient) {
    parts.push(`${formatSigned(pb)} (Prof)`);
  }

  const total = abilMod + (config.proficient ? pb : 0);
  return `1d20 ${parts.join(" ")} = ${formatSigned(total)}`;
}

/**
 * Generates a human-readable tooltip explaining the damage calculation
 */
export function getDamageTooltip(
  config: DamageAutoConfig,
  creatureData: StatblockData
): string {
  let abilMod = 0;
  let abilName = "";

  if (config.ability) {
    if (config.ability === "best_of_str_dex") {
      const strMod = abilityMod(creatureData.str as any);
      const dexMod = abilityMod(creatureData.dex as any);
      abilMod = Math.max(strMod, dexMod);
      abilName = strMod >= dexMod ? "STR" : "DEX";
    } else {
      abilMod = abilityMod((creatureData as any)[config.ability]);
      abilName = config.ability.toUpperCase();
    }
  }

  const parts: string[] = [config.dice];

  if (abilMod !== 0) {
    parts.push(`${formatSigned(abilMod)} (${abilName})`);
  }

  if (config.bonus) {
    parts.push(config.bonus);
  }

  return parts.join(" ");
}

/**
 * Auto-calculator for entry fields
 * Manages automatic calculation of to_hit and damage based on creature stats
 */
export class EntryAutoCalculator {
  private entry: any;
  private creatureData: StatblockData;
  private onUpdate?: () => void;

  constructor(entry: any, creatureData: StatblockData, onUpdate?: () => void) {
    this.entry = entry;
    this.creatureData = creatureData;
    this.onUpdate = onUpdate;
  }

  /**
   * Apply all auto-calculations
   */
  apply(): void {
    if (this.entry.to_hit_from) {
      this.entry.to_hit = calculateToHit(this.entry.to_hit_from, this.creatureData);
    }

    if (this.entry.damage_from) {
      this.entry.damage = calculateDamage(this.entry.damage_from, this.creatureData);
    }

    if (this.onUpdate) {
      this.onUpdate();
    }
  }

  /**
   * Set to-hit auto-calculation config
   */
  setToHitAuto(config: ToHitAutoConfig | undefined): void {
    this.entry.to_hit_from = config;
    if (!config) {
      this.entry.to_hit = undefined;
    }
    this.apply();
  }

  /**
   * Set damage auto-calculation config
   */
  setDamageAuto(config: DamageAutoConfig | undefined): void {
    this.entry.damage_from = config;
    if (!config) {
      this.entry.damage = undefined;
    }
    this.apply();
  }

  /**
   * Get current calculated to-hit value
   */
  getToHit(): string | undefined {
    return this.entry.to_hit;
  }

  /**
   * Get current calculated damage value
   */
  getDamage(): string | undefined {
    return this.entry.damage;
  }

  /**
   * Check if to-hit is using auto-calculation
   */
  hasToHitAuto(): boolean {
    return !!this.entry.to_hit_from;
  }

  /**
   * Check if damage is using auto-calculation
   */
  hasDamageAuto(): boolean {
    return !!this.entry.damage_from;
  }

  /**
   * Get tooltip text for to-hit calculation
   */
  getToHitTooltipText(): string | undefined {
    if (!this.entry.to_hit_from) return undefined;
    return getToHitTooltip(this.entry.to_hit_from, this.creatureData);
  }

  /**
   * Get tooltip text for damage calculation
   */
  getDamageTooltipText(): string | undefined {
    if (!this.entry.damage_from) return undefined;
    return getDamageTooltip(this.entry.damage_from, this.creatureData);
  }
}
