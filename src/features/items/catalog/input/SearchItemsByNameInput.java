package features.items.catalog.input;

import java.util.List;

@SuppressWarnings("unused")
public record SearchItemsByNameInput(String query, int limit) {

    public record SearchedItemsByNameInput(boolean success, List<SearchItemsInput.ItemSummaryInput> items) {
    }
}
