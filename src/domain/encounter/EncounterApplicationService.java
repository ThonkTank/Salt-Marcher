package src.domain.encounter;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.application.ApplyEncounterSessionUseCase;
import src.domain.encounter.application.EncounterBudgetBoundaryTranslator;
import src.domain.encounter.application.EncounterBuilderInputsBoundaryTranslator;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.EncounterPlanBoundaryTranslator;
import src.domain.encounter.application.EncounterSessionRuntimeAdapter;
import src.domain.encounter.application.EncounterStateSnapshotProjector;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.application.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterPlanBudgetSummary;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;
import src.domain.encounter.reference.port.EncounterCreatureLookup;
import src.domain.encounter.reference.port.EncounterTableCandidateLookup;
import src.domain.encounter.runtime.port.EncounterPlanPublishedStateRepository;
import src.domain.encounter.runtime.port.EncounterSessionPublishedStateRepository;
import src.domain.encounter.session.entity.EncounterSession;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;
import src.domain.encounter.session.value.EncounterSessionCommand;

/**
 * Public encounter facade that owns command publication and same-context model
 * refresh for the encounter feature.
 */
public final class EncounterApplicationService {

    private static final long INITIAL_PLAN_ID = 0L;
    private static final String TUNING_PREVIEW_LOAD_FAILED = "Encounter tuning preview could not be loaded.";
    private static final String TUNING_PREVIEW_NOT_REGISTERED = "Encounter tuning preview service is not registered.";
    private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";
    private static final String PLAN_BUDGET_LOAD_FAILED = "Encounter plan budget could not be loaded.";
    private static final String PLAN_BUDGET_NOT_REGISTERED = "Encounter plan budget service is not registered.";

    private final @Nullable ApplyEncounterSessionUseCase applySessionUseCase;
    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;
    private final @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase;
    private final @Nullable LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase;
    private final EncounterSessionPublishedStateRepository sessionPublishedStateRepository;
    private final EncounterPlanPublishedStateRepository planPublishedStateRepository;

    public EncounterApplicationService(
            @Nullable EncounterPartyFactsRepository party,
            @Nullable EncounterCreatureLookup creatures,
            @Nullable EncounterTableCandidateLookup encounterTables,
            @Nullable EncounterPlanRepository encounterPlans,
            EncounterPlanPublishedStateRepository planPublishedStateRepository,
            EncounterSessionPublishedStateRepository sessionPublishedStateRepository
    ) {
        this.loadBudgetUseCase = party == null ? null : new LoadEncounterBudgetUseCase(party);
        SaveEncounterPlanUseCase savePlanUseCase = encounterPlans == null ? null : new SaveEncounterPlanUseCase(encounterPlans);
        LoadSavedEncounterPlanUseCase loadSavedPlanUseCase =
                encounterPlans == null ? null : new LoadSavedEncounterPlanUseCase(encounterPlans);
        this.listSavedPlansUseCase =
                encounterPlans == null ? null : new ListSavedEncounterPlansUseCase(encounterPlans);
        this.loadPlanBudgetUseCase = party == null || creatures == null || encounterPlans == null
                ? null
                : new LoadEncounterPlanBudgetUseCase(encounterPlans, party, creatures);
        this.applySessionUseCase = createApplySessionUseCase(
                party,
                creatures,
                encounterTables,
                savePlanUseCase,
                loadSavedPlanUseCase,
                listSavedPlansUseCase,
                loadBudgetUseCase);
        this.planPublishedStateRepository =
                Objects.requireNonNull(planPublishedStateRepository, "planPublishedStateRepository");
        this.sessionPublishedStateRepository =
                Objects.requireNonNull(sessionPublishedStateRepository, "sessionPublishedStateRepository");
        publishCurrentSession(currentSession());
        publishSavedPlans();
        publishPlanBudget(INITIAL_PLAN_ID);
    }

    public void applyState(ApplyEncounterStateCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            publishCurrentSession(null);
            return;
        }
        EncounterSession session = useCase.apply(src.domain.encounter.application.EncounterStateBoundaryTranslator.toInternalCommand(
                command));
        publishCurrentSession(session);
        if (command == null || command.action().republishesSavedPlans()) {
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
                ? new UpdateEncounterBuilderInputsCommand(src.domain.encounter.published.EncounterBuilderInputs.empty())
                : command;
        EncounterSession session = useCase.apply(EncounterSessionCommand.updateBuilderInputs(
                EncounterBuilderInputsBoundaryTranslator.toInternal(effective.inputs())));
        publishCurrentSession(session);
    }

    public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
        publishPlanBudget(command == null ? 0L : command.planId());
    }

    private void publishCurrentSession(@Nullable EncounterSession session) {
        sessionPublishedStateRepository.publishCurrentSession(
                session == null ? EncounterStateSnapshot.empty("Encounter session is not registered.")
                        : EncounterStateSnapshotProjector.toPublishedSnapshot(session),
                session == null ? EncounterBuilderInputs.empty()
                        : EncounterStateSnapshotProjector.toPublishedBuilderInputs(session),
                toTuningPreviewResult(loadBudgetResult()));
    }

    private void publishSavedPlans() {
        planPublishedStateRepository.publishSavedPlans(
                listSavedPlansUseCase == null
                        ? new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), PLAN_STORAGE_NOT_REGISTERED)
                        : toSavedPlansResult(listSavedPlansUseCase.execute()));
    }

    private void publishPlanBudget(long planId) {
        LoadEncounterPlanBudgetUseCase useCase = loadPlanBudgetUseCase;
        if (useCase == null) {
            planPublishedStateRepository.publishPlanBudget(new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    PLAN_BUDGET_NOT_REGISTERED));
            return;
        }
        try {
            planPublishedStateRepository.publishPlanBudget(toPlanBudgetResult(useCase.execute(planId)));
        } catch (IllegalStateException exception) {
            planPublishedStateRepository.publishPlanBudget(new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    PLAN_BUDGET_LOAD_FAILED));
        }
    }

    private LoadEncounterBudgetUseCase.Result loadBudgetResult() {
        if (loadBudgetUseCase == null) {
            return new LoadEncounterBudgetUseCase.Result(
                    EncounterPartyFactsRepository.Status.STORAGE_ERROR,
                    emptyBudgetSummary(),
                    TUNING_PREVIEW_NOT_REGISTERED);
        }
        try {
            return loadBudgetUseCase.execute();
        } catch (IllegalStateException exception) {
            return new LoadEncounterBudgetUseCase.Result(
                    EncounterPartyFactsRepository.Status.STORAGE_ERROR,
                    emptyBudgetSummary(),
                    TUNING_PREVIEW_LOAD_FAILED);
        }
    }

    private @Nullable EncounterSession currentSession() {
        return applySessionUseCase == null ? null : applySessionUseCase.session();
    }

    private static SavedEncounterPlanListResult toSavedPlansResult(ListSavedEncounterPlansUseCase.Result result) {
        if (result == null) {
            return new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), PLAN_STORAGE_NOT_REGISTERED);
        }
        return new SavedEncounterPlanListResult(
                result.status() == ListSavedEncounterPlansUseCase.Status.SUCCESS
                        ? SavedEncounterPlanStatus.SUCCESS
                        : SavedEncounterPlanStatus.STORAGE_ERROR,
                result.plans().stream().map(EncounterPlanBoundaryTranslator::toPublishedSummary).toList(),
                result.message());
    }

    private static EncounterPlanBudgetResult toPlanBudgetResult(LoadEncounterPlanBudgetUseCase.Result result) {
        if (result == null) {
            return new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.STORAGE_ERROR, null, PLAN_BUDGET_NOT_REGISTERED);
        }
        LoadEncounterPlanBudgetUseCase.PlanBudgetSummary summary = result.summary();
        return new EncounterPlanBudgetResult(
                EncounterPlanBudgetStatus.valueOf(result.status().name()),
                summary == null
                        ? null
                        : new EncounterPlanBudgetSummary(
                                summary.planId(),
                                summary.name(),
                                summary.generatedLabel(),
                                summary.creatureCount(),
                                summary.totalBaseXp(),
                                summary.adjustedXp(),
                                summary.xpMultiplier(),
                                summary.difficultyLabel()),
                result.message());
    }

    private static EncounterTuningPreviewResult toTuningPreviewResult(LoadEncounterBudgetUseCase.Result result) {
        if (result == null) {
            return new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    EncounterBudgetBoundaryTranslator.tuningPreviewLabels(emptyBudgetSummary()),
                    TUNING_PREVIEW_NOT_REGISTERED);
        }
        return new EncounterTuningPreviewResult(
                toEncounterGenerationStatus(result.status()),
                EncounterBudgetBoundaryTranslator.tuningPreviewLabels(
                        result.budget() == null ? emptyBudgetSummary() : result.budget()),
                result.message());
    }

    private static EncounterGenerationStatus toEncounterGenerationStatus(EncounterPartyFactsRepository.Status status) {
        if (status == null) {
            return EncounterGenerationStatus.STORAGE_ERROR;
        }
        return switch (status) {
            case SUCCESS -> EncounterGenerationStatus.SUCCESS;
            case NO_ACTIVE_PARTY -> EncounterGenerationStatus.NO_ACTIVE_PARTY;
            case STORAGE_ERROR -> EncounterGenerationStatus.STORAGE_ERROR;
        };
    }

    private static @Nullable ApplyEncounterSessionUseCase createApplySessionUseCase(
            @Nullable EncounterPartyFactsRepository party,
            @Nullable EncounterCreatureLookup creatures,
            @Nullable EncounterTableCandidateLookup encounterTables,
            @Nullable SaveEncounterPlanUseCase savePlanUseCase,
            @Nullable LoadSavedEncounterPlanUseCase loadSavedPlanUseCase,
            @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase,
            @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase
    ) {
        if (party == null || creatures == null) {
            return null;
        }
        EncounterGenerationUseCase generator = new EncounterGenerationUseCase(party, creatures, encounterTables);
        return new ApplyEncounterSessionUseCase(new EncounterSessionRuntimeAdapter(
                party,
                creatures,
                generator,
                loadBudgetUseCase,
                savePlanUseCase,
                loadSavedPlanUseCase,
                listSavedPlansUseCase));
    }

    private static EncounterDifficultyMath.BudgetSummary emptyBudgetSummary() {
        return new EncounterDifficultyMath.BudgetSummary(List.of(), 1, 0, 0, 0, 0, 0, 0, 0);
    }
}
