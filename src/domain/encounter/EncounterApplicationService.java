package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.LoadCreatureDetailQuery;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
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
import src.domain.encounter.published.ApplyEncounterSessionCommand;
import src.domain.encounter.published.EncounterSessionModel;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.GenerateEncounterCommand;
import src.domain.encounter.published.GeneratedEncounter;
import src.domain.encounter.published.ListSavedEncounterPlansQuery;
import src.domain.encounter.published.LoadEncounterBudgetQuery;
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

    private static final int MAX_CREATURES_PER_SLOT = 20;

    private final @Nullable EncounterGenerationUseCase generator;
    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;
    private final @Nullable SavedPlanOperations savedPlanOperations;
    private final @Nullable PartyApplicationService party;
    private final @Nullable CreaturesApplicationService creatures;
    private final @Nullable EncounterSession session;
    private final List<Consumer<EncounterSessionSnapshot>> sessionListeners = new ArrayList<>();
    private final EncounterSessionModel sessionModel = new EncounterSessionModel(
            this::currentSessionSnapshot,
            this::subscribeSessionListener);

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
        this.party = party;
        this.creatures = creatures;
        if (party != null && creatures != null) {
            this.generator = new EncounterGenerationUseCase(party, creatures, encounterTables);
            this.loadBudgetUseCase = new LoadEncounterBudgetUseCase(party);
        } else {
            this.generator = null;
            this.loadBudgetUseCase = null;
        }
        this.savedPlanOperations = encounterPlans == null ? null : new SavedPlanOperations(encounterPlans);
        this.session = party != null && creatures != null ? new EncounterSession() : null;
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

    public EncounterSessionModel loadSession(LoadEncounterSessionQuery query) {
        Objects.requireNonNull(query, "query");
        return sessionModel;
    }

    public EncounterSessionSnapshot applySession(ApplyEncounterSessionCommand command) {
        ApplyEncounterSessionCommand effective = effectiveSessionCommand(command);
        EncounterSession encounterSession = session;
        if (encounterSession == null) {
            return EncounterSessionSnapshot.empty("Encounter session is not registered.");
        }
        EncounterSessionSnapshot snapshot = applySessionAction(encounterSession, effective);
        notifySessionListeners(snapshot);
        return snapshot;
    }

    private static ApplyEncounterSessionCommand effectiveSessionCommand(
            ApplyEncounterSessionCommand command
    ) {
        return command == null
                ? new ApplyEncounterSessionCommand(
                        ApplyEncounterSessionCommand.Action.REFRESH,
                        null,
                        EncounterSessionSnapshot.BuilderInputs.empty(),
                        0L,
                        0L,
                        0,
                        0L,
                        List.of(),
                        "",
                        0,
                        0L,
                        0,
                        false)
                : command;
    }

    private static EncounterSessionSnapshot applySessionAction(
            EncounterSession encounterSession,
            ApplyEncounterSessionCommand effective
    ) {
        return switch (effective.action()) {
            case REFRESH,
                    UPDATE_BUILDER_INPUTS,
                    GENERATE,
                    SAVE_CURRENT_PLAN,
                    OPEN_SAVED_PLAN,
                    CLEAR_GENERATION_HISTORY,
                    SHIFT_ALTERNATIVE,
                    ADD_CREATURE,
                    INCREMENT_CREATURE,
                    DECREMENT_CREATURE,
                    REMOVE_CREATURE,
                    UNDO_REMOVE -> applyBuilderSessionAction(encounterSession, effective);
            case OPEN_INITIATIVE,
                    BACK_TO_BUILDER,
                    CONFIRM_INITIATIVE,
                    ADVANCE_TURN,
                    SET_INITIATIVE,
                    ADD_PARTY_MEMBER_TO_COMBAT,
                    END_COMBAT,
                    AWARD_XP,
                    RETURN_TO_BUILDER_AFTER_RESULTS,
                    MUTATE_HP -> applyRuntimeSessionAction(encounterSession, effective);
        };
    }

    private static EncounterSessionSnapshot applyBuilderSessionAction(
            EncounterSession encounterSession,
            ApplyEncounterSessionCommand effective
    ) {
        return switch (effective.action()) {
            case REFRESH -> encounterSession.refreshPartyContext();
            case UPDATE_BUILDER_INPUTS -> encounterSession.updateBuilderInputs(effective.builderInputs());
            case GENERATE -> encounterSession.generate(
                    effective.generation() == null
                            ? encounterSession.generationCommand()
                            : effective.generation());
            case SAVE_CURRENT_PLAN -> encounterSession.saveCurrentPlan();
            case OPEN_SAVED_PLAN -> encounterSession.openSavedPlan(effective.planId());
            case CLEAR_GENERATION_HISTORY -> encounterSession.clearGenerationHistory();
            case SHIFT_ALTERNATIVE -> encounterSession.shiftGeneratedAlternative(effective.delta());
            case ADD_CREATURE -> encounterSession.addCreature(effective.creatureId());
            case INCREMENT_CREATURE -> encounterSession.incrementCreature(effective.creatureId());
            case DECREMENT_CREATURE -> encounterSession.decrementCreature(effective.creatureId());
            case REMOVE_CREATURE -> encounterSession.removeCreature(effective.creatureId());
            case UNDO_REMOVE -> encounterSession.undoRemove(effective.token());
            default -> throw new IllegalStateException("Unsupported builder session action: " + effective.action());
        };
    }

    private static EncounterSessionSnapshot applyRuntimeSessionAction(
            EncounterSession encounterSession,
            ApplyEncounterSessionCommand effective
    ) {
        return switch (effective.action()) {
            case OPEN_INITIATIVE -> encounterSession.openInitiative();
            case BACK_TO_BUILDER -> encounterSession.backToBuilder();
            case CONFIRM_INITIATIVE -> encounterSession.confirmInitiative(effective.initiativeInputs());
            case ADVANCE_TURN -> encounterSession.nextTurn();
            case SET_INITIATIVE -> encounterSession.setInitiative(effective.combatantId(), effective.initiative());
            case ADD_PARTY_MEMBER_TO_COMBAT ->
                    encounterSession.addPartyMemberToCombat(effective.partyMemberId(), effective.initiative());
            case END_COMBAT -> encounterSession.endCombat();
            case AWARD_XP -> encounterSession.awardXp();
            case RETURN_TO_BUILDER_AFTER_RESULTS -> encounterSession.returnToBuilderAfterResults();
            case MUTATE_HP -> encounterSession.mutateHp(
                    effective.combatantId(),
                    effective.amount(),
                    effective.healing());
            default -> throw new IllegalStateException("Unsupported runtime session action: " + effective.action());
        };
    }

    private EncounterSessionSnapshot currentSessionSnapshot() {
        EncounterSession encounterSession = session;
        if (encounterSession == null) {
            return EncounterSessionSnapshot.empty("Encounter session is not registered.");
        }
        return encounterSession.snapshot();
    }

    private Runnable subscribeSessionListener(Consumer<EncounterSessionSnapshot> listener) {
        Consumer<EncounterSessionSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        sessionListeners.add(safeListener);
        return () -> sessionListeners.remove(safeListener);
    }

    private void notifySessionListeners(EncounterSessionSnapshot snapshot) {
        List<Consumer<EncounterSessionSnapshot>> listeners = List.copyOf(sessionListeners);
        for (Consumer<EncounterSessionSnapshot> listener : listeners) {
            listener.accept(snapshot);
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

    private static EncounterGenerationStatus mapBudgetStatus(LoadEncounterBudgetUseCase.Status status) {
        return switch (status) {
            case SUCCESS -> EncounterGenerationStatus.SUCCESS;
            case NO_ACTIVE_PARTY -> EncounterGenerationStatus.NO_ACTIVE_PARTY;
            case STORAGE_ERROR -> EncounterGenerationStatus.STORAGE_ERROR;
        };
    }

    private record DifficultyPreviewRange(int lowerAdjustedXp, int upperAdjustedXp) {
    }

    private final class EncounterSession {

        private final List<EncounterSessionSnapshot.PartyMember> activeParty = new ArrayList<>();
        private final List<EncounterSessionSnapshot.EncounterCreature> roster = new ArrayList<>();
        private final List<GeneratedEncounter> generatedAlternatives = new ArrayList<>();
        private final List<SavedEncounterPlanSummary> savedPlans = new ArrayList<>();
        private final List<EncounterSessionSnapshot.InitiativeEntry> pendingInitiativeRows = new ArrayList<>();
        private final CombatRuntime combatRuntime = new CombatRuntime();

        private EncounterSessionSnapshot.Mode mode = EncounterSessionSnapshot.Mode.BUILDER;
        private EncounterSessionSnapshot.InitiativeState initiativeState = EncounterSessionSnapshot.InitiativeState.empty();
        private EncounterSessionSnapshot.CombatProjection combatState = EncounterSessionSnapshot.CombatProjection.empty();
        private EncounterSessionSnapshot.ResultState resultState = EncounterSessionSnapshot.ResultState.empty();
        private EncounterSessionSnapshot.BuilderInputs builderInputs = EncounterSessionSnapshot.BuilderInputs.empty();
        private @Nullable EncounterBudgetSummary budget;
        private int selectedAlternativeIndex;
        private int generatedAdjustedXp;
        private String generatedDifficulty = "";
        private String generatedTitle = "";
        private EncounterSessionSnapshot.@Nullable RemovedRosterEntry pendingUndo;
        private boolean generationHistoryPresent;
        private long activeSavedPlanId;
        private long nextUndoToken;
        private int currentTurnIndex;
        private int round = 1;
        private String status = "Encounter bereit.";

        private EncounterSession() {
            refreshSavedPlans();
            refreshPartyContext();
        }

        private EncounterSessionSnapshot snapshot() {
            return new EncounterSessionSnapshot(
                    mode,
                    builderState(),
                    initiativeState,
                    combatState,
                    resultState,
                    status,
                    missingCombatPartyMembers());
        }

        private EncounterSessionSnapshot refreshPartyContext() {
            loadActiveParty();
            loadBudgetIntoSession();
            refreshSavedPlans();
            return snapshot();
        }

        private EncounterSessionSnapshot updateBuilderInputs(
                EncounterSessionSnapshot.BuilderInputs nextInputs
        ) {
            builderInputs = normalizeBuilderInputs(nextInputs);
            return snapshot();
        }

        private EncounterSessionSnapshot generate(GenerateEncounterCommand request) {
            pendingUndo = null;
            activeSavedPlanId = 0L;
            loadActiveParty();
            loadBudgetIntoSession();
            if (activeParty.isEmpty()) {
                status = "Die aktive Party hat keine Mitglieder.";
                return snapshot();
            }
            EncounterGenerationResult result = EncounterApplicationService.this.generate(request);
            if (result.status() != EncounterGenerationStatus.SUCCESS || result.encounters().isEmpty()) {
                generatedAlternatives.clear();
                selectedAlternativeIndex = 0;
                generationHistoryPresent = false;
                status = result.message().isBlank() ? generationStatusText(result.status()) : result.message();
                return snapshot();
            }
            generatedAlternatives.clear();
            generatedAlternatives.addAll(result.encounters());
            generationHistoryPresent = true;
            selectedAlternativeIndex = 0;
            applyGeneratedEncounter(generatedAlternatives.getFirst());
            status = generationSuccessText(result);
            return snapshot();
        }

        private GenerateEncounterCommand generationCommand() {
            EncounterSessionSnapshot.BuilderInputs currentInputs = builderInputs;
            return new GenerateEncounterCommand(
                    currentInputs.creatureTypes(),
                    currentInputs.creatureSubtypes(),
                    currentInputs.biomes(),
                    currentInputs.targetDifficulty(),
                    5,
                    currentInputs.tuning(),
                    nextGenerationSeed(),
                    currentInputs.encounterTableIds(),
                    List.of(),
                    List.of());
        }

        private EncounterSessionSnapshot saveCurrentPlan() {
            if (roster.isEmpty()) {
                status = "Speichern braucht mindestens eine Kreatur im Encounter.";
                return snapshot();
            }
            SavedEncounterPlanResult result = EncounterApplicationService.this.savePlan(new SaveEncounterPlanCommand(
                    activeSavedPlanId <= 0L ? null : activeSavedPlanId,
                    saveName(),
                    generatedTitle,
                    roster.stream()
                            .map(creature -> new SavedEncounterPlanCreature(creature.creatureId(), creature.count()))
                            .toList()));
            if (result.status() != SavedEncounterPlanStatus.SUCCESS || result.plan() == null) {
                status = result.message().isBlank() ? "Encounter konnte nicht gespeichert werden." : result.message();
                refreshSavedPlans();
                return snapshot();
            }
            activeSavedPlanId = result.plan().id();
            status = result.plan().name() + " gespeichert.";
            refreshSavedPlans();
            return snapshot();
        }

        private EncounterSessionSnapshot openSavedPlan(long planId) {
            SavedEncounterPlanResult result =
                    EncounterApplicationService.this.loadPlan(new LoadSavedEncounterPlanQuery(planId));
            SavedEncounterPlan plan = result.plan();
            if (result.status() != SavedEncounterPlanStatus.SUCCESS || plan == null) {
                status = result.message().isBlank() ? "Encounter konnte nicht geoeffnet werden." : result.message();
                refreshSavedPlans();
                return snapshot();
            }
            roster.clear();
            for (SavedEncounterPlanCreature creature : plan.creatures()) {
                CreatureDetail detail = loadCreature(creature.creatureId());
                if (detail != null) {
                    roster.add(fromDetail(detail, creature.quantity(), "Saved", List.of()));
                }
            }
            generatedAlternatives.clear();
            generationHistoryPresent = false;
            pendingInitiativeRows.clear();
            combatRuntime.clear();
            resultState = EncounterSessionSnapshot.ResultState.empty();
            combatState = EncounterSessionSnapshot.CombatProjection.empty();
            initiativeState = EncounterSessionSnapshot.InitiativeState.empty();
            selectedAlternativeIndex = 0;
            generatedAdjustedXp = 0;
            generatedDifficulty = "";
            generatedTitle = plan.generatedLabel().isBlank() ? plan.name() : plan.generatedLabel();
            pendingUndo = null;
            activeSavedPlanId = plan.id();
            round = 1;
            currentTurnIndex = 0;
            mode = EncounterSessionSnapshot.Mode.BUILDER;
            status = plan.name() + " geoeffnet.";
            refreshSavedPlans();
            return snapshot();
        }

        private EncounterSessionSnapshot clearGenerationHistory() {
            if (!generationHistoryPresent && generatedAlternatives.isEmpty()) {
                return snapshot();
            }
            generatedAlternatives.clear();
            selectedAlternativeIndex = 0;
            generatedAdjustedXp = 0;
            generatedDifficulty = "";
            generatedTitle = "";
            generationHistoryPresent = false;
            status = "Generator-Historie geleert.";
            return snapshot();
        }

        private EncounterSessionSnapshot shiftGeneratedAlternative(int delta) {
            if (generatedAlternatives.isEmpty()) {
                return snapshot();
            }
            selectedAlternativeIndex = Math.floorMod(selectedAlternativeIndex + delta, generatedAlternatives.size());
            applyGeneratedEncounter(generatedAlternatives.get(selectedAlternativeIndex));
            return snapshot();
        }

        private EncounterSessionSnapshot addCreature(long creatureId) {
            CreatureDetail detail = loadCreature(creatureId);
            if (detail == null) {
                status = "Kreatur konnte nicht geladen werden.";
                return snapshot();
            }
            if (mode == EncounterSessionSnapshot.Mode.COMBAT) {
                String activeTurnId = combatRuntime.activeTurnId(currentTurnIndex);
                int initiative = 12 + Math.max(-3, Math.min(6, detail.initiativeBonus()));
                String displayName = combatRuntime.addMonsterReinforcement(
                        detail.name(),
                        detail.id(),
                        Math.max(1, detail.hitPoints()),
                        detail.armorClass(),
                        detail.xp(),
                        detail.challengeRating(),
                        detail.creatureType(),
                        "Reinforcement",
                        initiative);
                currentTurnIndex = combatRuntime.turnIndexOf(activeTurnId, currentTurnIndex);
                refreshCombatState();
                status = displayName + " betritt den laufenden Kampf.";
                return snapshot();
            }
            clearGeneratedSelection();
            for (int index = 0; index < roster.size(); index++) {
                EncounterSessionSnapshot.EncounterCreature existing = roster.get(index);
                if (existing.creatureId() == detail.id()) {
                    roster.set(index, existing.withCount(existing.count() + 1, MAX_CREATURES_PER_SLOT));
                    status = detail.name() + " wurde zum Encounter hinzugefuegt.";
                    return snapshot();
                }
            }
            roster.add(fromDetail(detail, 1, "Manual", List.of()));
            status = detail.name() + " wurde zum Encounter hinzugefuegt.";
            return snapshot();
        }

        private EncounterSessionSnapshot incrementCreature(long creatureId) {
            for (int index = 0; index < roster.size(); index++) {
                EncounterSessionSnapshot.EncounterCreature creature = roster.get(index);
                if (creature.creatureId() == creatureId) {
                    clearGeneratedSelection();
                    roster.set(index, creature.withCount(creature.count() + 1, MAX_CREATURES_PER_SLOT));
                    status = creature.name() + " Anzahl angepasst.";
                    return snapshot();
                }
            }
            return snapshot();
        }

        private EncounterSessionSnapshot decrementCreature(long creatureId) {
            for (int index = 0; index < roster.size(); index++) {
                EncounterSessionSnapshot.EncounterCreature creature = roster.get(index);
                if (creature.creatureId() != creatureId) {
                    continue;
                }
                if (creature.count() <= 1) {
                    status = creature.name() + " bleibt mindestens einmal im Roster.";
                    return snapshot();
                }
                clearGeneratedSelection();
                roster.set(index, creature.withCount(creature.count() - 1, MAX_CREATURES_PER_SLOT));
                status = creature.name() + " Anzahl angepasst.";
                return snapshot();
            }
            return snapshot();
        }

        private EncounterSessionSnapshot removeCreature(long creatureId) {
            for (int index = 0; index < roster.size(); index++) {
                EncounterSessionSnapshot.EncounterCreature creature = roster.get(index);
                if (creature.creatureId() != creatureId) {
                    continue;
                }
                clearGeneratedSelection();
                roster.remove(index);
                pendingUndo = new EncounterSessionSnapshot.RemovedRosterEntry(++nextUndoToken, index, creature);
                status = creature.name() + " wurde entfernt.";
                return snapshot();
            }
            return snapshot();
        }

        private EncounterSessionSnapshot undoRemove(long token) {
            EncounterSessionSnapshot.RemovedRosterEntry removed = pendingUndo;
            if (removed == null || removed.token() != token) {
                return snapshot();
            }
            clearGeneratedSelection();
            int index = Math.max(0, Math.min(removed.index(), roster.size()));
            roster.add(index, removed.creature());
            pendingUndo = null;
            status = removed.creature().name() + " wurde wiederhergestellt.";
            return snapshot();
        }

        private EncounterSessionSnapshot openInitiative() {
            if (roster.isEmpty()) {
                status = "Kampfstart braucht mindestens eine Kreatur.";
                return snapshot();
            }
            if (activeParty.isEmpty()) {
                loadActiveParty();
            }
            if (activeParty.isEmpty()) {
                status = "Kampfstart braucht aktive Party-Mitglieder.";
                return snapshot();
            }
            pendingInitiativeRows.clear();
            for (int index = 0; index < activeParty.size(); index++) {
                EncounterSessionSnapshot.PartyMember member = activeParty.get(index);
                pendingInitiativeRows.add(new EncounterSessionSnapshot.InitiativeEntry(
                        member.id(),
                        member.name() + " (Lv. " + member.level() + ")",
                        "SC",
                        10 + index));
            }
            for (EncounterSessionSnapshot.EncounterCreature creature : roster) {
                int rolled = 12 + Math.max(-3, Math.min(6, creature.initiativeBonus()));
                String label = creature.count() > 1 ? creature.name() + " x" + creature.count() : creature.name();
                pendingInitiativeRows.add(new EncounterSessionSnapshot.InitiativeEntry(
                        creature.id(),
                        label + " (" + signed(creature.initiativeBonus()) + ")",
                        "Monster",
                        rolled));
            }
            initiativeState = new EncounterSessionSnapshot.InitiativeState(List.copyOf(pendingInitiativeRows));
            mode = EncounterSessionSnapshot.Mode.INITIATIVE;
            status = "Initiativewerte pruefen und Kampf starten.";
            return snapshot();
        }

        private EncounterSessionSnapshot backToBuilder() {
            mode = EncounterSessionSnapshot.Mode.BUILDER;
            status = "Zurueck zur Encounter-Erstellung.";
            return snapshot();
        }

        private EncounterSessionSnapshot confirmInitiative(
                List<EncounterSessionSnapshot.InitiativeInput> initiatives
        ) {
            combatRuntime.clear();
            int fallbackIndex = 0;
            for (EncounterSessionSnapshot.InitiativeInput input : safeInputs(initiatives)) {
                EncounterSessionSnapshot.InitiativeEntry entry = initiativeEntry(input.id());
                if (entry == null) {
                    continue;
                }
                if ("SC".equals(entry.kind())) {
                    fallbackIndex = combatRuntime.addPlayer(
                            entry.id(),
                            nameOnly(entry.label()),
                            input.initiative(),
                            fallbackIndex);
                    continue;
                }
                EncounterSessionSnapshot.EncounterCreature creature = creature(entry.id());
                if (creature != null) {
                    fallbackIndex = combatRuntime.addMonsters(
                            creature.id(),
                            creature.name(),
                            creature.creatureId(),
                            creature.count(),
                            creature.hp(),
                            creature.ac(),
                            creature.xp(),
                            creature.cr(),
                            creature.type(),
                            creature.role(),
                            input.initiative(),
                            fallbackIndex);
                }
            }
            combatRuntime.sort();
            currentTurnIndex = combatRuntime.hasTurnEntries() ? 0 : -1;
            round = 1;
            mode = EncounterSessionSnapshot.Mode.COMBAT;
            refreshCombatState();
            status = "Kampf laeuft. HP und Initiative sind lokal editierbar.";
            return snapshot();
        }

        private EncounterSessionSnapshot nextTurn() {
            CombatRuntime.TurnAdvance turn = combatRuntime.nextTurn(currentTurnIndex, round);
            currentTurnIndex = turn.currentTurnIndex();
            round = turn.round();
            refreshCombatState();
            return snapshot();
        }

        private EncounterSessionSnapshot setInitiative(String combatantId, int initiative) {
            combatRuntime.setInitiative(combatantId, initiative);
            refreshCombatState();
            return snapshot();
        }

        private EncounterSessionSnapshot addPartyMemberToCombat(long partyMemberId, int initiative) {
            if (mode != EncounterSessionSnapshot.Mode.COMBAT) {
                return snapshot();
            }
            EncounterSessionSnapshot.PartyMember member = partyMember(partyMemberId);
            if (member == null) {
                status = "SC konnte nicht geladen werden.";
                return snapshot();
            }
            String activeTurnId = combatRuntime.activeTurnId(currentTurnIndex);
            boolean added = combatRuntime.addPlayerToRunningCombat(member.id(), member.name(), initiative);
            currentTurnIndex = combatRuntime.turnIndexOf(activeTurnId, currentTurnIndex);
            refreshCombatState();
            status = added
                    ? member.name() + " betritt den laufenden Kampf."
                    : member.name() + " ist bereits im Kampf.";
            return snapshot();
        }

        private EncounterSessionSnapshot endCombat() {
            List<EncounterSessionSnapshot.ResultEnemySnapshot> enemies = combatRuntime.resultEnemies();
            int eligibleXp = enemies.stream()
                    .filter(EncounterSessionSnapshot.ResultEnemySnapshot::defeatedByDefault)
                    .mapToInt(EncounterSessionSnapshot.ResultEnemySnapshot::xp)
                    .sum();
            int partySize = Math.max(1, activeParty.size());
            resultState = new EncounterSessionSnapshot.ResultState(
                    enemies,
                    enemies.stream().filter(EncounterSessionSnapshot.ResultEnemySnapshot::defeatedByDefault).count(),
                    eligibleXp,
                    eligibleXp / partySize,
                    "Kein Loot",
                    "Loot-Persistenz ist in diesem Generator-Pass nicht angebunden.",
                    "",
                    false,
                    !activeParty.isEmpty(),
                    partySize);
            mode = EncounterSessionSnapshot.Mode.RESULTS;
            status = "Kampfergebnis bereit.";
            return snapshot();
        }

        private EncounterSessionSnapshot awardXp() {
            EncounterSessionSnapshot.ResultState current = resultState;
            if (current.xpAwarded() || current.perPlayerXp() <= 0 || activeParty.isEmpty() || party == null) {
                return snapshot();
            }
            MutationResult result = party.awardXp(new AwardPartyXpCommand(
                    activeParty.stream().map(EncounterSessionSnapshot.PartyMember::numericId).toList(),
                    current.perPlayerXp()));
            boolean success = result != null && result.status() == MutationStatus.SUCCESS;
            resultState = current.withAwardStatus(
                    success ? "XP an die aktive Party verteilt." : "XP konnte nicht verteilt werden.",
                    success);
            if (success) {
                loadActiveParty();
                loadBudgetIntoSession();
            }
            return snapshot();
        }

        private EncounterSessionSnapshot returnToBuilderAfterResults() {
            combatRuntime.clear();
            pendingInitiativeRows.clear();
            round = 1;
            currentTurnIndex = 0;
            initiativeState = EncounterSessionSnapshot.InitiativeState.empty();
            combatState = EncounterSessionSnapshot.CombatProjection.empty();
            resultState = EncounterSessionSnapshot.ResultState.empty();
            mode = EncounterSessionSnapshot.Mode.BUILDER;
            status = "Kampfergebnis geschlossen. Combat Planner bereit.";
            return snapshot();
        }

        private EncounterSessionSnapshot mutateHp(String combatantId, int amount, boolean healing) {
            if (combatRuntime.mutateHp(combatantId, Math.max(0, amount), healing)) {
                refreshCombatState();
            }
            return snapshot();
        }

        private void applyGeneratedEncounter(GeneratedEncounter generated) {
            roster.clear();
            for (EncounterCreature creature : generated.creatures()) {
                CreatureDetail detail = loadCreature(creature.creatureId());
                roster.add(detail == null
                        ? fromGeneratedFallback(creature)
                        : fromDetail(detail, creature.quantity(), creature.role(), creature.tags()));
            }
            generatedAdjustedXp = generated.adjustedXp();
            generatedDifficulty = difficultyLabel(generated.achievedDifficulty());
            generatedTitle = generated.title();
        }

        private void clearGeneratedSelection() {
            pendingUndo = null;
            activeSavedPlanId = 0L;
            generatedAlternatives.clear();
            generationHistoryPresent = false;
            selectedAlternativeIndex = 0;
            generatedAdjustedXp = 0;
            generatedDifficulty = "";
            generatedTitle = "";
        }

        private void loadActiveParty() {
            if (party == null) {
                activeParty.clear();
                return;
            }
            ActivePartyResult result = party.loadActiveParty(new LoadActivePartyQuery());
            activeParty.clear();
            if (result.status() != ReadStatus.SUCCESS) {
                return;
            }
            for (PartyMemberSummary member : result.members()) {
                if (member != null && member.id() != null) {
                    activeParty.add(new EncounterSessionSnapshot.PartyMember(
                            "pc-" + member.id(),
                            member.id(),
                            member.name(),
                            member.level()));
                }
            }
        }

        private void loadBudgetIntoSession() {
            EncounterBudgetResult result = EncounterApplicationService.this.loadBudget(new LoadEncounterBudgetQuery());
            budget = result.status() == EncounterGenerationStatus.SUCCESS ? result.budget() : null;
        }

        private void refreshSavedPlans() {
            SavedEncounterPlanListResult result = EncounterApplicationService.this.listPlans(new ListSavedEncounterPlansQuery());
            savedPlans.clear();
            if (result.status() == SavedEncounterPlanStatus.SUCCESS) {
                savedPlans.addAll(result.plans());
            } else if (!result.message().isBlank()) {
                status = result.message();
            }
        }

        private EncounterSessionSnapshot.BuilderState builderState() {
            EncounterBudgetSummary currentBudget = budget;
            int adjustedXp = generatedAdjustedXp > 0
                    ? generatedAdjustedXp
                    : roster.stream().mapToInt(EncounterSessionSnapshot.EncounterCreature::totalXp).sum();
            EncounterSessionSnapshot.DifficultySummary difficulty = currentBudget == null
                    ? new EncounterSessionSnapshot.DifficultySummary(0, 0, 0, 0, adjustedXp, roster.isEmpty() ? "" : "Keine Party")
                    : new EncounterSessionSnapshot.DifficultySummary(
                            currentBudget.easyXp(),
                            currentBudget.mediumXp(),
                            currentBudget.hardXp(),
                            currentBudget.deadlyXp(),
                            adjustedXp,
                            generatedDifficulty.isBlank() ? evaluateDifficulty(adjustedXp, currentBudget) : generatedDifficulty);
            return new EncounterSessionSnapshot.BuilderState(
                    List.copyOf(activeParty),
                    List.copyOf(roster),
                    titleLabel(),
                    difficulty,
                    builderInputs,
                    List.copyOf(savedPlans),
                    !roster.isEmpty() && !activeParty.isEmpty(),
                    generatedAlternatives.size() > 1,
                    generatedAlternatives.size() > 1,
                    !roster.isEmpty(),
                    generationHistoryPresent || !generatedAlternatives.isEmpty(),
                    pendingUndo);
        }

        private List<EncounterSessionSnapshot.PartyMember> missingCombatPartyMembers() {
            List<String> activePcIds = combatState.cards().stream()
                    .filter(EncounterSessionSnapshot.CombatCardSnapshot::playerCharacter)
                    .map(EncounterSessionSnapshot.CombatCardSnapshot::id)
                    .toList();
            return activeParty.stream()
                    .filter(member -> !activePcIds.contains(member.id()))
                    .toList();
        }

        private String saveName() {
            if (!generatedTitle.isBlank()) {
                return generatedTitle;
            }
            return roster.isEmpty() ? "Encounter" : "Manuelles Encounter";
        }

        private String titleLabel() {
            if (generatedTitle.isBlank()) {
                return roster.isEmpty() ? "" : "Manuelles Encounter";
            }
            if (generatedAlternatives.size() <= 1) {
                return generatedTitle;
            }
            return generatedTitle + " (" + (selectedAlternativeIndex + 1) + "/" + generatedAlternatives.size() + ")";
        }

        private void refreshCombatState() {
            EncounterSessionSnapshot.CombatProjection projection = combatRuntime.combatProjection(currentTurnIndex, round);
            currentTurnIndex = projection.currentTurnIndex();
            combatState = projection;
        }

        private static EncounterSessionSnapshot.BuilderInputs normalizeBuilderInputs(
                EncounterSessionSnapshot.BuilderInputs candidate
        ) {
            EncounterSessionSnapshot.BuilderInputs safeCandidate = candidate == null
                    ? EncounterSessionSnapshot.BuilderInputs.empty()
                    : candidate;
            return new EncounterSessionSnapshot.BuilderInputs(
                    safeCandidate.creatureTypes(),
                    safeCandidate.creatureSubtypes(),
                    safeCandidate.biomes(),
                    safeCandidate.targetDifficulty(),
                    safeCandidate.tuning(),
                    safeCandidate.encounterTableIds());
        }

        private long nextGenerationSeed() {
            return System.nanoTime();
        }

        private @Nullable CreatureDetail loadCreature(long creatureId) {
            if (creatures == null) {
                return null;
            }
            CreatureDetailResult result = creatures.loadCreatureDetail(new LoadCreatureDetailQuery(creatureId));
            if (result.status() != CreatureLookupStatus.SUCCESS) {
                return null;
            }
            return result.detail();
        }

        private EncounterSessionSnapshot.@Nullable InitiativeEntry initiativeEntry(String id) {
            for (EncounterSessionSnapshot.InitiativeEntry entry : pendingInitiativeRows) {
                if (entry.id().equals(id)) {
                    return entry;
                }
            }
            return null;
        }

        private EncounterSessionSnapshot.@Nullable EncounterCreature creature(String id) {
            for (EncounterSessionSnapshot.EncounterCreature creature : roster) {
                if (creature.id().equals(id)) {
                    return creature;
                }
            }
            return null;
        }

        private EncounterSessionSnapshot.@Nullable PartyMember partyMember(long id) {
            for (EncounterSessionSnapshot.PartyMember member : activeParty) {
                if (member.numericId() == id) {
                    return member;
                }
            }
            return null;
        }
    }

    private static EncounterSessionSnapshot.EncounterCreature fromDetail(
            CreatureDetail detail,
            int quantity,
            String role,
            List<String> tags
    ) {
        return new EncounterSessionSnapshot.EncounterCreature(
                "monster-" + detail.id(),
                detail.id(),
                detail.name(),
                detail.challengeRating(),
                detail.xp(),
                Math.max(1, detail.hitPoints()),
                detail.armorClass(),
                detail.initiativeBonus(),
                detail.creatureType(),
                role == null || role.isBlank() ? "Creature" : role,
                Math.max(1, quantity),
                tags);
    }

    private static EncounterSessionSnapshot.EncounterCreature fromGeneratedFallback(EncounterCreature creature) {
        return new EncounterSessionSnapshot.EncounterCreature(
                "monster-" + creature.creatureId(),
                creature.creatureId(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                1,
                10,
                0,
                "",
                creature.role(),
                creature.quantity(),
                creature.tags());
    }

    private static String evaluateDifficulty(int adjustedXp, EncounterBudgetSummary budget) {
        if (adjustedXp >= budget.deadlyXp()) {
            return "Deadly";
        }
        if (adjustedXp >= budget.hardXp()) {
            return "Hard";
        }
        if (adjustedXp >= budget.mediumXp()) {
            return "Medium";
        }
        return adjustedXp <= 0 ? "" : "Easy";
    }

    private static String difficultyLabel(EncounterDifficultyBand band) {
        return switch (band == null ? EncounterDifficultyBand.MEDIUM : band) {
            case AUTO -> "Auto";
            case EASY -> "Easy";
            case MEDIUM -> "Medium";
            case HARD -> "Hard";
            case DEADLY -> "Deadly";
        };
    }

    private static String generationSuccessText(EncounterGenerationResult result) {
        StringBuilder text = new StringBuilder(result.encounters().size() + " Encounter-Optionen generiert.");
        EncounterGenerationDiagnostics diagnostics = result.diagnostics();
        if (diagnostics != null) {
            text.append(" Ziel: ")
                    .append(difficultyLabel(diagnostics.resolvedDifficulty()))
                    .append(", Tuning: ")
                    .append(tuningLabel(diagnostics.resolvedTuning()))
                    .append('.');
        }
        if (result.advisories().contains(EncounterGenerationAdvisory.FALLBACK_USED)) {
            text.append(" Fallback verwendet.");
        }
        return text.toString();
    }

    private static String tuningLabel(EncounterGenerationTuning tuning) {
        EncounterGenerationTuning effective = tuning == null ? EncounterGenerationTuning.defaultTuning() : tuning;
        return "B" + effective.balanceLevel()
                + "/M" + Math.round(effective.amountValue())
                + "/D" + effective.diversityLevel();
    }

    private static String generationStatusText(EncounterGenerationStatus status) {
        return switch (status == null ? EncounterGenerationStatus.defaultFailure() : status) {
            case NO_ACTIVE_PARTY -> "Die aktive Party hat keine Mitglieder.";
            case NO_CREATURES -> "Keine Kreaturen passen zu diesen Filtern.";
            case NO_SOLUTION -> "Keine passende Encounter-Komposition gefunden.";
            case INVALID_REQUEST -> "Encounter-Filter sind ungueltig.";
            case STORAGE_ERROR -> "Encounter konnte nicht generiert werden.";
            case SUCCESS -> "Encounter generiert.";
        };
    }

    private static List<EncounterSessionSnapshot.InitiativeInput> safeInputs(
            List<EncounterSessionSnapshot.InitiativeInput> initiatives
    ) {
        return initiatives == null ? List.of() : List.copyOf(initiatives);
    }

    private static String nameOnly(String label) {
        int detailStart = label.indexOf(" (");
        return detailStart < 0 ? label : label.substring(0, detailStart);
    }

    private static String signed(int value) {
        return value >= 0 ? "+" + value : String.valueOf(value);
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

    private static final class CombatRuntime {

        private static final int MOB_MIN_SIZE = 4;
        private static final int MAX_CREATURES_PER_MOB = 10;

        private final List<Combatant> combatants = new ArrayList<>();

        private void clear() {
            combatants.clear();
        }

        private int addPlayer(String id, String name, int initiative, int order) {
            return addPlayerCombatant(combatants, id, name, initiative, order);
        }

        private int addMonsters(
                String id,
                String name,
                long creatureId,
                int count,
                int hp,
                int ac,
                int xp,
                String cr,
                String type,
                String role,
                int initiative,
                int order
        ) {
            return addMonsterCombatants(
                    combatants,
                    id,
                    name,
                    creatureId,
                    count,
                    hp,
                    ac,
                    xp,
                    cr,
                    type,
                    role,
                    initiative,
                    order);
        }

        private void sort() {
            sort(combatants);
        }

        private boolean hasTurnEntries() {
            return !turnEntries(combatants).isEmpty();
        }

        private @Nullable String activeTurnId(int currentTurnIndex) {
            List<TurnEntry> entries = turnEntries(combatants);
            int index = normalizedTurnIndex(entries, currentTurnIndex);
            return index < 0 ? null : entries.get(index).id();
        }

        private int turnIndexOf(@Nullable String combatantId, int fallbackTurnIndex) {
            List<TurnEntry> entries = turnEntries(combatants);
            if (combatantId != null) {
                for (int index = 0; index < entries.size(); index++) {
                    if (entries.get(index).id().equals(combatantId)) {
                        return index;
                    }
                }
            }
            return normalizedTurnIndex(entries, fallbackTurnIndex);
        }

        private String addMonsterReinforcement(
                String name,
                long creatureId,
                int hp,
                int ac,
                int xp,
                String cr,
                String type,
                String role,
                int initiative
        ) {
            int nextOrdinal = nextMonsterOrdinal(combatants, creatureId);
            int nextOrder = nextOrder(combatants);
            String id = "reinforcement-" + creatureId + "-" + nextOrdinal;
            addMonsterCombatants(
                    combatants,
                    id,
                    name,
                    creatureId,
                    1,
                    hp,
                    ac,
                    xp,
                    cr,
                    type,
                    role,
                    initiative,
                    nextOrder);
            sort(combatants);
            return uniqueMonsterName(name, nextOrdinal);
        }

        private boolean addPlayerToRunningCombat(String id, String name, int initiative) {
            for (Combatant combatant : combatants) {
                if (combatant.id().equals(id)) {
                    return false;
                }
            }
            combatants.add(Combatant.pc(id, name, initiative, nextOrder(combatants)));
            sort(combatants);
            return true;
        }

        private TurnAdvance nextTurn(int currentTurnIndex, int round) {
            List<TurnEntry> entries = turnEntries(combatants);
            if (entries.isEmpty()) {
                return new TurnAdvance(currentTurnIndex, round);
            }
            int next = currentTurnIndex;
            int nextRound = round;
            for (int attempts = 0; attempts < entries.size(); attempts++) {
                next = (next + 1) % entries.size();
                if (next == 0) {
                    nextRound++;
                }
                if (entries.get(next).alive()) {
                    return new TurnAdvance(next, nextRound);
                }
            }
            return new TurnAdvance(currentTurnIndex, round);
        }

        private void setInitiative(String combatantId, int initiative) {
            setInitiative(combatants, combatantId, initiative);
        }

        private boolean mutateHp(String combatantId, int amount, boolean healing) {
            return mutateHp(combatants, combatantId, amount, healing);
        }

        private List<EncounterSessionSnapshot.ResultEnemySnapshot> resultEnemies() {
            return combatants.stream()
                    .filter(combatant -> !combatant.pc())
                    .map(combatant -> new EncounterSessionSnapshot.ResultEnemySnapshot(
                            combatant.name(),
                            combatant.alive() ? "Lebt" : "Tot",
                            Math.max(0, combatant.maxHp() - combatant.currentHp()),
                            combatant.xp(),
                            !combatant.alive(),
                            combatant.loot()))
                    .toList();
        }

        private EncounterSessionSnapshot.CombatProjection combatProjection(int requestedTurnIndex, int round) {
            List<TurnEntry> entries = turnEntries(combatants);
            int currentTurnIndex = normalizedTurnIndex(entries, requestedTurnIndex);
            List<EncounterSessionSnapshot.CombatCardSnapshot> cards = new ArrayList<>();
            int aliveEnemies = 0;
            int totalEnemies = 0;
            for (Combatant combatant : combatants) {
                if (!combatant.pc()) {
                    totalEnemies++;
                    if (combatant.alive()) {
                        aliveEnemies++;
                    }
                }
            }
            for (int index = 0; index < entries.size(); index++) {
                TurnEntry entry = entries.get(index);
                cards.add(new EncounterSessionSnapshot.CombatCardSnapshot(
                        entry.id(),
                        entry.name(),
                        entry.pc(),
                        index == currentTurnIndex && entry.alive(),
                        entry.alive(),
                        entry.currentHp(),
                        entry.maxHp(),
                        entry.ac(),
                        entry.initiative(),
                        entry.count(),
                        entry.detail()));
            }
            String statusText = aliveEnemies + "/" + totalEnemies + " - " + liveDifficulty(totalEnemies, aliveEnemies);
            return new EncounterSessionSnapshot.CombatProjection(
                    currentTurnIndex,
                    round,
                    statusText,
                    cards,
                    totalEnemies > 0 && aliveEnemies == 0);
        }

        private static int normalizedTurnIndex(List<TurnEntry> entries, int requestedTurnIndex) {
            if (entries.isEmpty()) {
                return -1;
            }
            int currentTurnIndex = Math.max(0, Math.min(requestedTurnIndex, entries.size() - 1));
            if (entries.get(currentTurnIndex).alive()) {
                return currentTurnIndex;
            }
            for (int index = 0; index < entries.size(); index++) {
                if (entries.get(index).alive()) {
                    return index;
                }
            }
            return currentTurnIndex;
        }

        private static String liveDifficulty(int totalEnemies, int aliveEnemies) {
            if (totalEnemies == 0) {
                return "Keine Gegner";
            }
            double ratio = aliveEnemies / (double) totalEnemies;
            if (ratio <= 0.25) {
                return "Kippt";
            }
            if (ratio <= 0.5) {
                return "Unter Kontrolle";
            }
            if (ratio <= 0.75) {
                return "Gefaehrlich";
            }
            return "Volle Staerke";
        }

        private static void sort(List<Combatant> combatants) {
            combatants.sort(CombatRuntime::compareByTurnOrder);
        }

        private static int addPlayerCombatant(
                List<Combatant> combatants,
                String id,
                String name,
                int initiative,
                int order
        ) {
            combatants.add(Combatant.pc(id, name, initiative, order));
            return order + 1;
        }

        private static int addMonsterCombatants(
                List<Combatant> combatants,
                String id,
                String name,
                long creatureId,
                int count,
                int hp,
                int ac,
                int xp,
                String cr,
                String type,
                String role,
                int initiative,
                int order
        ) {
            int nextOrder = order;
            int firstOrdinal = nextMonsterOrdinal(combatants, creatureId);
            for (int creatureIndex = 1; creatureIndex <= count; creatureIndex++) {
                String displayName = count == 1 ? uniqueMonsterName(name, firstOrdinal) : name;
                combatants.add(Combatant.monster(
                        id,
                        displayName,
                        creatureId,
                        count,
                        hp,
                        ac,
                        xp,
                        cr,
                        type,
                        role,
                        initiative,
                        nextOrder++,
                        count == 1 ? 1 : creatureIndex));
            }
            return nextOrder;
        }

        private static void setInitiative(List<Combatant> combatants, String combatantId, int initiative) {
            TurnEntry entry = turnEntry(combatants, combatantId);
            if (entry == null) {
                return;
            }
            List<String> ids = entry.memberIds();
            for (int index = 0; index < combatants.size(); index++) {
                Combatant combatant = combatants.get(index);
                if (ids.contains(combatant.id())) {
                    combatants.set(index, combatant.withInitiative(initiative));
                }
            }
            sort(combatants);
        }

        private static boolean mutateHp(List<Combatant> combatants, String combatantId, int amount, boolean healing) {
            if (amount <= 0) {
                return false;
            }
            TurnEntry entry = turnEntry(combatants, combatantId);
            if (entry == null || entry.pc()) {
                return false;
            }
            List<Combatant> targets = aliveMembers(combatants, entry.memberIds());
            if (targets.isEmpty()) {
                return false;
            }
            if (healing) {
                Combatant target = targets.getFirst();
                replace(combatants, target, Math.min(target.maxHp(), target.currentHp() + amount));
            } else {
                damage(combatants, targets, amount);
            }
            return true;
        }

        private static List<TurnEntry> turnEntries(List<Combatant> combatants) {
            List<TurnEntry> entries = new ArrayList<>();
            List<List<Combatant>> aliveMonsterBuckets = new ArrayList<>();
            List<Combatant> deadMonsters = new ArrayList<>();
            for (Combatant combatant : combatants) {
                if (combatant.pc()) {
                    entries.add(singleEntry(combatant, true));
                } else if (combatant.alive()) {
                    aliveBucket(aliveMonsterBuckets, combatant).add(combatant);
                } else {
                    deadMonsters.add(combatant);
                }
            }
            appendAliveMonsterBuckets(entries, aliveMonsterBuckets);
            deadMonsters.sort(CombatRuntime::compareByTurnOrder);
            for (Combatant combatant : deadMonsters) {
                entries.add(singleEntry(combatant, false));
            }
            entries.sort(CombatRuntime::compareEntriesByTurnOrder);
            return entries;
        }

        private static List<Combatant> aliveBucket(List<List<Combatant>> buckets, Combatant combatant) {
            for (List<Combatant> bucket : buckets) {
                Combatant sample = bucket.getFirst();
                if (sample.creatureId() == combatant.creatureId()
                        && sample.initiative() == combatant.initiative()) {
                    return bucket;
                }
            }
            List<Combatant> bucket = new ArrayList<>();
            buckets.add(bucket);
            return bucket;
        }

        private static void appendAliveMonsterBuckets(List<TurnEntry> entries, List<List<Combatant>> buckets) {
            for (List<Combatant> members : buckets) {
                members.sort(CombatRuntime::compareByHpThenName);
                int offset = 0;
                int partIndex = 0;
                for (int partSize : splitForMobSlots(members.size())) {
                    List<Combatant> part = members.subList(offset, offset + partSize);
                    offset += partSize;
                    if (partSize >= MOB_MIN_SIZE) {
                        entries.add(mobEntry(part, partIndex++));
                    } else {
                        for (Combatant member : part) {
                            entries.add(singleEntry(member, true));
                        }
                    }
                }
            }
        }

        private static TurnEntry singleEntry(Combatant combatant, boolean alive) {
            return new TurnEntry(
                    combatant.id(),
                    combatant.name(),
                    combatant.pc(),
                    alive,
                    combatant.currentHp(),
                    combatant.maxHp(),
                    combatant.ac(),
                    combatant.initiative(),
                    combatant.count(),
                    combatant.detail(),
                    combatant.order(),
                    List.of(combatant.id()));
        }

        private static TurnEntry mobEntry(List<Combatant> part, int partIndex) {
            Combatant front = part.getFirst();
            List<String> memberIds = new ArrayList<>();
            for (Combatant member : part) {
                memberIds.add(member.id());
            }
            String frontName = front.name();
            int marker = frontName.lastIndexOf(" #");
            String name = (marker > 0 ? frontName.substring(0, marker) : frontName) + " (Mob)";
            return new TurnEntry(
                    "mob:" + front.creatureId() + ":" + front.initiative() + ":" + partIndex,
                    name,
                    false,
                    true,
                    front.currentHp(),
                    front.maxHp(),
                    front.ac(),
                    front.initiative(),
                    part.size(),
                    front.detail() + " | x" + part.size(),
                    front.order(),
                    memberIds);
        }

        private static @Nullable TurnEntry turnEntry(List<Combatant> combatants, String id) {
            for (TurnEntry entry : turnEntries(combatants)) {
                if (entry.id().equals(id)) {
                    return entry;
                }
            }
            return null;
        }

        private static List<Combatant> aliveMembers(List<Combatant> combatants, List<String> ids) {
            List<Combatant> targets = new ArrayList<>();
            for (Combatant combatant : combatants) {
                if (ids.contains(combatant.id()) && combatant.alive()) {
                    targets.add(combatant);
                }
            }
            targets.sort(CombatRuntime::compareByHpThenName);
            return targets;
        }

        private static void replace(List<Combatant> combatants, Combatant target, int hp) {
            for (int index = 0; index < combatants.size(); index++) {
                if (combatants.get(index).id().equals(target.id())) {
                    combatants.set(index, target.withHp(hp));
                    return;
                }
            }
        }

        private static void damage(List<Combatant> combatants, List<Combatant> targets, int damage) {
            int remaining = damage;
            for (Combatant target : targets) {
                if (remaining <= 0) {
                    return;
                }
                int appliedDamage = Math.min(remaining, target.currentHp());
                replace(combatants, target, target.currentHp() - appliedDamage);
                remaining -= appliedDamage;
            }
        }

        private static int nextMonsterOrdinal(List<Combatant> combatants, long creatureId) {
            int count = 0;
            for (Combatant combatant : combatants) {
                if (!combatant.pc() && combatant.creatureId() == creatureId) {
                    count++;
                }
            }
            return count + 1;
        }

        private static int nextOrder(List<Combatant> combatants) {
            int order = 0;
            for (Combatant combatant : combatants) {
                order = Math.max(order, combatant.order() + 1);
            }
            return order;
        }

        private static String uniqueMonsterName(String name, int ordinal) {
            return ordinal <= 1 ? name : name + " #" + ordinal;
        }

        private static List<Integer> splitForMobSlots(int count) {
            if (count < MOB_MIN_SIZE) {
                List<Integer> singles = new ArrayList<>();
                for (int index = 0; index < count; index++) {
                    singles.add(1);
                }
                return singles;
            }
            if (count <= MAX_CREATURES_PER_MOB) {
                return List.of(count);
            }
            int groupCount = (int) Math.ceil(count / (double) MAX_CREATURES_PER_MOB);
            int base = count / groupCount;
            int remainder = count % groupCount;
            List<Integer> parts = new ArrayList<>();
            for (int index = 0; index < groupCount; index++) {
                parts.add(base + (index < remainder ? 1 : 0));
            }
            return parts;
        }

        private static int compareByHpThenName(Combatant left, Combatant right) {
            int byHp = Integer.compare(left.currentHp(), right.currentHp());
            return byHp != 0 ? byHp : left.name().compareTo(right.name());
        }

        private static int compareByTurnOrder(Combatant left, Combatant right) {
            int byInitiative = Integer.compare(right.initiative(), left.initiative());
            if (byInitiative != 0) {
                return byInitiative;
            }
            int byKind = Boolean.compare(!left.pc(), !right.pc());
            return byKind != 0 ? byKind : Integer.compare(left.order(), right.order());
        }

        private static int compareEntriesByTurnOrder(TurnEntry left, TurnEntry right) {
            int byInitiative = Integer.compare(right.initiative(), left.initiative());
            if (byInitiative != 0) {
                return byInitiative;
            }
            int byKind = Boolean.compare(!left.pc(), !right.pc());
            return byKind != 0 ? byKind : Integer.compare(left.order(), right.order());
        }

        private record Combatant(
                String id,
                String name,
                boolean pc,
                long creatureId,
                int currentHp,
                int maxHp,
                int ac,
                int initiative,
                int count,
                int xp,
                String detail,
                String loot,
                int order
        ) {
            private static Combatant pc(String id, String name, int initiative, int order) {
                return new Combatant(id, name, true, 0, 0, 0, 0, initiative, 1, 0, "SC", "", order);
            }

            private static Combatant monster(
                    String id,
                    String name,
                    long creatureId,
                    int count,
                    int hitPoints,
                    int ac,
                    int xp,
                    String cr,
                    String type,
                    String role,
                    int initiative,
                    int order,
                    int creatureIndex
            ) {
                int hp = Math.max(1, hitPoints);
                String displayName = count > 1 ? name + " #" + creatureIndex : name;
                return new Combatant(
                        id + ":" + creatureIndex,
                        displayName,
                        false,
                        creatureId,
                        hp,
                        hp,
                        ac,
                        initiative,
                        1,
                        xp,
                        "CR " + cr + " | " + type + " | " + role.toLowerCase(Locale.ROOT),
                        "Kein Loot",
                        order);
            }

            private boolean alive() {
                return pc || currentHp > 0;
            }

            private Combatant withHp(int hitPoints) {
                return new Combatant(id, name, pc, creatureId, hitPoints, maxHp, ac, initiative, count, xp, detail, loot, order);
            }

            private Combatant withInitiative(int value) {
                return new Combatant(id, name, pc, creatureId, currentHp, maxHp, ac, value, count, xp, detail, loot, order);
            }
        }

        private record TurnEntry(
                String id,
                String name,
                boolean pc,
                boolean alive,
                int currentHp,
                int maxHp,
                int ac,
                int initiative,
                int count,
                String detail,
                int order,
                List<String> memberIds
        ) {
            private TurnEntry {
                memberIds = memberIds == null ? List.of() : List.copyOf(memberIds);
            }
        }

        private record TurnAdvance(int currentTurnIndex, int round) {
        }
    }
}
