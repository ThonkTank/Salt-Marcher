package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.application.ApplyEncounterSessionUseCase;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.application.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.published.EncounterBudgetResult;
import src.domain.encounter.published.EncounterBudgetSummary;
import src.domain.encounter.published.EncounterGenerationResult;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.ApplyEncounterSessionCommand;
import src.domain.encounter.published.EncounterSessionModel;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.GenerateEncounterCommand;
import src.domain.encounter.published.ListSavedEncounterPlansQuery;
import src.domain.encounter.published.LoadEncounterBudgetQuery;
import src.domain.encounter.published.LoadEncounterPlanBudgetQuery;
import src.domain.encounter.published.LoadEncounterSessionQuery;
import src.domain.encounter.published.LoadEncounterTuningPreviewQuery;
import src.domain.encounter.published.LoadSavedEncounterPlanQuery;
import src.domain.encounter.published.SaveEncounterPlanCommand;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.party.PartyApplicationService;

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
        SaveEncounterPlanUseCase nextSavePlanUseCase =
                encounterPlans == null ? null : new SaveEncounterPlanUseCase(encounterPlans);
        LoadSavedEncounterPlanUseCase nextLoadSavedPlanUseCase =
                encounterPlans == null ? null : new LoadSavedEncounterPlanUseCase(encounterPlans);
        ListSavedEncounterPlansUseCase nextListSavedPlansUseCase =
                encounterPlans == null ? null : new ListSavedEncounterPlansUseCase(encounterPlans);
        EncounterGenerationUseCase nextGenerator;
        LoadEncounterBudgetUseCase nextLoadBudgetUseCase;
        ApplyEncounterSessionUseCase nextApplySessionUseCase;
        if (party != null && creatures != null) {
            nextGenerator = new EncounterGenerationUseCase(party, creatures, encounterTables);
            nextLoadBudgetUseCase = new LoadEncounterBudgetUseCase(party);
            nextApplySessionUseCase = new ApplyEncounterSessionUseCase(new EncounterSessionRuntimeAccessAdapter(
                    party,
                    creatures,
                    nextGenerator,
                    nextLoadBudgetUseCase,
                    nextSavePlanUseCase,
                    nextLoadSavedPlanUseCase,
                    nextListSavedPlansUseCase));
        } else {
            nextGenerator = null;
            nextLoadBudgetUseCase = null;
            nextApplySessionUseCase = null;
        }
        this.generator = nextGenerator;
        this.loadBudgetUseCase = nextLoadBudgetUseCase;
        this.applySessionUseCase = nextApplySessionUseCase;
        if (party != null && creatures != null && encounterPlans != null) {
            this.loadPlanBudgetUseCase = new LoadEncounterPlanBudgetUseCase(encounterPlans, party, creatures);
        } else {
            this.loadPlanBudgetUseCase = null;
        }
        this.savePlanUseCase = nextSavePlanUseCase;
        this.loadSavedPlanUseCase = nextLoadSavedPlanUseCase;
        this.listSavedPlansUseCase = nextListSavedPlansUseCase;
    }

    public EncounterBudgetResult loadBudget(LoadEncounterBudgetQuery query) {
        Objects.requireNonNull(query, "query");
        if (loadBudgetUseCase == null) {
            return new EncounterBudgetResult(EncounterGenerationStatus.STORAGE_ERROR, null, "Encounter budget service is not registered.");
        }
        try {
            LoadEncounterBudgetUseCase.Result result = loadBudgetUseCase.execute();
            return new EncounterBudgetResult(
                    EncounterPublishedBudgetMapper.mapBudgetStatus(result.status()),
                    EncounterPublishedBudgetMapper.toPublishedBudget(result.budget()),
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
                    EncounterPublishedBudgetMapper.tuningPreviewLabels(null),
                    "Encounter tuning preview service is not registered.");
            notifyTuningPreviewListeners(currentTuningPreview);
            return currentTuningPreview;
        }
        try {
            LoadEncounterBudgetUseCase.Result result = loadBudgetUseCase.execute();
            EncounterBudgetSummary budget = EncounterPublishedBudgetMapper.toPublishedBudget(result.budget());
            currentTuningPreview = new EncounterTuningPreviewResult(
                    EncounterPublishedBudgetMapper.mapBudgetStatus(result.status()),
                    EncounterPublishedBudgetMapper.tuningPreviewLabels(budget),
                    result.message());
        } catch (RuntimeException exception) {
            currentTuningPreview = new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    EncounterPublishedBudgetMapper.tuningPreviewLabels(null),
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
                    EncounterPublishedBudgetMapper.toPublishedPlanBudgetStatus(result.status()),
                    EncounterPublishedBudgetMapper.toPublishedPlanBudget(result.summary()),
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
            EncounterGenerationUseCase.GenerateResult result = generator.execute(
                    EncounterPublishedGenerationMapper.toGenerateRequest(request));
            return new EncounterGenerationResult(
                    EncounterPublishedGenerationMapper.mapStatus(result.status()),
                    EncounterPublishedBudgetMapper.toPublishedBudget(result.budget()),
                    result.encounters().stream().map(EncounterPublishedGenerationMapper::toPublishedEncounter).toList(),
                    result.message(),
                    EncounterPublishedGenerationMapper.toPublishedDiagnostics(result.diagnostics()),
                    result.advisories().stream().map(EncounterPublishedGenerationMapper::toPublishedAdvisory).toList());
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
                        .map(EncounterPublishedPlanMapper::toPlanCreature)
                        .toList());
        return new SavedEncounterPlanResult(
                EncounterPublishedPlanMapper.toPublishedSavePlanStatus(result.status()),
                result.plan() == null ? null : EncounterPublishedPlanMapper.toPublishedPlan(result.plan()),
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
                EncounterPublishedPlanMapper.toPublishedLoadPlanStatus(result.status()),
                result.plan() == null ? null : EncounterPublishedPlanMapper.toPublishedPlan(result.plan()),
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
                EncounterPublishedPlanMapper.toPublishedListPlansStatus(result.status()),
                result.plans().stream().map(EncounterPublishedPlanMapper::toPublishedSummary).toList(),
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
        EncounterSessionSnapshot snapshot = EncounterSessionSnapshotMapper.toPublishedSnapshot(
                useCase.apply(EncounterSessionCommandMapper.toInternalCommand(command)));
        notifySessionListeners(snapshot);
        return snapshot;
    }

    private EncounterSessionSnapshot currentSessionSnapshot() {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            return EncounterSessionSnapshot.empty("Encounter session is not registered.");
        }
        return EncounterSessionSnapshotMapper.toPublishedSnapshot(useCase.snapshot());
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

}
