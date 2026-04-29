package src.view.leftbartabs.catalog;

import java.util.List;

public record CatalogPublishedEvent(
        Kind kind,
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        String difficultyKey,
        EncounterTuning tuning,
        List<Long> encounterTableIds,
        long creatureId
) {

    public CatalogPublishedEvent {
        kind = kind == null ? Kind.UPDATE_CREATURE_FILTERS : kind;
        creatureTypes = creatureTypes == null ? List.of() : List.copyOf(creatureTypes);
        creatureSubtypes = creatureSubtypes == null ? List.of() : List.copyOf(creatureSubtypes);
        biomes = biomes == null ? List.of() : List.copyOf(biomes);
        difficultyKey = difficultyKey == null ? "" : difficultyKey;
        tuning = tuning == null ? EncounterTuning.empty() : tuning;
        encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
        creatureId = Math.max(0L, creatureId);
    }

    static CatalogPublishedEvent updateCreatureFilters(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes
    ) {
        return new CatalogPublishedEvent(
                Kind.UPDATE_CREATURE_FILTERS,
                creatureTypes,
                creatureSubtypes,
                biomes,
                "",
                EncounterTuning.empty(),
                List.of(),
                0L);
    }

    static CatalogPublishedEvent updateEncounterDifficulty(String difficultyKey) {
        return new CatalogPublishedEvent(
                Kind.UPDATE_ENCOUNTER_DIFFICULTY,
                List.of(),
                List.of(),
                List.of(),
                difficultyKey,
                EncounterTuning.empty(),
                List.of(),
                0L);
    }

    static CatalogPublishedEvent updateEncounterTuning(int balanceLevel, double amountValue, int diversityLevel) {
        return new CatalogPublishedEvent(
                Kind.UPDATE_ENCOUNTER_TUNING,
                List.of(),
                List.of(),
                List.of(),
                "",
                new EncounterTuning(balanceLevel, amountValue, diversityLevel),
                List.of(),
                0L);
    }

    static CatalogPublishedEvent updateEncounterTables(List<Long> encounterTableIds) {
        return new CatalogPublishedEvent(
                Kind.UPDATE_ENCOUNTER_TABLES,
                List.of(),
                List.of(),
                List.of(),
                "",
                EncounterTuning.empty(),
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
                EncounterTuning.empty(),
                List.of(),
                creatureId);
    }

    enum Kind {
        UPDATE_CREATURE_FILTERS,
        UPDATE_ENCOUNTER_DIFFICULTY,
        UPDATE_ENCOUNTER_TUNING,
        UPDATE_ENCOUNTER_TABLES,
        ADD_CREATURE
    }

    public record EncounterTuning(int balanceLevel, double amountValue, int diversityLevel) {

        static EncounterTuning empty() {
            return new EncounterTuning(-1, -1.0, -1);
        }
    }
}
