package features.encounter.combat.application.ports;

import java.util.List;

public interface EncounterLootProvider {

    enum LootResolutionStatus {
        NONE_LINKED,
        UNIQUE_LINKED,
        AMBIGUOUS_LINKED,
        STORAGE_ERROR
    }

    record WeightedLootItem(
            long itemId,
            String itemName,
            String category,
            String rarity,
            int costCp,
            String costDisplay,
            int weight
    ) {}

    record LootResolution(
            LootResolutionStatus status,
            List<WeightedLootItem> items
    ) {
        public LootResolution {
            items = items == null ? List.of() : List.copyOf(items);
        }
    }

    LootResolution resolveLoot(List<Long> encounterTableIds);
}
