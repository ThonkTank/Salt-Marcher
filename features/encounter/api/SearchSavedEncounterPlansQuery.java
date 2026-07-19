package features.encounter.api;

import java.util.Locale;

public record SearchSavedEncounterPlansQuery(String normalizedQuery) {

    public SearchSavedEncounterPlansQuery {
        normalizedQuery = normalize(normalizedQuery);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
