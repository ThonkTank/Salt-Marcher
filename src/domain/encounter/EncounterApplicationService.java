package src.domain.encounter;

import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.application.ApplyEncounterSessionUseCase;
import src.domain.encounter.application.EncounterBuilderInputsBoundaryTranslator;
import src.domain.encounter.application.EncounterBudgetBoundaryTranslator;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.EncounterPlanBoundaryTranslator;
import src.domain.encounter.application.EncounterSessionRuntimeAdapter;
import src.domain.encounter.application.EncounterStateBoundaryTranslator;
import src.domain.encounter.application.EncounterStateSnapshotProjector;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.application.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.plan.port.EncounterPlanPublishedStateRepository;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterBudgetSummary;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;
import src.domain.encounter.session.entity.EncounterSession;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;
import src.domain.encounter.session.port.EncounterSessionPublishedStateRepository;
import src.domain.encounter.session.value.EncounterSessionCommand;
import src.domain.encountertable.EncounterTableApplicationService;

/**
 * Public encounter facade that owns command publication and same-context model
 * refresh for the encounter feature.
 */
@SuppressWarnings("PMD.AvoidCatchingGenericException")
public final class EncounterApplicationService {

    private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";
    private static final String SESSION_NOT_REGISTERED = "Encounter session is not registered.";

    private final @Nullable ApplyEncounterSessionUseCase applySessionUseCase;
    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;
    private final @Nullable LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase;
    private final @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase;
    private final EncounterSessionPublishedStateRepository sessionPublishedStateRepository;
    private final EncounterPlanPublishedStateRepository planPublishedStateRepository;

    public EncounterApplicationService(
            @Nullable EncounterPartyFactsRepository party,
            @Nullable CreaturesApplicationService creatures,
            @Nullable EncounterTableApplicationService encounterTables,
            @Nullable EncounterPlanRepository encounterPlans,
            EncounterSessionPublishedStateRepository sessionPublishedStateRepository,
            EncounterPlanPublishedStateRepository planPublishedStateRepository
    ) {
        this.sessionPublishedStateRepository = sessionPublishedStateRepository;
        this.planPublishedStateRepository = planPublishedStateRepository;
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
            nextApplySessionUseCase = new ApplyEncounterSessionUseCase(new EncounterSessionRuntimeAdapter(
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
        this.applySessionUseCase = nextApplySessionUseCase;
        this.loadBudgetUseCase = nextLoadBudgetUseCase;
        this.loadPlanBudgetUseCase = party != null && creatures != null && encounterPlans != null
                ? new LoadEncounterPlanBudgetUseCase(encounterPlans, party, creatures)
                : null;
        this.listSavedPlansUseCase = nextListSavedPlansUseCase;
        publishCurrentSession(nextApplySessionUseCase == null ? null : nextApplySessionUseCase.session());
        publishSavedPlans();
        publishPlanBudget(0L);
    }

    public void applyState(ApplyEncounterStateCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            publishCurrentSession(null);
            return;
        }
        EncounterSession session = useCase.apply(EncounterStateBoundaryTranslator.toInternalCommand(command));
        publishCurrentSession(session);
        ApplyEncounterStateCommand.Action action = command == null ? ApplyEncounterStateCommand.Action.REFRESH : command.action();
        if (action == ApplyEncounterStateCommand.Action.REFRESH
                || action == ApplyEncounterStateCommand.Action.OPEN_SAVED_PLAN
                || action == ApplyEncounterStateCommand.Action.SAVE_CURRENT_PLAN) {
            publishSavedPlans();
        }
    }

    public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            publishCurrentSession(null);
            return;
        }
        UpdateEncounterBuilderInputsCommand effective = command == null
                ? new UpdateEncounterBuilderInputsCommand(EncounterBuilderInputs.empty())
                : command;
        EncounterSession session = useCase.apply(new EncounterSessionCommand(
                EncounterSessionCommand.Action.UPDATE_BUILDER_INPUTS,
                Optional.empty(),
                EncounterBuilderInputsBoundaryTranslator.toInternal(effective.inputs()),
                0L,
                0L,
                0,
                0L,
                List.of(),
                "",
                0,
                0L,
                0,
                false));
        publishCurrentSession(session);
    }

    public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
        publishPlanBudget(command == null ? 0L : command.planId());
    }

    private void publishCurrentSession(@Nullable EncounterSession session) {
        sessionPublishedStateRepository.publishCurrentSession(
                session == null
                        ? EncounterStateSnapshot.empty(SESSION_NOT_REGISTERED)
                        : EncounterStateSnapshotProjector.toPublishedSnapshot(session),
                session == null
                        ? EncounterBuilderInputs.empty()
                        : EncounterStateSnapshotProjector.toPublishedBuilderInputs(session),
                loadTuningPreviewResult());
    }

    private EncounterTuningPreviewResult loadTuningPreviewResult() {
        if (loadBudgetUseCase == null) {
            return new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    EncounterBudgetBoundaryTranslator.tuningPreviewLabels(null),
                    "Encounter tuning preview service is not registered.");
        }
        try {
            LoadEncounterBudgetUseCase.Result result = loadBudgetUseCase.execute();
            EncounterBudgetSummary budget = EncounterBudgetBoundaryTranslator.toPublishedBudget(result.budget());
            return new EncounterTuningPreviewResult(
                    EncounterBudgetBoundaryTranslator.mapBudgetStatus(result.status()),
                    EncounterBudgetBoundaryTranslator.tuningPreviewLabels(budget),
                    result.message());
        } catch (RuntimeException exception) {
            return new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    EncounterBudgetBoundaryTranslator.tuningPreviewLabels(null),
                    "Encounter tuning preview could not be loaded.");
        }
    }

    private void publishSavedPlans() {
        ListSavedEncounterPlansUseCase useCase = listSavedPlansUseCase;
        if (useCase == null) {
            planPublishedStateRepository.publishSavedPlans(new SavedEncounterPlanListResult(
                    SavedEncounterPlanStatus.STORAGE_ERROR,
                    List.of(),
                    PLAN_STORAGE_NOT_REGISTERED));
            return;
        }
        ListSavedEncounterPlansUseCase.Result result = useCase.execute();
        planPublishedStateRepository.publishSavedPlans(new SavedEncounterPlanListResult(
                EncounterPlanBoundaryTranslator.toPublishedListPlansStatus(result.status()),
                result.plans().stream().map(EncounterPlanBoundaryTranslator::toPublishedSummary).toList(),
                result.message()));
    }

    private void publishPlanBudget(long planId) {
        if (loadPlanBudgetUseCase == null) {
            planPublishedStateRepository.publishPlanBudget(new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    "Encounter plan budget service is not registered."));
            return;
        }
        try {
            LoadEncounterPlanBudgetUseCase.Result result = loadPlanBudgetUseCase.execute(planId);
            planPublishedStateRepository.publishPlanBudget(new EncounterPlanBudgetResult(
                    EncounterBudgetBoundaryTranslator.toPublishedPlanBudgetStatus(result.status()),
                    EncounterBudgetBoundaryTranslator.toPublishedPlanBudget(result.summary()),
                    result.message()));
        } catch (RuntimeException exception) {
            planPublishedStateRepository.publishPlanBudget(new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    "Encounter plan budget could not be loaded."));
        }
    }
}
