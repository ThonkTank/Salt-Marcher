package src.view.leftbartabs.catalog;

import java.util.List;

public record CatalogPublishedEvent(
        Kind kind,
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        String difficultyKey,
        int balanceLevel,
        double amountValue,
        int diversityLevel,
        List<Long> encounterTableIds,
        long creatureId
) {

    public CatalogPublishedEvent {
        kind = kind == null ? Kind.UPDATE_BUILDER_INPUTS : kind;
        creatureTypes = copyStrings(creatureTypes);
        creatureSubtypes = copyStrings(creatureSubtypes);
        biomes = copyStrings(biomes);
        difficultyKey = difficultyKey == null ? "" : difficultyKey;
        encounterTableIds = copyLongs(encounterTableIds);
        creatureId = Math.max(0L, creatureId);
    }

    static CatalogPublishedEvent updateBuilderInputs(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            String difficultyKey,
            int balanceLevel,
            double amountValue,
            int diversityLevel,
            List<Long> encounterTableIds
    ) {
        return new CatalogPublishedEvent(
                Kind.UPDATE_BUILDER_INPUTS,
                creatureTypes,
                creatureSubtypes,
                biomes,
                difficultyKey,
                balanceLevel,
                amountValue,
                diversityLevel,
                encounterTableIds,
                0L);
    }

    static CatalogPublishedEvent addCreature(long creatureId) {
        return new CatalogPublishedEvent(
                Kind.ADD_CREATURE,
                List.of(),
                List.of(),
                List.of(),
                "",
                0,
                0.0,
                0,
                List.of(),
                creatureId);
    }

    enum Kind {
        UPDATE_BUILDER_INPUTS,
        ADD_CREATURE
    }

    private static List<String> copyStrings(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static List<Long> copyLongs(List<Long> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
