package src.view.encounter.Model;

import java.util.List;

public record EncounterFilterOptionsViewData(
        List<String> types,
        List<String> subtypes,
        List<String> biomes
) {

    public EncounterFilterOptionsViewData {
        types = immutableCopy(types);
        subtypes = immutableCopy(subtypes);
        biomes = immutableCopy(biomes);
    }

    public static EncounterFilterOptionsViewData empty() {
        return new EncounterFilterOptionsViewData(List.of(), List.of(), List.of());
    }

    private static <T> List<T> immutableCopy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
