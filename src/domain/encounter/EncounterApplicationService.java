package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.LoadCreatureDetailQuery;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.ApplyEncounterSessionUseCase;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.application.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.generation.value.EncounterTuningIntent;
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
import src.domain.encounter.published.EncounterGenerationResult;
import src.domain.encounter.published.EncounterGenerationSolutionQuality;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterGenerationStopCategory;
import src.domain.encounter.published.EncounterGenerationTuning;
import src.domain.encounter.published.EncounterLock;
import src.domain.encounter.published.EncounterPlanBudgetSummary;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.ApplyEncounterSessionCommand;
import src.domain.encounter.published.EncounterSessionModel;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.GenerateEncounterCommand;
import src.domain.encounter.published.GeneratedEncounter;
import src.domain.encounter.published.ListSavedEncounterPlansQuery;
import src.domain.encounter.published.LoadEncounterBudgetQuery;
import src.domain.encounter.published.LoadEncounterPlanBudgetQuery;
import src.domain.encounter.published.LoadEncounterSessionQuery;
import src.domain.encounter.published.LoadEncounterTuningPreviewQuery;
import src.domain.encounter.published.LoadSavedEncounterPlanQuery;
import src.domain.encounter.published.SaveEncounterPlanCommand;
import src.domain.encounter.published.SavedEncounterPlan;
import src.domain.encounter.published.SavedEncounterPlanCreature;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.encounter.session.entity.EncounterSession;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.LoadActivePartyQuery;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;

/**
 * Public encounter facade that owns generation, saved-plan persistence, and
 * the transient encounter-builder or combat session state for the view layer.
 */
@SuppressWarnings("PMD.AvoidCatchingGenericException")
public final class EncounterApplicationService {

    private final @Nullable EncounterGenerationUseCase generator;
    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;
    private final @Nullable LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase;
    private final @Nullable SaveEncounterPlanUseCase savePlanUseCase;
    private final @Nullable LoadSavedEncounterPlanUseCase loadSavedPlanUseCase;
    private final @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase;
    private final @Nullable ApplyEncounterSessionUseCase applySessionUseCase;
    private final List<Consumer<EncounterSessionSnapshot>> sessionListeners = new ArrayList<>();
    private final List<Consumer<EncounterTuningPreviewResult>> tuningPreviewListeners = new ArrayList<>();
    private final EncounterSessionModel sessionModel = new EncounterSessionModel(
            this::currentSessionSnapshot,
            this::subscribeSessionListener);
    private final EncounterTuningPreviewModel tuningPreviewModel = new EncounterTuningPreviewModel(
            this::currentTuningPreview,
            this::subscribeTuningPreviewListener);
    private EncounterTuningPreviewResult currentTuningPreview = new EncounterTuningPreviewResult(
            EncounterGenerationStatus.STORAGE_ERROR,
            new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of()),
            "");

    public EncounterApplicationService(PartyApplicationService party, CreaturesApplicationService creatures) {
        this(party, creatures, null, null);
    }

    public EncounterApplicationService(
            PartyApplicationService party,
            CreaturesApplicationService creatures,
            @Nullable EncounterTableApplicationService encounterTables
    ) {
        this(party, creatures, encounterTables, null);
    }

    public EncounterApplicationService(EncounterPlanRepository encounterPlans) {
        this(null, null, null, encounterPlans);
    }

    public EncounterApplicationService(
            @Nullable PartyApplicationService party,
            @Nullable CreaturesApplicationService creatures,
            @Nullable EncounterTableApplicationService encounterTables,
            @Nullable EncounterPlanRepository encounterPlans
    ) {
        if (party != null && creatures != null) {
            this.generator = new EncounterGenerationUseCase(party, creatures, encounterTables);
            this.loadBudgetUseCase = new LoadEncounterBudgetUseCase(party);
            this.applySessionUseCase = new ApplyEncounterSessionUseCase(createSessionRuntimeAccess(party, creatures));
        } else {
            this.generator = null;
            this.loadBudgetUseCase = null;
            this.applySessionUseCase = null;
        }
        if (party != null && creatures != null && encounterPlans != null) {
            this.loadPlanBudgetUseCase = new LoadEncounterPlanBudgetUseCase(encounterPlans, party, creatures);
        } else {
            this.loadPlanBudgetUseCase = null;
        }
        this.savePlanUseCase = encounterPlans == null ? null : new SaveEncounterPlanUseCase(encounterPlans);
        this.loadSavedPlanUseCase = encounterPlans == null ? null : new LoadSavedEncounterPlanUseCase(encounterPlans);
        this.listSavedPlansUseCase = encounterPlans == null ? null : new ListSavedEncounterPlansUseCase(encounterPlans);
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
            currentTuningPreview = new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    tuningPreviewLabels(null),
                    "Encounter tuning preview service is not registered.");
            notifyTuningPreviewListeners(currentTuningPreview);
            return currentTuningPreview;
        }
        try {
            LoadEncounterBudgetUseCase.Result result = loadBudgetUseCase.execute();
            EncounterBudgetSummary budget = toPublishedBudget(result.budget());
            currentTuningPreview = new EncounterTuningPreviewResult(
                    mapBudgetStatus(result.status()),
                    tuningPreviewLabels(budget),
                    result.message());
        } catch (RuntimeException exception) {
            currentTuningPreview = new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    tuningPreviewLabels(null),
                    "Encounter tuning preview could not be loaded.");
        }
        notifyTuningPreviewListeners(currentTuningPreview);
        return currentTuningPreview;
    }

    public EncounterPlanBudgetResult loadPlanBudget(LoadEncounterPlanBudgetQuery query) {
        Objects.requireNonNull(query, "query");
        if (loadPlanBudgetUseCase == null) {
            return new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    "Encounter plan budget service is not registered.");
        }
        try {
            LoadEncounterPlanBudgetUseCase.Result result = loadPlanBudgetUseCase.execute(query.planId());
            return new EncounterPlanBudgetResult(
                    toPublishedPlanBudgetStatus(result.status()),
                    toPublishedPlanBudget(result.summary()),
                    result.message());
        } catch (RuntimeException exception) {
            return new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    "Encounter plan budget could not be loaded.");
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
        SaveEncounterPlanUseCase useCase = savePlanUseCase;
        if (useCase == null) {
            return new SavedEncounterPlanResult(
                    SavedEncounterPlanStatus.STORAGE_ERROR,
                    null,
                    "Encounter plan storage is not registered.");
        }
        SaveEncounterPlanCommand effective = command == null
                ? new SaveEncounterPlanCommand(null, "", "", List.of())
                : command;
        SaveEncounterPlanUseCase.Result result = useCase.execute(
                Math.max(0L, effective.planId() == null ? 0L : effective.planId()),
                effective.name(),
                effective.generatedLabel(),
                effective.creatures().stream()
                        .filter(Objects::nonNull)
                        .map(EncounterApplicationService::toPlanCreature)
                        .toList());
        return new SavedEncounterPlanResult(
                toPublishedSavePlanStatus(result.status()),
                result.plan() == null ? null : toPublishedPlan(result.plan()),
                result.message());
    }

    public SavedEncounterPlanResult loadPlan(LoadSavedEncounterPlanQuery query) {
        LoadSavedEncounterPlanUseCase useCase = loadSavedPlanUseCase;
        if (useCase == null) {
            return new SavedEncounterPlanResult(
                    SavedEncounterPlanStatus.STORAGE_ERROR,
                    null,
                    "Encounter plan storage is not registered.");
        }
        LoadSavedEncounterPlanUseCase.Result result = useCase.execute(query == null ? 0L : query.planId());
        return new SavedEncounterPlanResult(
                toPublishedLoadPlanStatus(result.status()),
                result.plan() == null ? null : toPublishedPlan(result.plan()),
                result.message());
    }

    public SavedEncounterPlanListResult listPlans(ListSavedEncounterPlansQuery query) {
        Objects.requireNonNull(query, "query");
        ListSavedEncounterPlansUseCase useCase = listSavedPlansUseCase;
        if (useCase == null) {
            return new SavedEncounterPlanListResult(
                    SavedEncounterPlanStatus.STORAGE_ERROR,
                    List.of(),
                    "Encounter plan storage is not registered.");
        }
        ListSavedEncounterPlansUseCase.Result result = useCase.execute();
        return new SavedEncounterPlanListResult(
                toPublishedListPlansStatus(result.status()),
                result.plans().stream().map(EncounterApplicationService::toPublishedSummary).toList(),
                result.message());
    }

    public EncounterSessionModel loadSession(LoadEncounterSessionQuery query) {
        Objects.requireNonNull(query, "query");
        return sessionModel;
    }

    public EncounterTuningPreviewModel loadTuningPreviewModel(LoadEncounterTuningPreviewQuery query) {
        Objects.requireNonNull(query, "query");
        return tuningPreviewModel;
    }

    public EncounterSessionSnapshot applySession(ApplyEncounterSessionCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            return EncounterSessionSnapshot.empty("Encounter session is not registered.");
        }
        EncounterSessionSnapshot snapshot = SnapshotTranslation.toPublishedSnapshot(
                useCase.apply(CommandTranslation.toInternalCommand(command)));
        notifySessionListeners(snapshot);
        return snapshot;
    }

    private EncounterSessionSnapshot currentSessionSnapshot() {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            return EncounterSessionSnapshot.empty("Encounter session is not registered.");
        }
        return SnapshotTranslation.toPublishedSnapshot(useCase.snapshot());
    }

    private Runnable subscribeSessionListener(Consumer<EncounterSessionSnapshot> listener) {
        Consumer<EncounterSessionSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        sessionListeners.add(safeListener);
        return () -> sessionListeners.remove(safeListener);
    }

    private EncounterTuningPreviewResult currentTuningPreview() {
        return currentTuningPreview;
    }

    private Runnable subscribeTuningPreviewListener(Consumer<EncounterTuningPreviewResult> listener) {
        Consumer<EncounterTuningPreviewResult> safeListener = Objects.requireNonNull(listener, "listener");
        tuningPreviewListeners.add(safeListener);
        return () -> tuningPreviewListeners.remove(safeListener);
    }

    private void notifySessionListeners(EncounterSessionSnapshot snapshot) {
        List<Consumer<EncounterSessionSnapshot>> listeners = List.copyOf(sessionListeners);
        for (Consumer<EncounterSessionSnapshot> listener : listeners) {
            listener.accept(snapshot);
        }
    }

    private void notifyTuningPreviewListeners(EncounterTuningPreviewResult result) {
        for (Consumer<EncounterTuningPreviewResult> listener : List.copyOf(tuningPreviewListeners)) {
            listener.accept(result);
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

    private static @Nullable EncounterPlanBudgetSummary toPublishedPlanBudget(
            LoadEncounterPlanBudgetUseCase.@Nullable Summary summary
    ) {
        if (summary == null) {
            return null;
        }
        return new EncounterPlanBudgetSummary(
                summary.planId(),
                summary.name(),
                summary.generatedLabel(),
                summary.partyLevels(),
                summary.averageLevel(),
                summary.easyXp(),
                summary.mediumXp(),
                summary.hardXp(),
                summary.deadlyXp(),
                summary.creatureCount(),
                summary.totalBaseXp(),
                summary.adjustedXp(),
                summary.xpMultiplier(),
                summary.difficultyLabel());
    }

    private static EncounterPlanBudgetStatus toPublishedPlanBudgetStatus(
            LoadEncounterPlanBudgetUseCase.Status status
    ) {
        return switch (status == null ? LoadEncounterPlanBudgetUseCase.Status.STORAGE_ERROR : status) {
            case SUCCESS -> EncounterPlanBudgetStatus.SUCCESS;
            case NOT_FOUND -> EncounterPlanBudgetStatus.NOT_FOUND;
            case NO_ACTIVE_PARTY -> EncounterPlanBudgetStatus.NO_ACTIVE_PARTY;
            case INVALID_REQUEST -> EncounterPlanBudgetStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterPlanBudgetStatus.STORAGE_ERROR;
        };
    }

    private static SavedEncounterPlanStatus toPublishedSavePlanStatus(
            SaveEncounterPlanUseCase.Status status
    ) {
        return switch (status == null ? SaveEncounterPlanUseCase.Status.STORAGE_ERROR : status) {
            case SUCCESS -> SavedEncounterPlanStatus.SUCCESS;
            case INVALID_REQUEST -> SavedEncounterPlanStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> SavedEncounterPlanStatus.STORAGE_ERROR;
        };
    }

    private static SavedEncounterPlanStatus toPublishedLoadPlanStatus(
            LoadSavedEncounterPlanUseCase.Status status
    ) {
        return switch (status == null ? LoadSavedEncounterPlanUseCase.Status.STORAGE_ERROR : status) {
            case SUCCESS -> SavedEncounterPlanStatus.SUCCESS;
            case NOT_FOUND -> SavedEncounterPlanStatus.NOT_FOUND;
            case INVALID_REQUEST -> SavedEncounterPlanStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> SavedEncounterPlanStatus.STORAGE_ERROR;
        };
    }

    private static SavedEncounterPlanStatus toPublishedListPlansStatus(
            ListSavedEncounterPlansUseCase.Status status
    ) {
        return switch (status == null ? ListSavedEncounterPlansUseCase.Status.STORAGE_ERROR : status) {
            case SUCCESS -> SavedEncounterPlanStatus.SUCCESS;
            case STORAGE_ERROR -> SavedEncounterPlanStatus.STORAGE_ERROR;
        };
    }

    private static EncounterSession.SavedPlanStatus toSessionSavePlanStatus(
            SaveEncounterPlanUseCase.Status status
    ) {
        return switch (status == null ? SaveEncounterPlanUseCase.Status.STORAGE_ERROR : status) {
            case SUCCESS -> EncounterSession.SavedPlanStatus.SUCCESS;
            case INVALID_REQUEST -> EncounterSession.SavedPlanStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterSession.SavedPlanStatus.STORAGE_ERROR;
        };
    }

    private static EncounterSession.SavedPlanStatus toSessionLoadPlanStatus(
            LoadSavedEncounterPlanUseCase.Status status
    ) {
        return switch (status == null ? LoadSavedEncounterPlanUseCase.Status.STORAGE_ERROR : status) {
            case SUCCESS -> EncounterSession.SavedPlanStatus.SUCCESS;
            case NOT_FOUND -> EncounterSession.SavedPlanStatus.NOT_FOUND;
            case INVALID_REQUEST -> EncounterSession.SavedPlanStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterSession.SavedPlanStatus.STORAGE_ERROR;
        };
    }

    private static EncounterSession.SavedPlanStatus toSessionListPlansStatus(
            ListSavedEncounterPlansUseCase.Status status
    ) {
        return switch (status == null ? ListSavedEncounterPlansUseCase.Status.STORAGE_ERROR : status) {
            case SUCCESS -> EncounterSession.SavedPlanStatus.SUCCESS;
            case STORAGE_ERROR -> EncounterSession.SavedPlanStatus.STORAGE_ERROR;
        };
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

    private static EncounterDifficultyBand toPublishedDifficultyBand(EncounterSession.DifficultyBand band) {
        return switch (band == null ? EncounterSession.DifficultyBand.MEDIUM : band) {
            case AUTO -> EncounterDifficultyBand.AUTO;
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

    private static EncounterSession.GenerationStatus mapSessionStatus(
            EncounterGenerationUseCase.GenerateStatus status
    ) {
        return switch (status == null ? EncounterGenerationUseCase.GenerateStatus.STORAGE_ERROR : status) {
            case SUCCESS -> EncounterSession.GenerationStatus.SUCCESS;
            case NO_ACTIVE_PARTY -> EncounterSession.GenerationStatus.NO_ACTIVE_PARTY;
            case NO_CREATURES -> EncounterSession.GenerationStatus.NO_CREATURES;
            case NO_SOLUTION -> EncounterSession.GenerationStatus.NO_SOLUTION;
            case INVALID_REQUEST -> EncounterSession.GenerationStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterSession.GenerationStatus.STORAGE_ERROR;
        };
    }

    private static EncounterGenerationStatus mapBudgetStatus(LoadEncounterBudgetUseCase.Status status) {
        return switch (status) {
            case SUCCESS -> EncounterGenerationStatus.SUCCESS;
            case NO_ACTIVE_PARTY -> EncounterGenerationStatus.NO_ACTIVE_PARTY;
            case STORAGE_ERROR -> EncounterGenerationStatus.STORAGE_ERROR;
        };
    }

    private record DifficultyPreviewRange(int lowerAdjustedXp, int upperAdjustedXp) {
    }

    private EncounterSession.RuntimeAccess createSessionRuntimeAccess(
            PartyApplicationService party,
            CreaturesApplicationService creatures
    ) {
        return new EncounterSession.RuntimeAccess() {
            @Override
            public List<EncounterSession.PartyMemberData> loadActiveParty() {
                ActivePartyResult result = party.loadActiveParty(new LoadActivePartyQuery());
                if (result.status() != ReadStatus.SUCCESS) {
                    return List.of();
                }
                List<EncounterSession.PartyMemberData> members = new ArrayList<>();
                for (PartyMemberSummary member : result.members()) {
                    if (member != null && member.id() != null) {
                        members.add(new EncounterSession.PartyMemberData(
                                "pc-" + member.id(),
                                member.id(),
                                member.name(),
                                member.level()));
                    }
                }
                return List.copyOf(members);
            }

            @Override
            public Optional<EncounterSession.BudgetData> loadBudget() {
                LoadEncounterBudgetUseCase useCase = loadBudgetUseCase;
                if (useCase == null) {
                    return Optional.empty();
                }
                try {
                    LoadEncounterBudgetUseCase.Result result = useCase.execute();
                    return result.status() == LoadEncounterBudgetUseCase.Status.SUCCESS && result.budget() != null
                            ? Optional.of(toSessionBudget(result.budget()))
                            : Optional.empty();
                } catch (RuntimeException exception) {
                    return Optional.empty();
                }
            }

            @Override
            public EncounterSession.GenerationResultData generate(EncounterSession.GenerateRequestData request) {
                EncounterGenerationUseCase useCase = generator;
                if (useCase == null) {
                    return new EncounterSession.GenerationResultData(
                            EncounterSession.GenerationStatus.STORAGE_ERROR,
                            List.of(),
                            "Encounter generator service is not registered.",
                            Optional.empty(),
                            false);
                }
                try {
                    return toSessionGenerationResult(useCase.execute(toGenerateRequest(request)));
                } catch (RuntimeException exception) {
                    return new EncounterSession.GenerationResultData(
                            EncounterSession.GenerationStatus.STORAGE_ERROR,
                            List.of(),
                            "Encounter generation failed.",
                            Optional.empty(),
                            false);
                }
            }

            @Override
            public EncounterSession.SavePlanOutcome savePlan(EncounterSession.SavedPlanData plan) {
                SaveEncounterPlanUseCase useCase = savePlanUseCase;
                if (useCase == null) {
                    return new EncounterSession.SavePlanOutcome(
                            EncounterSession.SavedPlanStatus.STORAGE_ERROR,
                            Optional.empty(),
                            "Encounter plan storage is not registered.");
                }
                SaveEncounterPlanUseCase.Result result = useCase.execute(
                        Math.max(0L, plan.id()),
                        plan.name(),
                        plan.generatedLabel(),
                        plan.creatures().stream()
                                .map(EncounterApplicationService::toPlanCreature)
                                .toList());
                return new EncounterSession.SavePlanOutcome(
                        toSessionSavePlanStatus(result.status()),
                        result.plan() == null ? Optional.empty() : Optional.of(toSessionSavedPlan(result.plan())),
                        result.message());
            }

            @Override
            public EncounterSession.LoadPlanOutcome loadPlan(long planId) {
                LoadSavedEncounterPlanUseCase useCase = loadSavedPlanUseCase;
                if (useCase == null) {
                    return new EncounterSession.LoadPlanOutcome(
                            EncounterSession.SavedPlanStatus.STORAGE_ERROR,
                            Optional.empty(),
                            "Encounter plan storage is not registered.");
                }
                LoadSavedEncounterPlanUseCase.Result result = useCase.execute(planId);
                return new EncounterSession.LoadPlanOutcome(
                        toSessionLoadPlanStatus(result.status()),
                        result.plan() == null ? Optional.empty() : Optional.of(toSessionSavedPlan(result.plan())),
                        result.message());
            }

            @Override
            public EncounterSession.ListPlansOutcome listPlans() {
                ListSavedEncounterPlansUseCase useCase = listSavedPlansUseCase;
                if (useCase == null) {
                    return new EncounterSession.ListPlansOutcome(
                            EncounterSession.SavedPlanStatus.STORAGE_ERROR,
                            List.of(),
                            "Encounter plan storage is not registered.");
                }
                ListSavedEncounterPlansUseCase.Result result = useCase.execute();
                return new EncounterSession.ListPlansOutcome(
                        toSessionListPlansStatus(result.status()),
                        result.plans().stream().map(EncounterApplicationService::toSessionSavedPlanSummary).toList(),
                        result.message());
            }

            @Override
            public Optional<EncounterSession.CreatureDetailData> loadCreature(long creatureId) {
                CreatureDetailResult result = creatures.loadCreatureDetail(new LoadCreatureDetailQuery(creatureId));
                if (result.status() != CreatureLookupStatus.SUCCESS || result.detail() == null) {
                    return Optional.empty();
                }
                return Optional.of(toSessionCreatureDetail(result.detail()));
            }

            @Override
            public EncounterSession.AwardXpOutcome awardXp(List<Long> partyMemberIds, int xpPerCharacter) {
                MutationResult result = party.awardXp(new AwardPartyXpCommand(partyMemberIds, xpPerCharacter));
                return new EncounterSession.AwardXpOutcome(
                        result != null && result.status() == MutationStatus.SUCCESS);
            }
        };
    }

    private static EncounterGenerationUseCase.GenerateRequest toGenerateRequest(EncounterSession.GenerateRequestData request) {
        EncounterSession.GenerateRequestData effectiveRequest = request == null
                ? new EncounterSession.GenerateRequestData(
                        List.of(),
                        List.of(),
                        List.of(),
                        EncounterSession.DifficultyBand.defaultBand(),
                        5,
                        EncounterSession.TuningData.defaultTuning(),
                        0L,
                        List.of())
                : request;
        return new EncounterGenerationUseCase.GenerateRequest(
                effectiveRequest.creatureTypes(),
                effectiveRequest.creatureSubtypes(),
                effectiveRequest.biomes(),
                toDifficultyIntent(effectiveRequest.targetDifficulty()),
                effectiveRequest.targetDifficulty().isAuto(),
                effectiveRequest.alternativeCount(),
                toTuningIntent(effectiveRequest.tuning()),
                effectiveRequest.generationSeed(),
                effectiveRequest.encounterTableIds(),
                List.of(),
                List.of());
    }

    private static EncounterSession.BudgetData toSessionBudget(EncounterDifficultyMath.BudgetSummary budget) {
        return new EncounterSession.BudgetData(
                budget.activePartyLevels(),
                budget.averagePartyLevel(),
                budget.easyThreshold(),
                budget.mediumThreshold(),
                budget.hardThreshold(),
                budget.deadlyThreshold());
    }

    private static EncounterSession.GenerationResultData toSessionGenerationResult(
            EncounterGenerationUseCase.GenerateResult result
    ) {
        return new EncounterSession.GenerationResultData(
                mapSessionStatus(result.status()),
                result.encounters().stream().map(EncounterApplicationService::toSessionGeneratedEncounter).toList(),
                result.message(),
                toSessionDiagnostics(result.diagnostics()),
                result.advisories().contains(EncounterGenerationUseCase.GenerationAdvisory.FALLBACK_USED));
    }

    private static EncounterSession.GeneratedEncounterData toSessionGeneratedEncounter(
            EncounterGenerationUseCase.GeneratedEncounterData encounter
    ) {
        return new EncounterSession.GeneratedEncounterData(
                encounter.title(),
                toSessionDifficultyBand(encounter.achievedDifficulty()),
                encounter.adjustedXp(),
                encounter.creatures().stream().map(EncounterApplicationService::toSessionGeneratedCreature).toList());
    }

    private static EncounterSession.GeneratedCreatureData toSessionGeneratedCreature(
            EncounterGenerationUseCase.EncounterCreatureData creature
    ) {
        return new EncounterSession.GeneratedCreatureData(
                creature.creatureId(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                creature.quantity(),
                creature.role(),
                creature.tags());
    }

    private static Optional<EncounterSession.GenerationDiagnosticsData> toSessionDiagnostics(
            EncounterGenerationUseCase.@Nullable GenerationDiagnostics diagnostics
    ) {
        if (diagnostics == null) {
            return Optional.empty();
        }
        return Optional.of(new EncounterSession.GenerationDiagnosticsData(
                toSessionDifficultyBand(diagnostics.resolvedDifficulty()),
                toSessionTuningData(diagnostics.resolvedTuning())));
    }

    private static EncounterSession.DifficultyBand toSessionDifficultyBand(EncounterDifficultyIntent intent) {
        return switch (intent == null ? EncounterDifficultyIntent.MEDIUM : intent) {
            case EASY -> EncounterSession.DifficultyBand.EASY;
            case MEDIUM -> EncounterSession.DifficultyBand.MEDIUM;
            case HARD -> EncounterSession.DifficultyBand.HARD;
            case DEADLY -> EncounterSession.DifficultyBand.DEADLY;
        };
    }

    private static EncounterDifficultyIntent toDifficultyIntent(EncounterSession.DifficultyBand band) {
        return switch (band == null ? EncounterSession.DifficultyBand.MEDIUM : band) {
            case AUTO -> EncounterDifficultyIntent.MEDIUM;
            case EASY -> EncounterDifficultyIntent.EASY;
            case MEDIUM -> EncounterDifficultyIntent.MEDIUM;
            case HARD -> EncounterDifficultyIntent.HARD;
            case DEADLY -> EncounterDifficultyIntent.DEADLY;
        };
    }

    private static EncounterSession.DifficultyBand toInternalDifficultyBand(EncounterDifficultyBand band) {
        return switch (band == null ? EncounterDifficultyBand.defaultBand() : band) {
            case AUTO -> EncounterSession.DifficultyBand.AUTO;
            case EASY -> EncounterSession.DifficultyBand.EASY;
            case MEDIUM -> EncounterSession.DifficultyBand.MEDIUM;
            case HARD -> EncounterSession.DifficultyBand.HARD;
            case DEADLY -> EncounterSession.DifficultyBand.DEADLY;
        };
    }

    private static EncounterSession.TuningData toSessionTuningData(EncounterTuningIntent tuning) {
        EncounterTuningIntent effective = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        return new EncounterSession.TuningData(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }

    private static EncounterTuningIntent toTuningIntent(EncounterSession.TuningData tuning) {
        EncounterSession.TuningData effective = tuning == null
                ? EncounterSession.TuningData.defaultTuning()
                : tuning;
        return new EncounterTuningIntent(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }

    private static EncounterSession.TuningData toInternalTuningData(EncounterGenerationTuning tuning) {
        EncounterGenerationTuning effective = tuning == null
                ? EncounterGenerationTuning.autoTuning()
                : tuning;
        return new EncounterSession.TuningData(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }

    private static EncounterGenerationTuning toPublishedTuningData(EncounterSession.TuningData tuning) {
        EncounterSession.TuningData effective = tuning == null
                ? EncounterSession.TuningData.autoTuning()
                : tuning;
        return new EncounterGenerationTuning(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }

    private static EncounterSession.CreatureDetailData toSessionCreatureDetail(CreatureDetail detail) {
        return new EncounterSession.CreatureDetailData(
                detail.id(),
                detail.name(),
                detail.challengeRating(),
                detail.xp(),
                detail.hitPoints(),
                detail.armorClass(),
                detail.initiativeBonus(),
                detail.creatureType());
    }

    private static EncounterPlanCreature toPlanCreature(SavedEncounterPlanCreature creature) {
        return new EncounterPlanCreature(creature.creatureId(), creature.quantity());
    }

    private static EncounterPlanCreature toPlanCreature(EncounterSession.PlanCreatureData creature) {
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

    private static EncounterSession.SavedPlanData toSessionSavedPlan(EncounterPlan plan) {
        return new EncounterSession.SavedPlanData(
                plan.id(),
                plan.name(),
                plan.generatedLabel(),
                plan.creatures().stream()
                        .map(creature -> new EncounterSession.PlanCreatureData(
                                creature.creatureId(),
                                creature.quantity()))
                        .toList());
    }

    private static EncounterSession.SavedPlanSummaryData toSessionSavedPlanSummary(EncounterPlanSummary summary) {
        return new EncounterSession.SavedPlanSummaryData(
                summary.id(),
                summary.name(),
                summary.generatedLabel(),
                summary.creatureCount());
    }

    private static final class CommandTranslation {

        private CommandTranslation() {
        }

        private static ApplyEncounterSessionUseCase.Command toInternalCommand(
                @Nullable ApplyEncounterSessionCommand command
        ) {
            if (command == null) {
                return ApplyEncounterSessionUseCase.Command.refresh();
            }
            return new ApplyEncounterSessionUseCase.Command(
                    ApplyEncounterSessionUseCase.Action.valueOf(command.action().name()),
                    command.generation() == null
                            ? Optional.empty()
                            : Optional.of(toInternalGenerateRequest(command.generation())),
                    toInternalBuilderInputs(command.builderInputs()),
                    command.creatureId(),
                    command.planId(),
                    command.delta(),
                    command.token(),
                    command.initiativeInputs().stream()
                            .map(entry -> new EncounterSession.InitiativeInputData(entry.id(), entry.initiative()))
                            .toList(),
                    command.combatantId(),
                    command.initiative(),
                    command.partyMemberId(),
                    command.amount(),
                    command.healing());
        }

        private static EncounterSession.BuilderInputsData toInternalBuilderInputs(
                EncounterSessionSnapshot.BuilderInputs builderInputs
        ) {
            EncounterSessionSnapshot.BuilderInputs safeInputs = builderInputs == null
                    ? EncounterSessionSnapshot.BuilderInputs.empty()
                    : builderInputs;
            return new EncounterSession.BuilderInputsData(
                    safeInputs.creatureTypes(),
                    safeInputs.creatureSubtypes(),
                    safeInputs.biomes(),
                    toInternalDifficultyBand(safeInputs.targetDifficulty()),
                    toInternalTuningData(safeInputs.tuning()),
                    safeInputs.encounterTableIds());
        }

        private static EncounterSession.GenerateRequestData toInternalGenerateRequest(
                @Nullable GenerateEncounterCommand request
        ) {
            GenerateEncounterCommand safeRequest = request == null
                    ? new GenerateEncounterCommand(
                    List.of(),
                    List.of(),
                    List.of(),
                    EncounterDifficultyBand.defaultBand(),
                    5,
                    List.of(),
                    List.of())
                    : request;
            return new EncounterSession.GenerateRequestData(
                    safeRequest.creatureTypes(),
                    safeRequest.creatureSubtypes(),
                    safeRequest.biomes(),
                    toInternalDifficultyBand(safeRequest.targetDifficulty()),
                    safeRequest.alternativeCount(),
                    toInternalTuningData(safeRequest.tuning()),
                    safeRequest.generationSeed(),
                    safeRequest.encounterTableIds());
        }
    }

    private static final class SnapshotTranslation {

        private SnapshotTranslation() {
        }

        private static EncounterSessionSnapshot toPublishedSnapshot(
                EncounterSession.SnapshotData snapshot
        ) {
            if (snapshot == null) {
                return EncounterSessionSnapshot.empty("");
            }
            return new EncounterSessionSnapshot(
                    toPublishedMode(snapshot.mode()),
                    toPublishedBuilderState(snapshot.builderState()),
                    toPublishedInitiativeState(snapshot.initiativeState()),
                    toPublishedCombatProjection(snapshot.combatState()),
                    toPublishedResultState(snapshot.resultState()),
                    snapshot.status(),
                    snapshot.missingCombatPartyMembers().stream()
                            .map(member -> new EncounterSessionSnapshot.PartyMember(
                                    member.id(),
                                    member.numericId(),
                                    member.name(),
                                    member.level()))
                            .toList());
        }

        private static EncounterSessionSnapshot.Mode toPublishedMode(EncounterSession.Mode mode) {
            return switch (mode == null ? EncounterSession.Mode.BUILDER : mode) {
                case BUILDER -> EncounterSessionSnapshot.Mode.BUILDER;
                case INITIATIVE -> EncounterSessionSnapshot.Mode.INITIATIVE;
                case COMBAT -> EncounterSessionSnapshot.Mode.COMBAT;
                case RESULTS -> EncounterSessionSnapshot.Mode.RESULTS;
            };
        }

        private static EncounterSessionSnapshot.BuilderState toPublishedBuilderState(
                EncounterSession.BuilderStateData builderState
        ) {
            EncounterSession.BuilderStateData safeState = builderState == null
                    ? new EncounterSession.BuilderStateData(
                    List.of(),
                    List.of(),
                    "",
                    new EncounterSession.DifficultySummaryData(0, 0, 0, 0, 0, ""),
                    EncounterSession.BuilderInputsData.empty(),
                    List.of(),
                    false,
                    false,
                    false,
                    false,
                    false,
                    Optional.empty())
                    : builderState;
            return new EncounterSessionSnapshot.BuilderState(
                    safeState.party().stream()
                            .map(member -> new EncounterSessionSnapshot.PartyMember(
                                    member.id(),
                                    member.numericId(),
                                    member.name(),
                                    member.level()))
                            .toList(),
                    safeState.roster().stream()
                            .map(creature -> new EncounterSessionSnapshot.EncounterCreature(
                                    creature.id(),
                                    creature.creatureId(),
                                    creature.name(),
                                    creature.cr(),
                                    creature.xp(),
                                    creature.hp(),
                                    creature.ac(),
                                    creature.initiativeBonus(),
                                    creature.type(),
                                    creature.role(),
                                    creature.count(),
                                    creature.tags()))
                            .toList(),
                    safeState.templateLabel(),
                    new EncounterSessionSnapshot.DifficultySummary(
                            safeState.difficulty().easy(),
                            safeState.difficulty().medium(),
                            safeState.difficulty().hard(),
                            safeState.difficulty().deadly(),
                            safeState.difficulty().adjustedXp(),
                            safeState.difficulty().difficulty()),
                    toPublishedBuilderInputs(safeState.builderInputs()),
                    safeState.savedPlans().stream()
                            .map(summary -> new SavedEncounterPlanSummary(
                                    summary.id(),
                                    summary.name(),
                                    summary.generatedLabel(),
                                    summary.creatureCount()))
                            .toList(),
                    safeState.canStartCombat(),
                    safeState.canPreviousAlternative(),
                    safeState.canNextAlternative(),
                    safeState.canSavePlan(),
                    safeState.canClearGenerationHistory(),
                    safeState.pendingUndo()
                            .map(entry -> new EncounterSessionSnapshot.RemovedRosterEntry(
                                    entry.token(),
                                    entry.index(),
                                    new EncounterSessionSnapshot.EncounterCreature(
                                            entry.creature().id(),
                                            entry.creature().creatureId(),
                                            entry.creature().name(),
                                            entry.creature().cr(),
                                            entry.creature().xp(),
                                            entry.creature().hp(),
                                            entry.creature().ac(),
                                            entry.creature().initiativeBonus(),
                                            entry.creature().type(),
                                            entry.creature().role(),
                                            entry.creature().count(),
                                            entry.creature().tags())))
                            .orElse(null));
        }

        private static EncounterSessionSnapshot.BuilderInputs toPublishedBuilderInputs(
                EncounterSession.BuilderInputsData builderInputs
        ) {
            EncounterSession.BuilderInputsData safeInputs = builderInputs == null
                    ? EncounterSession.BuilderInputsData.empty()
                    : builderInputs;
            return new EncounterSessionSnapshot.BuilderInputs(
                    safeInputs.creatureTypes(),
                    safeInputs.creatureSubtypes(),
                    safeInputs.biomes(),
                    toPublishedDifficultyBand(safeInputs.targetDifficulty()),
                    toPublishedTuningData(safeInputs.tuning()),
                    safeInputs.encounterTableIds());
        }

        private static EncounterSessionSnapshot.InitiativeState toPublishedInitiativeState(
                EncounterSession.InitiativeStateData initiativeState
        ) {
            EncounterSession.InitiativeStateData safeState = initiativeState == null
                    ? EncounterSession.InitiativeStateData.empty()
                    : initiativeState;
            return new EncounterSessionSnapshot.InitiativeState(
                    safeState.entries().stream()
                            .map(entry -> new EncounterSessionSnapshot.InitiativeEntry(
                                    entry.id(),
                                    entry.label(),
                                    entry.kind().publishedLabel(),
                                    entry.initiative()))
                            .toList());
        }

        private static EncounterSessionSnapshot.CombatProjection toPublishedCombatProjection(
                EncounterSession.CombatProjectionData combatState
        ) {
            EncounterSession.CombatProjectionData safeState = combatState == null
                    ? EncounterSession.CombatProjectionData.empty()
                    : combatState;
            return new EncounterSessionSnapshot.CombatProjection(
                    safeState.currentTurnIndex(),
                    safeState.round(),
                    safeState.status(),
                    safeState.cards().stream()
                            .map(card -> new EncounterSessionSnapshot.CombatCardSnapshot(
                                    card.id(),
                                    card.name(),
                                    card.playerCharacter(),
                                    card.active(),
                                    card.alive(),
                                    card.currentHp(),
                                    card.maxHp(),
                                    card.armorClass(),
                                    card.initiative(),
                                    card.count(),
                                    card.detail()))
                            .toList(),
                    safeState.allEnemiesDefeated());
        }

        private static EncounterSessionSnapshot.ResultState toPublishedResultState(
                EncounterSession.ResultStateData resultState
        ) {
            EncounterSession.ResultStateData safeState = resultState == null
                    ? EncounterSession.ResultStateData.empty()
                    : resultState;
            return new EncounterSessionSnapshot.ResultState(
                    safeState.enemies().stream()
                            .map(enemy -> new EncounterSessionSnapshot.ResultEnemySnapshot(
                                    enemy.name(),
                                    enemy.status(),
                                    enemy.hpLoss(),
                                    enemy.xp(),
                                    enemy.defeatedByDefault(),
                                    enemy.loot()))
                            .toList(),
                    safeState.defeatedCount(),
                    safeState.eligibleXp(),
                    safeState.perPlayerXp(),
                    safeState.goldSummary(),
                    safeState.lootDetail(),
                    safeState.awardStatus(),
                    safeState.xpAwarded(),
                    safeState.canAwardXp(),
                    safeState.partySize());
        }
    }
}
