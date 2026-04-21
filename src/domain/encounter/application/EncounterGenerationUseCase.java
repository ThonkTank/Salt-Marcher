package src.domain.encounter.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.generation.value.EncounterTuningIntent;
import src.domain.party.PartyApplicationService;

import java.util.List;
import java.util.Objects;

public final class EncounterGenerationUseCase {

    private static final int SEARCH_LIMIT = 240;

    private final PartyApplicationService party;
    private final CreaturesApplicationService creatures;
    private final @Nullable EncounterTableApplicationService encounterTables;

    public EncounterGenerationUseCase(PartyApplicationService party, CreaturesApplicationService creatures) {
        this(party, creatures, null);
    }

    public EncounterGenerationUseCase(
            PartyApplicationService party,
            CreaturesApplicationService creatures,
            @Nullable EncounterTableApplicationService encounterTables
    ) {
        this.party = Objects.requireNonNull(party, "party");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.encounterTables = encounterTables;
    }

    public GenerateResult execute(GenerateRequest request) {
        EncounterGenerationPreparationUseCase preparation = PrepareEncounterGenerationUseCase.prepare(
                party,
                creatures,
                encounterTables,
                request,
                SEARCH_LIMIT);
        if (!preparation.success()) {
            return new GenerateResult(preparation.status(), preparation.budget(), List.of(), preparation.message());
        }
        List<GeneratedEncounterData> generatedEncounters = new AssembleEncounterResultUseCase(creatures)
                .assemble(preparation.drafts(), request.alternativeCount());
        return new GenerateResult(preparation.status(), preparation.budget(), generatedEncounters, preparation.message());
    }

    public record GenerateRequest(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            EncounterDifficultyIntent targetDifficulty,
            int alternativeCount,
            EncounterTuningIntent tuning,
            List<Long> encounterTableIds,
            List<Long> excludedCreatureIds,
            List<LockedCreature> lockedCreatures
    ) {
        public GenerateRequest {
            creatureTypes = creatureTypes == null ? List.of() : List.copyOf(creatureTypes);
            creatureSubtypes = creatureSubtypes == null ? List.of() : List.copyOf(creatureSubtypes);
            biomes = biomes == null ? List.of() : List.copyOf(biomes);
            targetDifficulty = targetDifficulty == null ? EncounterDifficultyIntent.MEDIUM : targetDifficulty;
            alternativeCount = Math.max(1, Math.min(10, alternativeCount <= 0 ? 5 : alternativeCount));
            tuning = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
            encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
            excludedCreatureIds = excludedCreatureIds == null ? List.of() : List.copyOf(excludedCreatureIds);
            lockedCreatures = lockedCreatures == null ? List.of() : List.copyOf(lockedCreatures);
        }
    }

    public record LockedCreature(long creatureId, int quantity) {
        public LockedCreature {
            quantity = Math.max(1, quantity);
        }
    }

    public record BudgetSummary(
            List<Integer> partyLevels,
            int averageLevel,
            int easyXp,
            int mediumXp,
            int hardXp,
            int deadlyXp,
            int dailyBudgetXp,
            int consumedDailyXp,
            int remainingDailyXp
    ) {
        public BudgetSummary {
            partyLevels = partyLevels == null ? List.of() : List.copyOf(partyLevels);
        }
    }

    public record GeneratedEncounterData(
            String title,
            EncounterDifficultyIntent achievedDifficulty,
            int creatureCount,
            int totalBaseXp,
            int adjustedXp,
            double xpMultiplier,
            List<String> highlights,
            List<EncounterCreatureData> creatures
    ) {
        public GeneratedEncounterData {
            highlights = highlights == null ? List.of() : List.copyOf(highlights);
            creatures = creatures == null ? List.of() : List.copyOf(creatures);
        }
    }

    public record EncounterCreatureData(
            long creatureId,
            String name,
            String challengeRating,
            int xp,
            int quantity,
            String role,
            List<String> tags
    ) {
        public EncounterCreatureData {
            quantity = Math.max(1, quantity);
            tags = tags == null ? List.of() : List.copyOf(tags);
        }
    }

    public record GenerateResult(
            GenerateStatus status,
            @Nullable BudgetSummary budget,
            List<GeneratedEncounterData> encounters,
            String message
    ) {

        public GenerateResult {
            encounters = encounters == null ? List.of() : List.copyOf(encounters);
            message = message == null ? "" : message;
        }
    }

    public enum GenerateStatus {
        SUCCESS,
        NO_ACTIVE_PARTY,
        NO_CREATURES,
        INVALID_REQUEST,
        STORAGE_ERROR;

        static GenerateStatus successfulStatus() {
            return SUCCESS;
        }

        boolean isSuccessful() {
            return this == SUCCESS;
        }
    }
}
