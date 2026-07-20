package features.items.domain.importing;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record ImportedItem(
        String sourceKey,
        String name,
        String category,
        String subcategory,
        boolean magic,
        String rarity,
        boolean attunement,
        @Nullable Integer costCp,
        String costDisplay,
        @Nullable Double weight,
        String damage,
        String armorClass,
        List<String> properties,
        String description,
        String sourceVersion,
        String sourceUrl
) {
    public ImportedItem {
        sourceKey = safe(sourceKey);
        name = safe(name);
        category = safe(category);
        subcategory = safe(subcategory);
        rarity = safe(rarity);
        costDisplay = safe(costDisplay);
        damage = safe(damage);
        armorClass = safe(armorClass);
        properties = properties == null ? List.of() : List.copyOf(properties);
        description = safe(description);
        sourceVersion = safe(sourceVersion);
        sourceUrl = safe(sourceUrl);
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
    }
}
