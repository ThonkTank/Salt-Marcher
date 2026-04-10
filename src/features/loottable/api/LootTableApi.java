package features.loottable.api;

import features.loottable.LoottableObject;
import features.loottable.input.LoadTablesInput;
import features.loottable.input.LoadWeightedItemsInput;

import java.util.List;

@SuppressWarnings("unused")
public final class LootTableApi {
    private static final LoottableObject LOOT_TABLES = new LoottableObject();

    private LootTableApi() {
        throw new AssertionError("No instances");
    }

    public enum ReadStatus { SUCCESS, STORAGE_ERROR }

    public record WeightedLootItem(
            long itemId,
            String itemName,
            String category,
            String rarity,
            int costCp,
            String costDisplay,
            int weight
    ) {}

    public record LootTableSummary(long tableId, String name) {
        @Override
        public String toString() { return name != null ? name : ""; }
    }

    public record TableSummaryCatalogResult(ReadStatus status, List<LootTableSummary> tables) {}
    public record WeightedItemsResult(ReadStatus status, List<WeightedLootItem> items) {}

    public static TableSummaryCatalogResult loadAllSummaries() {
        LoadTablesInput.LoadedTablesInput result = LOOT_TABLES.loadTables(new LoadTablesInput());
        return new TableSummaryCatalogResult(
                mapStatus(result.success()),
                result.tables().stream()
                        .map(table -> new LootTableSummary(table.tableId(), table.name()))
                        .toList());
    }

    public static WeightedItemsResult loadWeightedItems(long lootTableId) {
        LoadWeightedItemsInput.LoadedWeightedItemsInput result =
                LOOT_TABLES.loadWeightedItems(new LoadWeightedItemsInput(lootTableId));
        return new WeightedItemsResult(
                mapStatus(result.status()),
                result.items().stream()
                        .map(item -> new WeightedLootItem(
                                item.itemId(),
                                item.itemName(),
                                item.category(),
                                item.rarity(),
                                item.costCp(),
                                item.costDisplay(),
                                item.weight()))
                        .toList());
    }

    private static ReadStatus mapStatus(boolean success) {
        return success ? ReadStatus.SUCCESS : ReadStatus.STORAGE_ERROR;
    }

    private static ReadStatus mapStatus(LoadWeightedItemsInput.Status status) {
        return status == LoadWeightedItemsInput.Status.SUCCESS ? ReadStatus.SUCCESS : ReadStatus.STORAGE_ERROR;
    }
}
