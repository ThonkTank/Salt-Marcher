// Ziel: Loot-Generierung mit Budget-Tracking, DefaultLoot und Tag-Matching
// Siehe: docs/services/Loot.md
//
// Verantwortlichkeiten:
// - Budget-State verwalten (accumulated, distributed, balance, debt)
// - DefaultLoot pro Creature wuerfeln (Chance-System)
// - Tag-basiertes Loot fuer Rest-Budget generieren
// - Soft-Cap bei Budget-Schulden anwenden
// - Hoards generieren (Post-MVP)
//
// Aufgerufen von:
// - encounterLoot.ts (Step 4.4 der Encounter-Pipeline)
//
// DISKREPANZEN (als [HACK] oder [TODO] markiert):
// ================================================
//
// --- Budget-Tracking (Loot.md#background-budget-tracking) ---
//
// [TODO: Loot.md#lootbudgetstate] LootBudgetState Interface
//   → { accumulated, distributed, balance, debt }
//
// [TODO: Loot.md#dmg-gold-level-tabelle] GOLD_PER_XP_BY_LEVEL Konstante
//   → Lookup-Tabelle Level 1-20 → Gold/XP Ratio (Loot.md:86-107)
//
// [TODO: Loot.md#budget-berechnung] getGoldPerXP(partyLevel: number): number
//   → Lookup in GOLD_PER_XP_BY_LEVEL, clamp 1-20
//
// [TODO: Loot.md#budget-berechnung] updateBudget(xpGained, partyLevel): void
//   → accumulated += xpGained × goldPerXP, balance neu berechnen
//
// --- Wealth-System (Loot.md#wealth-system) ---
//
// [TODO: Loot.md#wealth-multipliers] WEALTH_MULTIPLIERS Konstante
//   → { destitute: 0.25, poor: 0.5, average: 1.0, wealthy: 1.5, rich: 2.0, hoard: 3.0 }
//
// [TODO: Loot.md#wealth-system] getWealthMultiplier(creature): number
//   → Lookup in creature.lootTags, default 1.0
//
// [TODO: Loot.md#wealth-system] calculateAverageWealthMultiplier(creatures[]): number
//   → Durchschnitt ueber alle Kreaturen
//
// [TODO: Loot.md#loot-wert-berechnung] calculateLootValue(encounter): number
//   → totalXP × LOOT_MULTIPLIER(0.5) × avgWealth
//
// --- DefaultLoot-Verarbeitung (Loot.md#creature-default-loot) ---
//
// [TODO: Loot.md#verarbeitung] processDefaultLoot(creature, budget): { items, totalValue }
//   → Fuer jeden Entry: Chance-Roll (Math.random() < entry.chance)
//   → Soft-Cap: balance < -1000 && item.value > 100 → weglassen
//   → Budget belasten, debt bei negativer Balance erhoehen
//
// --- Tag-basierte Item-Auswahl (Loot.md#generierung) ---
//
// [TODO: Loot.md#item-auswahl] calculateTagScore(itemTags, lootTags): number
//   → Anzahl uebereinstimmender Tags zaehlen
//
// [TODO: Loot.md#item-auswahl] selectWeightedItem(scoredItems, maxValue): Item | null
//   → Gewichtete Zufallsauswahl (hoehere Scores = hoehere Chance)
//   → Nur Items die ins Budget passen (item.value <= maxValue)
//
// [TODO: Loot.md#item-auswahl] generateLoot(encounter, lootTags, availableItems): GeneratedLoot
//   → Items bis targetValue auswaehlen
//   → Gold als Auffueller wenn targetValue nicht erreicht
//
// --- Output-Typen ---
//
// [TODO: Loot.md#generatedloot] GeneratedLoot Interface
//   → { items: SelectedItem[]; totalValue: number }
//
// [TODO: Loot.md#selecteditem] SelectedItem Interface
//   → { item: Item; quantity: number }
//
// [TODO: Loot.md#scoreditem] ScoredItem Interface (intern)
//   → { item: Item; score: number }
