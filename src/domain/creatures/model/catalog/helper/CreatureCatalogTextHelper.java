package src.domain.creatures.model.catalog.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;

public final class CreatureCatalogTextHelper {

    private CreatureCatalogTextHelper() {
    }

    public static List<String> normalizeValues(@Nullable List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        List<String> normalizedValues = new ArrayList<>();
        for (String value : values) {
            String normalizedValue = trimmedOrNull(value);
            if (normalizedValue != null && !normalizedValues.contains(normalizedValue)) {
                normalizedValues.add(normalizedValue);
            }
        }
        return List.copyOf(normalizedValues);
    }

    public static @Nullable String trimmedOrNull(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
