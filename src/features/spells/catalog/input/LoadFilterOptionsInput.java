package features.spells.catalog.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadFilterOptionsInput() {

    public record LoadedFilterOptionsInput(
            boolean success,
            List<String> levels,
            List<String> schools,
            List<String> classes,
            List<String> tags,
            List<String> sources
    ) {
    }
}
