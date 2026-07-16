package features.encounter.api;

import java.util.List;

public record EncounterBuilderInputs(
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        boolean autoDifficulty,
        int difficultyLevel,
        boolean autoBalance,
        int balanceLevel,
        boolean autoAmount,
        double amountValue,
        boolean autoDiversity,
        int diversityLevel,
        List<Long> encounterTableIds,
        List<Long> worldFactionIds,
        long worldLocationId
) {

    private static final int DEFAULT_DIFFICULTY_LEVEL = 2;
    private static final int DEFAULT_BALANCE_LEVEL = 3;
    private static final double DEFAULT_AMOUNT_VALUE = 3.0;
    private static final int DEFAULT_DIVERSITY_LEVEL = 3;

    public EncounterBuilderInputs {
        creatureTypes = creatureTypes == null ? List.of() : List.copyOf(creatureTypes);
        creatureSubtypes = creatureSubtypes == null ? List.of() : List.copyOf(creatureSubtypes);
        biomes = biomes == null ? List.of() : List.copyOf(biomes);
        difficultyLevel = normalizeDifficulty(difficultyLevel);
        balanceLevel = normalizeBalance(balanceLevel);
        amountValue = normalizeAmount(amountValue);
        diversityLevel = normalizeDiversity(diversityLevel);
        encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
        worldFactionIds = worldFactionIds == null ? List.of() : List.copyOf(worldFactionIds);
        worldLocationId = Math.max(0L, worldLocationId);
    }

    public static EncounterBuilderInputs empty() {
        return new EncounterBuilderInputs(
                List.of(),
                List.of(),
                List.of(),
                true,
                DEFAULT_DIFFICULTY_LEVEL,
                true,
                DEFAULT_BALANCE_LEVEL,
                true,
                DEFAULT_AMOUNT_VALUE,
                true,
                DEFAULT_DIVERSITY_LEVEL,
                List.of(),
                List.of(),
                0L);
    }

    private static int normalizeDifficulty(int value) {
        return value < 1 || value > 4 ? DEFAULT_DIFFICULTY_LEVEL : value;
    }

    private static int normalizeBalance(int value) {
        return value < 1 || value > 5 ? DEFAULT_BALANCE_LEVEL : value;
    }

    private static double normalizeAmount(double value) {
        return !Double.isFinite(value) || value < 1.0 || value > 5.0 ? DEFAULT_AMOUNT_VALUE : value;
    }

    private static int normalizeDiversity(int value) {
        return value < 1 || value > 4 ? DEFAULT_DIVERSITY_LEVEL : value;
    }
}
