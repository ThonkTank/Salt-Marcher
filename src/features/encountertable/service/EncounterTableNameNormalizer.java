package features.encountertable.service;

import java.util.Locale;

public final class EncounterTableNameNormalizer {
    private EncounterTableNameNormalizer() {
        throw new AssertionError("No instances");
    }

    public static String normalizeForStorage(String name) {
        return name == null ? "" : name.strip();
    }

    public static String normalizeForComparison(String name) {
        return normalizeForStorage(name).toLowerCase(Locale.ROOT);
    }

    public static boolean isBlankForStorage(String name) {
        return normalizeForStorage(name).isBlank();
    }
}
