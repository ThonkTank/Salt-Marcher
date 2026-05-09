package src.domain.encounter;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.application.ApplyEncounterSessionUseCase;
import src.domain.encounter.application.EncounterBudgetBoundaryTranslator;
import src.domain.encounter.application.EncounterBuilderInputsBoundaryTranslator;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.EncounterPlanBoundaryTranslator;
import src.domain.encounter.model.session.repository.EncounterSessionRepository;
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
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;
import src.domain.encounter.reference.port.EncounterCreatureLookup;
import src.domain.encounter.reference.port.EncounterTableCandidateLookup;
import src.domain.encounter.runtime.port.EncounterPlanPublishedStateRepository;
import src.domain.encounter.model.session.repository.EncounterSessionPublishedStateRepository;
import src.domain.encounter.model.session.model.EncounterSession;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;
import src.domain.encounter.model.session.model.EncounterSessionCommand;

/**
 * Public encounter facade that owns command publication and same-context model
 * refresh for the encounter feature.
 */
public final class EncounterApplicationService {

    private static final long INITIAL_PLAN_ID = 0L;

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
        this.loadPlanBudgetUseCase = EncounterUseCaseFactory.createPlanBudgetUseCase(
                party,
                creatures,
                encounterPlans);
        this.applySessionUseCase = EncounterUseCaseFactory.createApplySessionUseCase(
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
        PublishedStateWriter.publishCurrentSession(
                sessionPublishedStateRepository,
                currentSession(),
                loadBudgetUseCase);
        PublishedStateWriter.publishSavedPlans(
                planPublishedStateRepository,
                listSavedPlansUseCase);
        PublishedStateWriter.publishPlanBudget(
                planPublishedStateRepository,
                loadPlanBudgetUseCase,
                INITIAL_PLAN_ID);
    }

    public void applyState(ApplyEncounterStateCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            PublishedStateWriter.publishCurrentSession(
                    sessionPublishedStateRepository,
                    null,
                    loadBudgetUseCase);
            return;
        }
        EncounterSession session = useCase.apply(src.domain.encounter.application.EncounterStateBoundaryTranslator.toInternalCommand(
                command));
        PublishedStateWriter.publishCurrentSession(
                sessionPublishedStateRepository,
                session,
                loadBudgetUseCase);
        if (command == null || command.action().republishesSavedPlans()) {
            PublishedStateWriter.publishSavedPlans(
                    planPublishedStateRepository,
                    listSavedPlansUseCase);
        }
    }

    public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            PublishedStateWriter.publishCurrentSession(
                    sessionPublishedStateRepository,
                    null,
                    loadBudgetUseCase);
            return;
        }
        UpdateEncounterBuilderInputsCommand effective = command == null
                ? new UpdateEncounterBuilderInputsCommand(src.domain.encounter.published.EncounterBuilderInputs.empty())
                : command;
        EncounterSession session = useCase.apply(EncounterSessionCommand.updateBuilderInputs(
                EncounterBuilderInputsBoundaryTranslator.toInternal(effective.inputs())));
        PublishedStateWriter.publishCurrentSession(
                sessionPublishedStateRepository,
                session,
                loadBudgetUseCase);
    }

    public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
        PublishedStateWriter.publishPlanBudget(
                planPublishedStateRepository,
                loadPlanBudgetUseCase,
                command == null ? 0L : command.planId());
    }

    private @Nullable EncounterSession currentSession() {
        return applySessionUseCase == null ? null : applySessionUseCase.session();
    }

    private static final class EncounterUseCaseFactory {

        private static @Nullable LoadEncounterPlanBudgetUseCase createPlanBudgetUseCase(
                @Nullable EncounterPartyFactsRepository party,
                @Nullable EncounterCreatureLookup creatures,
                @Nullable EncounterPlanRepository encounterPlans
        ) {
            return party == null || creatures == null || encounterPlans == null
                    ? null
                    : new LoadEncounterPlanBudgetUseCase(encounterPlans, party, creatures);
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
            return new ApplyEncounterSessionUseCase(new EncounterSessionRepository(
                    party,
                    creatures,
                    generator,
                    loadBudgetUseCase,
                    savePlanUseCase,
                    loadSavedPlanUseCase,
                    listSavedPlansUseCase));
        }
    }

    private static final class PublishedStateWriter {

        private static final String TUNING_PREVIEW_LOAD_FAILED = "Encounter tuning preview could not be loaded.";
        private static final String TUNING_PREVIEW_NOT_REGISTERED = "Encounter tuning preview service is not registered.";
        private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";
        private static final String PLAN_BUDGET_LOAD_FAILED = "Encounter plan budget could not be loaded.";
        private static final String PLAN_BUDGET_NOT_REGISTERED = "Encounter plan budget service is not registered.";

        private static void publishCurrentSession(
                EncounterSessionPublishedStateRepository repository,
                @Nullable EncounterSession session,
                @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase
        ) {
            repository.publishCurrentSession(
                    session == null ? src.domain.encounter.published.EncounterStateSnapshot.empty("Encounter session is not registered.")
                            : EncounterStateSnapshotProjector.toPublishedSnapshot(session),
                    session == null ? EncounterBuilderInputs.empty()
                            : EncounterStateSnapshotProjector.toPublishedBuilderInputs(session),
                    toTuningPreviewResult(loadBudgetResult(loadBudgetUseCase)));
        }

        private static void publishSavedPlans(
                EncounterPlanPublishedStateRepository repository,
                @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase
        ) {
            repository.publishSavedPlans(
                    listSavedPlansUseCase == null
                            ? new src.domain.encounter.published.SavedEncounterPlanListResult(
                                    src.domain.encounter.published.SavedEncounterPlanStatus.storageErrorStatus(),
                                    List.of(),
                                    PLAN_STORAGE_NOT_REGISTERED)
                            : toSavedPlansResult(listSavedPlansUseCase.execute()));
        }

        private static void publishPlanBudget(
                EncounterPlanPublishedStateRepository repository,
                @Nullable LoadEncounterPlanBudgetUseCase useCase,
                long planId
        ) {
            if (useCase == null) {
                repository.publishPlanBudget(new src.domain.encounter.published.EncounterPlanBudgetResult(
                        src.domain.encounter.published.EncounterPlanBudgetStatus.STORAGE_ERROR,
                        null,
                        PLAN_BUDGET_NOT_REGISTERED));
                return;
            }
            try {
                repository.publishPlanBudget(toPlanBudgetResult(useCase.execute(planId)));
            } catch (IllegalStateException exception) {
                repository.publishPlanBudget(new src.domain.encounter.published.EncounterPlanBudgetResult(
                        src.domain.encounter.published.EncounterPlanBudgetStatus.STORAGE_ERROR,
                        null,
                        PLAN_BUDGET_LOAD_FAILED));
            }
        }

        private static LoadEncounterBudgetUseCase.Result loadBudgetResult(
                @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase
        ) {
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

        private static src.domain.encounter.published.SavedEncounterPlanListResult toSavedPlansResult(
                ListSavedEncounterPlansUseCase.Result result
        ) {
            if (result == null) {
                return new src.domain.encounter.published.SavedEncounterPlanListResult(
                        src.domain.encounter.published.SavedEncounterPlanStatus.STORAGE_ERROR,
                        List.of(),
                        PLAN_STORAGE_NOT_REGISTERED);
            }
            return new src.domain.encounter.published.SavedEncounterPlanListResult(
                    result.status().loadedSuccessfully()
                            ? src.domain.encounter.published.SavedEncounterPlanStatus.successStatus()
                            : src.domain.encounter.published.SavedEncounterPlanStatus.storageErrorStatus(),
                    result.plans().stream().map(EncounterPlanBoundaryTranslator::toPublishedSummary).toList(),
                    result.message());
        }

        private static src.domain.encounter.published.EncounterPlanBudgetResult toPlanBudgetResult(
                LoadEncounterPlanBudgetUseCase.Result result
        ) {
            if (result == null) {
                return new src.domain.encounter.published.EncounterPlanBudgetResult(
                        src.domain.encounter.published.EncounterPlanBudgetStatus.STORAGE_ERROR,
                        null,
                        PLAN_BUDGET_NOT_REGISTERED);
            }
            LoadEncounterPlanBudgetUseCase.PlanBudgetSummary summary = result.summary();
            return new src.domain.encounter.published.EncounterPlanBudgetResult(
                    src.domain.encounter.published.EncounterPlanBudgetStatus.valueOf(result.status().name()),
                    summary == null
                            ? null
                            : new src.domain.encounter.published.EncounterPlanBudgetSummary(
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

        private static src.domain.encounter.published.EncounterTuningPreviewResult toTuningPreviewResult(
                LoadEncounterBudgetUseCase.Result result
        ) {
            if (result == null) {
                return new src.domain.encounter.published.EncounterTuningPreviewResult(
                        src.domain.encounter.published.EncounterGenerationStatus.STORAGE_ERROR,
                        EncounterBudgetBoundaryTranslator.tuningPreviewLabels(emptyBudgetSummary()),
                        TUNING_PREVIEW_NOT_REGISTERED);
            }
            return new src.domain.encounter.published.EncounterTuningPreviewResult(
                    toEncounterGenerationStatus(result.status()),
                    EncounterBudgetBoundaryTranslator.tuningPreviewLabels(
                            result.budget() == null ? emptyBudgetSummary() : result.budget()),
                    result.message());
        }

        private static src.domain.encounter.published.EncounterGenerationStatus toEncounterGenerationStatus(
                EncounterPartyFactsRepository.Status status
        ) {
            if (status == null) {
                return src.domain.encounter.published.EncounterGenerationStatus.STORAGE_ERROR;
            }
            return switch (status) {
                case SUCCESS -> src.domain.encounter.published.EncounterGenerationStatus.successStatus();
                case NO_ACTIVE_PARTY -> src.domain.encounter.published.EncounterGenerationStatus.noActivePartyStatus();
                case STORAGE_ERROR -> src.domain.encounter.published.EncounterGenerationStatus.defaultFailure();
            };
        }

        private static EncounterDifficultyMath.BudgetSummary emptyBudgetSummary() {
            return new EncounterDifficultyMath.BudgetSummary(List.of(), 1, 0, 0, 0, 0, 0, 0, 0);
        }
    }
}
