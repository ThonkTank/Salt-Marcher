package features.loottable.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadWeightedItemsInput(Long lootTableId) {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record WeightedItemInput(
            long itemId,
            String itemName,
            String category,
            String rarity,
            int costCp,
            String costDisplay,
            int weight
    ) {
    }

    public record LoadedWeightedItemsInput(
            Status status,
            List<WeightedItemInput> items
    ) {
    }
}
