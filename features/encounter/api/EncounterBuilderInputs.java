package features.encounter.api;

import java.util.List;

public record EncounterBuilderInputs(EncounterPoolFilters poolFilters, EncounterTuningSettings tuning) {

    public EncounterBuilderInputs {
        poolFilters = poolFilters == null ? EncounterPoolFilters.empty() : poolFilters;
        tuning = tuning == null ? EncounterTuningSettings.defaults() : tuning;
    }

    public EncounterBuilderInputs(
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
        this(new EncounterPoolFilters(
                        "", "", "", List.of(), creatureTypes, creatureSubtypes, biomes, List.of(),
                        encounterTableIds, worldFactionIds, worldLocationId),
                new EncounterTuningSettings(
                        autoDifficulty, difficultyLevel,
                        autoBalance, balanceLevel,
                        autoAmount, amountValue,
                        autoDiversity, diversityLevel));
    }

    public static EncounterBuilderInputs empty() {
        return new EncounterBuilderInputs(EncounterPoolFilters.empty(), EncounterTuningSettings.defaults());
    }

    public String nameQuery() {
        return poolFilters.nameQuery();
    }

    public String challengeRatingMin() {
        return poolFilters.challengeRatingMin();
    }

    public String challengeRatingMax() {
        return poolFilters.challengeRatingMax();
    }

    public List<String> sizes() {
        return poolFilters.sizes();
    }

    public List<String> creatureTypes() {
        return poolFilters.creatureTypes();
    }

    public List<String> creatureSubtypes() {
        return poolFilters.creatureSubtypes();
    }

    public List<String> biomes() {
        return poolFilters.biomes();
    }

    public List<String> alignments() {
        return poolFilters.alignments();
    }

    public List<Long> encounterTableIds() {
        return poolFilters.encounterTableIds();
    }

    public List<Long> worldFactionIds() {
        return poolFilters.worldFactionIds();
    }

    public long worldLocationId() {
        return poolFilters.worldLocationId();
    }

    public boolean autoDifficulty() {
        return tuning.autoDifficulty();
    }

    public int difficultyLevel() {
        return tuning.difficultyLevel();
    }

    public boolean autoBalance() {
        return tuning.autoBalance();
    }

    public int balanceLevel() {
        return tuning.balanceLevel();
    }

    public boolean autoAmount() {
        return tuning.autoAmount();
    }

    public double amountValue() {
        return tuning.amountValue();
    }

    public boolean autoDiversity() {
        return tuning.autoDiversity();
    }

    public int diversityLevel() {
        return tuning.diversityLevel();
    }
}
