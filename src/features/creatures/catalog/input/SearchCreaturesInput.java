package features.creatures.catalog.input;

import features.creatures.model.Creature;

import java.util.List;

@SuppressWarnings("unused")
public record SearchCreaturesInput(
        CriteriaInput criteria,
        List<Long> excludeIds,
        List<Long> tableIds,
        PageInput page
) {

    public record CriteriaInput(
            String nameQuery,
            String crMin,
            String crMax,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments
    ) {
    }

    public record PageInput(String sortColumn, String sortDirection, int limit, int offset) {
    }

    public record SearchedCreaturesInput(
            boolean success,
            boolean invalidCriteria,
            List<Creature> creatures,
            int totalCount
    ) {
    }
}
