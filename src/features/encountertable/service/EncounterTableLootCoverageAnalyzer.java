package features.encountertable.service;

import features.encountertable.model.EncounterTable;
import features.loottable.api.LootTableApi;
import shared.rules.model.LootCoins;
import shared.rules.service.LootCalculator;

import java.util.List;

/**
 * Heuristic warning helper for linked loot tables in the encounter-table editor.
 *
 * <p>The editor does not know the exact future party composition or generated encounter makeup, so it
 * cannot prove runtime coverage. It does, however, estimate the lower positive reward budgets implied by
 * creatures in the encounter table using the same gold-settlement formula as combat. If the linked loot
 * table starts above that lower range, the editor surfaces a warning so the GM can adjust the table
 * deliberately before encounters end up yielding no loot because the linked table has nothing affordable.
 */
public final class EncounterTableLootCoverageAnalyzer {
    private static final List<Integer> REPRESENTATIVE_PARTY_SIZES = List.of(3, 4, 5);

    private EncounterTableLootCoverageAnalyzer() {
        throw new AssertionError("No instances");
    }

    public static String analyzeCoverageWarning(
            EncounterTable table,
            List<LootTableApi.WeightedLootItem> weightedItems) {
        if (table == null || table.entries == null || table.entries.isEmpty()) {
            return null;
        }
        int cheapestItemCp = weightedItems == null ? Integer.MAX_VALUE : weightedItems.stream()
                .filter(item -> item != null && item.costCp() > 0 && item.weight() > 0)
                .mapToInt(LootTableApi.WeightedLootItem::costCp)
                .min()
                .orElse(Integer.MAX_VALUE);
        if (cheapestItemCp == Integer.MAX_VALUE) {
            return "Verknüpfte Loot-Tabelle enthält keine gültigen, positiv bepreisten Einträge. "
                    + "Kämpfe können damit starten, liefern aber voraussichtlich keinen Loot.";
        }

        int lowestRepresentativeBudgetCp = Integer.MAX_VALUE;
        int highestRepresentativeBudgetCp = 0;
        for (EncounterTable.Entry entry : table.entries) {
            if (entry == null || entry.xp() <= 0) {
                continue;
            }
            for (int avgLevel = 1; avgLevel <= 20; avgLevel++) {
                for (Integer partySizeValue : REPRESENTATIVE_PARTY_SIZES) {
                    int partySize = Math.max(1, partySizeValue == null ? 4 : partySizeValue);
                    int perPlayerXp = entry.xp() / partySize;
                    int totalGold = LootCalculator.settleGold(avgLevel, perPlayerXp, partySize).totalGold();
                    int totalCp = Math.max(0, totalGold * LootCoins.CP_PER_GP);
                    if (totalCp <= 0) {
                        continue;
                    }
                    lowestRepresentativeBudgetCp = Math.min(lowestRepresentativeBudgetCp, totalCp);
                    highestRepresentativeBudgetCp = Math.max(highestRepresentativeBudgetCp, totalCp);
                }
            }
        }

        if (lowestRepresentativeBudgetCp == Integer.MAX_VALUE || cheapestItemCp <= lowestRepresentativeBudgetCp) {
            return null;
        }
        return "Warnung: Die günstigsten Beutewerte dieser Encounter-Tabelle liegen repräsentativ bei "
                + formatCp(lowestRepresentativeBudgetCp)
                + " bis "
                + formatCp(highestRepresentativeBudgetCp)
                + ", aber die verknüpfte Loot-Tabelle beginnt erst bei "
                + formatCp(cheapestItemCp)
                + ". Encounters im unteren Wertebereich starten damit zwar, liefern aber oft keinen Loot, bis günstigere Loot-Einträge vorhanden sind.";
    }

    private static String formatCp(int cp) {
        return LootCoins.ofCp(Math.max(0, cp)).formatCompact();
    }
}
