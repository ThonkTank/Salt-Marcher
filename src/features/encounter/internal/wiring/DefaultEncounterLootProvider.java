package features.encounter.internal.wiring;

import features.encounter.combat.application.ports.EncounterLootProvider;
import features.encountertable.api.EncounterTableApi;
import features.loottable.api.LootTableApi;

import java.util.List;

public final class DefaultEncounterLootProvider implements EncounterLootProvider {

    @Override
    public LootResolution resolveLoot(List<Long> encounterTableIds) {
        EncounterTableApi.LinkedLootTableIdsResult linkedLootResult =
                EncounterTableApi.loadDistinctLinkedLootTableIds(encounterTableIds == null ? List.of() : encounterTableIds);
        if (linkedLootResult.status() != EncounterTableApi.ReadStatus.SUCCESS) {
            return new LootResolution(LootResolutionStatus.STORAGE_ERROR, List.of());
        }
        List<Long> lootTableIds = linkedLootResult.lootTableIds();
        if (lootTableIds.isEmpty()) {
            return new LootResolution(LootResolutionStatus.NONE_LINKED, List.of());
        }
        if (lootTableIds.size() > 1) {
            return new LootResolution(LootResolutionStatus.AMBIGUOUS_LINKED, List.of());
        }
        return loadWeightedItems(lootTableIds.get(0));
    }

    private LootResolution loadWeightedItems(Long lootTableId) {
        if (lootTableId == null) {
            return new LootResolution(LootResolutionStatus.STORAGE_ERROR, List.of());
        }
        LootTableApi.WeightedItemsResult weightedItemsResult = LootTableApi.loadWeightedItems(lootTableId);
        if (weightedItemsResult.status() != LootTableApi.ReadStatus.SUCCESS) {
            return new LootResolution(LootResolutionStatus.STORAGE_ERROR, List.of());
        }
        return new LootResolution(
                LootResolutionStatus.UNIQUE_LINKED,
                weightedItemsResult.items().stream()
                        .map(DefaultEncounterLootProvider::toPortWeightedLootItem)
                        .toList());
    }

    private static WeightedLootItem toPortWeightedLootItem(LootTableApi.WeightedLootItem item) {
        return new WeightedLootItem(
                item.itemId(),
                item.itemName(),
                item.category(),
                item.rarity(),
                item.costCp(),
                item.costDisplay(),
                item.weight());
    }
}
