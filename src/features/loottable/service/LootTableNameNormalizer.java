package features.loottable.service;

import java.util.Locale;

public final class LootTableNameNormalizer {
    private LootTableNameNormalizer() {
        throw new AssertionError("No instances");
    }

    public static String normalizeForStorage(String raw) {
        return raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
    }

    public static String normalizeForComparison(String raw) {
        return normalizeForStorage(raw).toLowerCase(Locale.ROOT);
    }
}
