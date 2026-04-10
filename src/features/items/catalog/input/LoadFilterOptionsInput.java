package features.items.catalog.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadFilterOptionsInput() {

    public record LoadedFilterOptionsInput(
            boolean success,
            List<String> categories,
            List<String> subcategories,
            List<String> rarities,
            List<String> tags,
            List<String> sources
    ) {
    }
}
