package src.domain.encounter.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
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

    public GenerateResult execute(EncounterGenerationRequest request) {
        EncounterGenerationPreparationUseCase preparation = PrepareEncounterGenerationUseCase.prepare(
                party,
                creatures,
                encounterTables,
                request,
                SEARCH_LIMIT);
        if (!preparation.success()) {
            return new GenerateResult(
                    preparation.status(),
                    preparation.budget(),
                    List.of(),
                    preparation.message(),
                    preparation.diagnostics(),
                    preparation.advisories());
        }
        List<GeneratedEncounterData> generatedEncounters = new AssembleEncounterResultUseCase(creatures)
                .assemble(preparation.drafts(), request.alternativeCount());
        return new GenerateResult(
                preparation.status(),
                preparation.budget(),
                generatedEncounters,
                preparation.message(),
                preparation.diagnostics(),
                preparation.advisories());
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
            String message,
            @Nullable GenerationDiagnostics diagnostics,
            List<GenerationAdvisory> advisories
    ) {

        public GenerateResult {
            encounters = encounters == null ? List.of() : List.copyOf(encounters);
            message = message == null ? "" : message;
            advisories = advisories == null ? List.of() : List.copyOf(advisories);
        }

        public GenerateResult(
                GenerateStatus status,
                @Nullable BudgetSummary budget,
                List<GeneratedEncounterData> encounters,
                String message
        ) {
            this(status, budget, encounters, message, null, List.of());
        }
    }

    public record GenerationDiagnostics(
            EncounterDifficultyIntent resolvedDifficulty,
            EncounterTuningIntent resolvedTuning,
            GenerationSolutionQuality solutionQuality,
            GenerationStopCategory stopCategory,
            int candidatePoolSize,
            int attempts,
            int candidateEvaluations
    ) {

        public GenerationDiagnostics {
            resolvedDifficulty = resolvedDifficulty == null ? EncounterDifficultyIntent.MEDIUM : resolvedDifficulty;
            resolvedTuning = resolvedTuning == null ? EncounterTuningIntent.defaultIntent() : resolvedTuning;
            solutionQuality = solutionQuality == null ? GenerationSolutionQuality.FALLBACK : solutionQuality;
            stopCategory = stopCategory == null ? GenerationStopCategory.SEARCH_EXHAUSTED : stopCategory;
            candidatePoolSize = Math.max(0, candidatePoolSize);
            attempts = Math.max(0, attempts);
            candidateEvaluations = Math.max(0, candidateEvaluations);
        }
    }

    public enum GenerateStatus {
        SUCCESS,
        NO_ACTIVE_PARTY,
        NO_CREATURES,
        NO_SOLUTION,
        INVALID_REQUEST,
        STORAGE_ERROR;

        static GenerateStatus successfulStatus() {
            return SUCCESS;
        }

        boolean isSuccessful() {
            return this == SUCCESS;
        }
    }

    public enum GenerationSolutionQuality {
        EXACT,
        FALLBACK;

        public boolean isFallback() {
            return this == FALLBACK;
        }
    }

    public enum GenerationStopCategory {
        COMPLETED,
        SEARCH_EXHAUSTED
    }

    public enum GenerationAdvisory {
        AUTO_RESOLVED,
        FALLBACK_USED
    }
}
