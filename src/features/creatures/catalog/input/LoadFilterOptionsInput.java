package features.creatures.catalog.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadFilterOptionsInput() {

    public record LoadedFilterOptionsInput(
            boolean success,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            List<String> crValues
    ) {
    }
}
