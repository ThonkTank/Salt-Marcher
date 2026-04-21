package src.domain.encounter;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.published.EncounterBudgetResult;
import src.domain.encounter.published.EncounterBudgetSummary;
import src.domain.encounter.published.EncounterCreature;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterGenerationAdvisory;
import src.domain.encounter.published.EncounterGenerationDiagnostics;
import src.domain.encounter.published.EncounterGenerationTuning;
import src.domain.encounter.published.EncounterGenerationResult;
import src.domain.encounter.published.EncounterGenerationSolutionQuality;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterGenerationStopCategory;
import src.domain.encounter.published.EncounterLock;
import src.domain.encounter.published.GeneratedEncounter;
import src.domain.encounter.published.GenerateEncounterCommand;
import src.domain.encounter.published.LoadEncounterBudgetQuery;
import src.domain.encounter.generation.value.EncounterTuningIntent;
import src.domain.party.PartyApplicationService;

/**
 * Public encounter-generator facade that composes party and creature
 * application services.
 */
@SuppressWarnings("PMD.AvoidCatchingGenericException")
public final class EncounterApplicationService {

    private final EncounterGenerationUseCase generator;
    private final LoadEncounterBudgetUseCase loadBudgetUseCase;

    public EncounterApplicationService(PartyApplicationService party, CreaturesApplicationService creatures) {
        this(party, creatures, null);
    }

    public EncounterApplicationService(
            PartyApplicationService party,
            CreaturesApplicationService creatures,
            @Nullable EncounterTableApplicationService encounterTables
    ) {
        PartyApplicationService partyService = Objects.requireNonNull(party, "party");
        this.generator = new EncounterGenerationUseCase(
                partyService,
                Objects.requireNonNull(creatures, "creatures"),
                encounterTables);
        this.loadBudgetUseCase = new LoadEncounterBudgetUseCase(partyService);
    }

    public EncounterBudgetResult loadBudget(LoadEncounterBudgetQuery query) {
        Objects.requireNonNull(query, "query");
        try {
            LoadEncounterBudgetUseCase.Result result = loadBudgetUseCase.execute();
            return new EncounterBudgetResult(
                    mapBudgetStatus(result.status()),
                    toPublishedBudget(result.budget()),
                    result.message());
        } catch (RuntimeException exception) {
            return new EncounterBudgetResult(EncounterGenerationStatus.STORAGE_ERROR, null, "Encounter budget could not be loaded.");
        }
    }

    public EncounterGenerationResult generate(GenerateEncounterCommand request) {
        try {
            EncounterGenerationUseCase.GenerateResult result = generator.execute(toGenerateRequest(request));
            return new EncounterGenerationResult(
                    mapStatus(result.status()),
                    toPublishedBudget(result.budget()),
                    result.encounters().stream().map(EncounterApplicationService::toPublishedEncounter).toList(),
                    result.message(),
                    toPublishedDiagnostics(result.diagnostics()),
                    result.advisories().stream().map(EncounterApplicationService::toPublishedAdvisory).toList());
        } catch (RuntimeException exception) {
            return new EncounterGenerationResult(EncounterGenerationStatus.defaultFailure(), null, List.of(), "Encounter generation failed.");
        }
    }

    private static EncounterGenerationUseCase.GenerateRequest toGenerateRequest(GenerateEncounterCommand request) {
        GenerateEncounterCommand effectiveRequest = request == null
                ? new GenerateEncounterCommand(
                        List.of(),
                        List.of(),
                        List.of(),
                        EncounterDifficultyBand.defaultBand(),
                        5,
                        List.of(),
                        List.of())
                : request;
        return new EncounterGenerationUseCase.GenerateRequest(
                effectiveRequest.creatureTypes(),
                effectiveRequest.creatureSubtypes(),
                effectiveRequest.biomes(),
                toDifficultyIntent(effectiveRequest.targetDifficulty()),
                effectiveRequest.targetDifficulty() != null && effectiveRequest.targetDifficulty().isAuto(),
                effectiveRequest.alternativeCount(),
                toTuningIntent(effectiveRequest.tuning()),
                effectiveRequest.generationSeed(),
                effectiveRequest.encounterTableIds(),
                effectiveRequest.excludedCreatureIds(),
                effectiveRequest.lockedCreatures().stream()
                        .filter(Objects::nonNull)
                        .map(EncounterApplicationService::toLockedCreature)
                        .toList());
    }

    private static EncounterGenerationUseCase.LockedCreature toLockedCreature(EncounterLock lock) {
        return new EncounterGenerationUseCase.LockedCreature(lock.creatureId(), lock.quantity());
    }

    private static EncounterTuningIntent toTuningIntent(EncounterGenerationTuning tuning) {
        EncounterGenerationTuning effective = tuning == null ? EncounterGenerationTuning.defaultTuning() : tuning;
        return new EncounterTuningIntent(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }

    private static EncounterDifficultyIntent toDifficultyIntent(EncounterDifficultyBand band) {
        return switch (band == null ? EncounterDifficultyBand.defaultBand() : band) {
            case AUTO -> EncounterDifficultyIntent.MEDIUM;
            case EASY -> EncounterDifficultyIntent.EASY;
            case MEDIUM -> EncounterDifficultyIntent.MEDIUM;
            case HARD -> EncounterDifficultyIntent.HARD;
            case DEADLY -> EncounterDifficultyIntent.DEADLY;
        };
    }

    private static @Nullable EncounterBudgetSummary toPublishedBudget(
            EncounterGenerationUseCase.@Nullable BudgetSummary budget
    ) {
        if (budget == null) {
            return null;
        }
        return new EncounterBudgetSummary(
                budget.partyLevels(),
                budget.averageLevel(),
                budget.easyXp(),
                budget.mediumXp(),
                budget.hardXp(),
                budget.deadlyXp(),
                budget.dailyBudgetXp(),
                budget.consumedDailyXp(),
                budget.remainingDailyXp());
    }

    private static @Nullable EncounterBudgetSummary toPublishedBudget(
            EncounterDifficultyMath.@Nullable BudgetSummary budget
    ) {
        if (budget == null) {
            return null;
        }
        return new EncounterBudgetSummary(
                budget.activePartyLevels(),
                budget.averagePartyLevel(),
                budget.easyThreshold(),
                budget.mediumThreshold(),
                budget.hardThreshold(),
                budget.deadlyThreshold(),
                budget.dailyBudgetXp(),
                budget.consumedDailyXp(),
                budget.remainingDailyXp());
    }

    private static GeneratedEncounter toPublishedEncounter(EncounterGenerationUseCase.GeneratedEncounterData encounter) {
        return new GeneratedEncounter(
                encounter.title(),
                toPublishedDifficulty(encounter.achievedDifficulty()),
                encounter.creatureCount(),
                encounter.totalBaseXp(),
                encounter.adjustedXp(),
                encounter.xpMultiplier(),
                encounter.highlights(),
                encounter.creatures().stream().map(EncounterApplicationService::toPublishedCreature).toList());
    }

    private static EncounterDifficultyBand toPublishedDifficulty(EncounterDifficultyIntent intent) {
        return switch (intent == null ? EncounterDifficultyIntent.MEDIUM : intent) {
            case EASY -> EncounterDifficultyBand.EASY;
            case MEDIUM -> EncounterDifficultyBand.MEDIUM;
            case HARD -> EncounterDifficultyBand.HARD;
            case DEADLY -> EncounterDifficultyBand.DEADLY;
        };
    }

    private static EncounterCreature toPublishedCreature(EncounterGenerationUseCase.EncounterCreatureData creature) {
        return new EncounterCreature(
                creature.creatureId(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                creature.quantity(),
                creature.role(),
                creature.tags());
    }

    private static @Nullable EncounterGenerationDiagnostics toPublishedDiagnostics(
            EncounterGenerationUseCase.@Nullable GenerationDiagnostics diagnostics
    ) {
        if (diagnostics == null) {
            return null;
        }
        return new EncounterGenerationDiagnostics(
                toPublishedDifficulty(diagnostics.resolvedDifficulty()),
                toPublishedTuning(diagnostics.resolvedTuning()),
                toPublishedQuality(diagnostics.solutionQuality()),
                toPublishedStopCategory(diagnostics.stopCategory()),
                diagnostics.candidatePoolSize(),
                diagnostics.attempts(),
                diagnostics.candidateEvaluations());
    }

    private static EncounterGenerationTuning toPublishedTuning(EncounterTuningIntent tuning) {
        EncounterTuningIntent effective = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        return new EncounterGenerationTuning(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }

    private static EncounterGenerationSolutionQuality toPublishedQuality(
            EncounterGenerationUseCase.GenerationSolutionQuality quality
    ) {
        if (quality == EncounterGenerationUseCase.GenerationSolutionQuality.EXACT) {
            return EncounterGenerationSolutionQuality.EXACT;
        }
        return EncounterGenerationSolutionQuality.FALLBACK;
    }

    private static EncounterGenerationStopCategory toPublishedStopCategory(
            EncounterGenerationUseCase.GenerationStopCategory category
    ) {
        if (category == EncounterGenerationUseCase.GenerationStopCategory.COMPLETED) {
            return EncounterGenerationStopCategory.COMPLETED;
        }
        return EncounterGenerationStopCategory.SEARCH_EXHAUSTED;
    }

    private static EncounterGenerationAdvisory toPublishedAdvisory(
            EncounterGenerationUseCase.GenerationAdvisory advisory
    ) {
        if (advisory == EncounterGenerationUseCase.GenerationAdvisory.AUTO_RESOLVED) {
            return EncounterGenerationAdvisory.AUTO_RESOLVED;
        }
        return EncounterGenerationAdvisory.FALLBACK_USED;
    }

    private static EncounterGenerationStatus mapStatus(EncounterGenerationUseCase.GenerateStatus status) {
        return switch (status) {
            case SUCCESS -> EncounterGenerationStatus.SUCCESS;
            case NO_ACTIVE_PARTY -> EncounterGenerationStatus.NO_ACTIVE_PARTY;
            case NO_CREATURES -> EncounterGenerationStatus.NO_CREATURES;
            case NO_SOLUTION -> EncounterGenerationStatus.NO_SOLUTION;
            case INVALID_REQUEST -> EncounterGenerationStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterGenerationStatus.STORAGE_ERROR;
        };
    }

    private static EncounterGenerationStatus mapBudgetStatus(LoadEncounterBudgetUseCase.Status status) {
        return switch (status) {
            case SUCCESS -> EncounterGenerationStatus.SUCCESS;
            case NO_ACTIVE_PARTY -> EncounterGenerationStatus.NO_ACTIVE_PARTY;
            case STORAGE_ERROR -> EncounterGenerationStatus.STORAGE_ERROR;
        };
    }
}
