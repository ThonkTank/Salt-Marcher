package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.plan.value.EncounterPlanCreature;
import src.domain.encounter.plan.value.EncounterPlanSummary;
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
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.GeneratedEncounter;
import src.domain.encounter.published.GenerateEncounterCommand;
import src.domain.encounter.published.ListSavedEncounterPlansQuery;
import src.domain.encounter.published.LoadEncounterBudgetQuery;
import src.domain.encounter.published.LoadEncounterTuningPreviewQuery;
import src.domain.encounter.published.LoadSavedEncounterPlanQuery;
import src.domain.encounter.published.SaveEncounterPlanCommand;
import src.domain.encounter.published.SavedEncounterPlan;
import src.domain.encounter.published.SavedEncounterPlanCreature;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.encounter.generation.value.EncounterTuningIntent;
import src.domain.party.PartyApplicationService;

/**
 * Public encounter-generator facade that composes party and creature
 * application services.
 */
@SuppressWarnings("PMD.AvoidCatchingGenericException")
public final class EncounterApplicationService {

    private final @Nullable EncounterGenerationUseCase generator;
    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;
    private final @Nullable SavedPlanOperations savedPlanOperations;

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
        this.savedPlanOperations = null;
    }

    public EncounterApplicationService(EncounterPlanRepository encounterPlans) {
        EncounterPlanRepository repository = Objects.requireNonNull(encounterPlans, "encounterPlans");
        this.generator = null;
        this.loadBudgetUseCase = null;
        this.savedPlanOperations = new SavedPlanOperations(repository);
    }

    public EncounterBudgetResult loadBudget(LoadEncounterBudgetQuery query) {
        Objects.requireNonNull(query, "query");
        if (loadBudgetUseCase == null) {
            return new EncounterBudgetResult(EncounterGenerationStatus.STORAGE_ERROR, null, "Encounter budget service is not registered.");
        }
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

    public EncounterTuningPreviewResult loadTuningPreview(LoadEncounterTuningPreviewQuery query) {
        Objects.requireNonNull(query, "query");
        if (loadBudgetUseCase == null) {
            return new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    tuningPreviewLabels(null),
                    "Encounter tuning preview service is not registered.");
        }
        try {
            LoadEncounterBudgetUseCase.Result result = loadBudgetUseCase.execute();
            EncounterBudgetSummary budget = toPublishedBudget(result.budget());
            return new EncounterTuningPreviewResult(
                    mapBudgetStatus(result.status()),
                    tuningPreviewLabels(budget),
                    result.message());
        } catch (RuntimeException exception) {
            return new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    tuningPreviewLabels(null),
                    "Encounter tuning preview could not be loaded.");
        }
    }

    public EncounterGenerationResult generate(GenerateEncounterCommand request) {
        if (generator == null) {
            return new EncounterGenerationResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    null,
                    List.of(),
                    "Encounter generator service is not registered.");
        }
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

    public SavedEncounterPlanResult savePlan(SaveEncounterPlanCommand command) {
        SavedPlanOperations operations = savedPlanOperations;
        if (operations == null) {
            return new SavedEncounterPlanResult(
                    SavedEncounterPlanStatus.STORAGE_ERROR,
                    null,
                    "Encounter plan storage is not registered.");
        }
        return operations.save(command);
    }

    public SavedEncounterPlanResult loadPlan(LoadSavedEncounterPlanQuery query) {
        SavedPlanOperations operations = savedPlanOperations;
        if (operations == null) {
            return new SavedEncounterPlanResult(
                    SavedEncounterPlanStatus.STORAGE_ERROR,
                    null,
                    "Encounter plan storage is not registered.");
        }
        return operations.load(query);
    }

    public SavedEncounterPlanListResult listPlans(ListSavedEncounterPlansQuery query) {
        Objects.requireNonNull(query, "query");
        SavedPlanOperations operations = savedPlanOperations;
        if (operations == null) {
            return new SavedEncounterPlanListResult(
                    SavedEncounterPlanStatus.STORAGE_ERROR,
                    List.of(),
                    "Encounter plan storage is not registered.");
        }
        return operations.list();
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

    private static EncounterTuningPreviewLabels tuningPreviewLabels(@Nullable EncounterBudgetSummary budget) {
        int averageLevel = budget == null ? 1 : Math.max(1, Math.min(20, budget.averageLevel()));
        int partySize = budget == null || budget.partyLevels().isEmpty() ? 1 : Math.max(1, budget.partyLevels().size());
        return new EncounterTuningPreviewLabels(
                List.of(
                        previewLabel(1.0, difficultyRangeLabel(EncounterDifficultyBand.EASY, averageLevel, partySize)),
                        previewLabel(2.0, difficultyRangeLabel(EncounterDifficultyBand.MEDIUM, averageLevel, partySize)),
                        previewLabel(3.0, difficultyRangeLabel(EncounterDifficultyBand.HARD, averageLevel, partySize)),
                        previewLabel(4.0, difficultyRangeLabel(EncounterDifficultyBand.DEADLY, averageLevel, partySize))),
                List.of(
                        previewLabel(1.0, "Extreme++"),
                        previewLabel(2.0, "Extreme+"),
                        previewLabel(3.0, "Neutral"),
                        previewLabel(4.0, "Durchschnitt+"),
                        previewLabel(5.0, "Durchschnitt++")),
                List.of(
                        previewLabel(1.0, "Boss++"),
                        previewLabel(2.0, "Boss+"),
                        previewLabel(3.0, "Ausgeglichen"),
                        previewLabel(4.0, "Minions+"),
                        previewLabel(5.0, "Minions++")),
                List.of(
                        previewLabel(1.0, "1 Typ"),
                        previewLabel(2.0, "2 Typen"),
                        previewLabel(3.0, "3 Typen"),
                        previewLabel(4.0, "4 Typen")));
    }

    private static EncounterTuningPreviewLabels.PreviewLabel previewLabel(double value, String label) {
        return new EncounterTuningPreviewLabels.PreviewLabel(value, label);
    }

    private static String difficultyRangeLabel(EncounterDifficultyBand band, int averageLevel, int partySize) {
        DifficultyPreviewRange range = difficultyPreviewRange(band, averageLevel, partySize);
        return range.lowerAdjustedXp() + "-" + range.upperAdjustedXp() + " XP";
    }

    private static DifficultyPreviewRange difficultyPreviewRange(
            EncounterDifficultyBand band,
            int averageLevel,
            int partySize
    ) {
        EncounterDifficultyMath.Thresholds thresholds = thresholdsForAverageParty(averageLevel, partySize);
        int deadly125 = (int) Math.round(thresholds.deadly() * 1.25);
        return switch (band == null ? EncounterDifficultyBand.MEDIUM : band) {
            case EASY -> new DifficultyPreviewRange(
                    thresholds.easy(),
                    Math.max(thresholds.easy(), thresholds.medium() - 1));
            case MEDIUM, AUTO -> new DifficultyPreviewRange(
                    thresholds.medium(),
                    Math.max(thresholds.medium(), thresholds.hard() - 1));
            case HARD -> new DifficultyPreviewRange(
                    thresholds.hard(),
                    Math.max(thresholds.hard(), thresholds.deadly() - 1));
            case DEADLY -> new DifficultyPreviewRange(
                    thresholds.deadly(),
                    Math.max(thresholds.deadly(), deadly125));
        };
    }

    private static EncounterDifficultyMath.Thresholds thresholdsForAverageParty(int averageLevel, int partySize) {
        int level = Math.max(1, Math.min(20, averageLevel));
        int size = Math.max(1, partySize);
        List<Integer> partyLevels = new ArrayList<>(size);
        for (int index = 0; index < size; index++) {
            partyLevels.add(level);
        }
        return EncounterDifficultyMath.thresholdsFor(partyLevels);
    }

    private record DifficultyPreviewRange(int lowerAdjustedXp, int upperAdjustedXp) {
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

    private static final class SavedPlanOperations {

        private final SaveEncounterPlanUseCase saveUseCase;
        private final LoadSavedEncounterPlanUseCase loadUseCase;
        private final ListSavedEncounterPlansUseCase listUseCase;

        private SavedPlanOperations(EncounterPlanRepository repository) {
            this.saveUseCase = new SaveEncounterPlanUseCase(repository);
            this.loadUseCase = new LoadSavedEncounterPlanUseCase(repository);
            this.listUseCase = new ListSavedEncounterPlansUseCase(repository);
        }

        private SavedEncounterPlanResult save(SaveEncounterPlanCommand command) {
            SaveEncounterPlanCommand effective = command == null
                    ? new SaveEncounterPlanCommand(null, "", "", List.of())
                    : command;
            if (effective.creatures().isEmpty()) {
                return new SavedEncounterPlanResult(
                        SavedEncounterPlanStatus.INVALID_REQUEST,
                        null,
                        "Encounter plan needs at least one creature.");
            }
            try {
                EncounterPlan saved = saveUseCase.execute(
                        Math.max(0L, effective.planId() == null ? 0L : effective.planId()),
                        effective.name(),
                        effective.generatedLabel(),
                        effective.creatures().stream()
                                .filter(Objects::nonNull)
                                .map(SavedPlanOperations::toPlanCreature)
                                .toList());
                return new SavedEncounterPlanResult(
                        SavedEncounterPlanStatus.SUCCESS,
                        toPublishedPlan(saved),
                        "Encounter saved.");
            } catch (IllegalArgumentException exception) {
                return new SavedEncounterPlanResult(
                        SavedEncounterPlanStatus.INVALID_REQUEST,
                        null,
                        "Encounter plan is invalid.");
            } catch (RuntimeException exception) {
                return new SavedEncounterPlanResult(
                        SavedEncounterPlanStatus.STORAGE_ERROR,
                        null,
                        "Encounter plan could not be saved.");
            }
        }

        private SavedEncounterPlanResult load(LoadSavedEncounterPlanQuery query) {
            long planId = query == null ? 0L : query.planId();
            try {
                return loadUseCase.execute(planId)
                        .map(plan -> new SavedEncounterPlanResult(
                                SavedEncounterPlanStatus.SUCCESS,
                                toPublishedPlan(plan),
                                "Encounter loaded."))
                        .orElseGet(() -> new SavedEncounterPlanResult(
                                SavedEncounterPlanStatus.NOT_FOUND,
                                null,
                                "Encounter plan not found."));
            } catch (RuntimeException exception) {
                return new SavedEncounterPlanResult(
                        SavedEncounterPlanStatus.STORAGE_ERROR,
                        null,
                        "Encounter plan could not be loaded.");
            }
        }

        private SavedEncounterPlanListResult list() {
            try {
                return new SavedEncounterPlanListResult(
                        SavedEncounterPlanStatus.SUCCESS,
                        listUseCase.execute().stream().map(SavedPlanOperations::toPublishedSummary).toList(),
                        "");
            } catch (RuntimeException exception) {
                return new SavedEncounterPlanListResult(
                        SavedEncounterPlanStatus.STORAGE_ERROR,
                        List.of(),
                        "Encounter plans could not be loaded.");
            }
        }

        private static EncounterPlanCreature toPlanCreature(SavedEncounterPlanCreature creature) {
            return new EncounterPlanCreature(creature.creatureId(), creature.quantity());
        }

        private static SavedEncounterPlan toPublishedPlan(EncounterPlan plan) {
            return new SavedEncounterPlan(
                    plan.id(),
                    plan.name(),
                    plan.generatedLabel(),
                    plan.creatures().stream()
                            .map(creature -> new SavedEncounterPlanCreature(
                                    creature.creatureId(),
                                    creature.quantity()))
                            .toList());
        }

        private static SavedEncounterPlanSummary toPublishedSummary(EncounterPlanSummary summary) {
            return new SavedEncounterPlanSummary(
                    summary.id(),
                    summary.name(),
                    summary.generatedLabel(),
                    summary.creatureCount());
        }
    }
}
