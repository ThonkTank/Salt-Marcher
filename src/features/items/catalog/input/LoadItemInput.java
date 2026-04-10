package features.items.catalog.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadItemInput(Long itemId) {

    public record ItemDetailsInput(
            long itemId,
            String name,
            String category,
            String subcategory,
            boolean magic,
            String rarity,
            boolean requiresAttunement,
            String attunementCondition,
            String costDisplay,
            int costCp,
            double weightLb,
            String damage,
            String properties,
            String armorClass,
            String description,
            String source,
            List<String> tags
    ) {
    }

    public record LoadedItemInput(boolean success, ItemDetailsInput item) {
    }
}
