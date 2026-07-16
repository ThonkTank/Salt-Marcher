package features.items.domain.importing;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public record ItemImportBatch(List<ImportedItem> items) {

    private static final String SOURCE_VERSION = "2014 SRD";
    private static final String SOURCE_ROOT = "https://www.dnd5eapi.co/api/2014/";

    public ItemImportBatch {
        items = items == null ? List.of() : List.copyOf(items);
        validate(items);
    }

    private static void validate(List<ImportedItem> items) {
        if (items.isEmpty()) {
            throw new IllegalArgumentException("public source returned no items");
        }
        boolean equipmentPresent = false;
        boolean magicItemsPresent = false;
        Set<String> keys = new HashSet<>();
        for (ImportedItem item : items) {
            if (item.sourceKey().isBlank() || item.name().isBlank() || item.category().isBlank()) {
                throw new IllegalArgumentException("public source returned an incomplete item");
            }
            if (!SOURCE_VERSION.equals(item.sourceVersion()) || !item.sourceUrl().startsWith(SOURCE_ROOT)) {
                throw new IllegalArgumentException("public item attribution does not match the pinned source");
            }
            if (!keys.add(item.sourceKey())) {
                throw new IllegalArgumentException("duplicate public item key: " + item.sourceKey());
            }
            equipmentPresent |= item.sourceKey().startsWith("equipment:");
            magicItemsPresent |= item.sourceKey().startsWith("magic-item:");
        }
        if (!equipmentPresent || !magicItemsPresent) {
            throw new IllegalArgumentException("both public item feeds must be complete before replacement");
        }
    }
}
