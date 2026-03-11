package features.loottable.api;

import features.loottable.service.LootTableService;

import java.util.List;

public final class LootTableApi {

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
        LootTableService.TableListResult result = LootTableService.loadAll();
        return new TableSummaryCatalogResult(
                mapStatus(result.status()),
                result.tables().stream()
                        .map(table -> new LootTableSummary(table.tableId, table.name))
                        .toList());
    }

    public static WeightedItemsResult loadWeightedItems(long lootTableId) {
        LootTableService.WeightedItemsResult result = LootTableService.loadWeightedItems(lootTableId);
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

    private static ReadStatus mapStatus(LootTableService.ReadStatus status) {
        return status == LootTableService.ReadStatus.STORAGE_ERROR ? ReadStatus.STORAGE_ERROR : ReadStatus.SUCCESS;
    }
}
