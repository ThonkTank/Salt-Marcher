package features.items.api;

import java.util.Objects;
import java.util.function.Consumer;

public record ItemBrowserRowAction(
        String label,
        String tooltip,
        Consumer<ItemCatalogService.ItemSummary> handler) {

    public ItemBrowserRowAction {
        Objects.requireNonNull(label, "label");
        Objects.requireNonNull(handler, "handler");
    }
}
