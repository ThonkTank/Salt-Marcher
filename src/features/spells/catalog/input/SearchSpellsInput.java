package features.spells.catalog.input;

import java.util.List;

@SuppressWarnings("unused")
public record SearchSpellsInput(
        CriteriaInput criteria,
        PageInput page
) {

    public record CriteriaInput(
            String nameQuery,
            boolean ritualOnly,
            boolean concentrationOnly,
            List<String> levels,
            List<String> schools,
            List<String> classes,
            List<String> tags,
            List<String> sources
    ) {
    }

    public record PageInput(String sortColumn, String sortDirection, int limit, int offset) {
    }

    public record SpellSummaryInput(
            long spellId,
            String name,
            int level,
            String school,
            String classesText,
            boolean ritual,
            boolean concentration,
            String source
    ) {
    }

    public record SearchedSpellsInput(boolean success, List<SpellSummaryInput> spells, int totalCount) {
    }
}
