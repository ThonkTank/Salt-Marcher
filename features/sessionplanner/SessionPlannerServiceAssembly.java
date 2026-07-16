package features.sessionplanner;

import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import org.jspecify.annotations.Nullable;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import shell.api.ShellContribution;
import features.encounter.api.EncounterApi;
import features.encounter.api.EncounterPlanBudgetModel;
import features.encounter.api.GeneratedEncounterPlanImportApi;
import features.encounter.api.GeneratedEncounterPlanImportResult;
import features.encounter.api.SavedEncounterPlanListModel;
import features.party.api.ActivePartyModel;
import features.party.api.AdventuringDayCalculationModel;
import features.party.api.PartyApi;
import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationResponse;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationStatus;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.adapter.javafx.SessionPlannerContribution;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.sessionplanner.api.SessionGenerationPreviewModel;
import features.sessionplanner.api.SessionPlannerApi;
import features.sessionplanner.api.SessionPlannerCatalogModel;
import features.sessionplanner.api.SessionPlannerCurrentSessionModel;
import features.sessionplanner.api.SessionPlannerParticipantsModel;
import features.sessionplanner.api.SessionPlannerSceneTimelineModel;
import features.sessionplanner.api.SessionPlannerStatePanelModel;
import features.sessionplanner.api.PreparedSceneCatalogModel;
import features.sessionplanner.application.SessionGenerationCoordinator;
import features.sessionplanner.application.SessionGenerationPublishedState;
import features.sessionplanner.application.SessionPlannerApplicationService;
import features.sessionplanner.application.SessionPlannerForeignFacts;
import features.sessionplanner.application.SessionPlannerProjection;
import features.sessionplanner.application.SessionPlannerPublishedState;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;
import features.worldplanner.api.WorldPlannerSnapshotModel;

public final class SessionPlannerServiceAssembly {

    private final Runtime runtime;

    public SessionPlannerServiceAssembly(
            SessionPlanRepository repository,
            PartyApi party,
            ActivePartyModel activeParty,
            AdventuringDayCalculationModel dayCalculation,
            EncounterApi encounters,
            SavedEncounterPlanListModel savedPlans,
            EncounterPlanBudgetModel planBudget,
            @Nullable WorldPlannerSnapshotModel worldPlanner
    ) {
        this(
                repository,
                party,
                activeParty,
                dayCalculation,
                encounters,
                savedPlans,
                planBudget,
                worldPlanner,
                unavailableGeneration(),
                unavailableEncounterImport(),
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    public static SessionPlannerServiceAssembly create(
            SqliteDatabase database,
            PartyApi party,
            ActivePartyModel activeParty,
            AdventuringDayCalculationModel dayCalculation,
            EncounterApi encounters,
            SavedEncounterPlanListModel savedPlans,
            EncounterPlanBudgetModel planBudget,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        return create(
                database,
                party,
                activeParty,
                dayCalculation,
                encounters,
                savedPlans,
                planBudget,
                worldPlanner,
                unavailableGeneration(),
                unavailableEncounterImport(),
                executionLane,
                uiDispatcher,
                diagnostics);
    }

    public static SessionPlannerServiceAssembly create(
            SqliteDatabase database,
            PartyApi party,
            ActivePartyModel activeParty,
            AdventuringDayCalculationModel dayCalculation,
            EncounterApi encounters,
            SavedEncounterPlanListModel savedPlans,
            EncounterPlanBudgetModel planBudget,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            SessionGenerationApi generation,
            GeneratedEncounterPlanImportApi generatedEncounterImport,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        return new SessionPlannerServiceAssembly(
                new SqliteSessionPlanRepository(Objects.requireNonNull(database, "database")),
                party,
                activeParty,
                dayCalculation,
                encounters,
                savedPlans,
                planBudget,
                worldPlanner,
                generation,
                generatedEncounterImport,
                executionLane,
                uiDispatcher,
                diagnostics);
    }

    public SessionPlannerServiceAssembly(
            SessionPlanRepository repository,
            PartyApi party,
            ActivePartyModel activeParty,
            AdventuringDayCalculationModel dayCalculation,
            EncounterApi encounters,
            SavedEncounterPlanListModel savedPlans,
            EncounterPlanBudgetModel planBudget,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        this(
                repository,
                party,
                activeParty,
                dayCalculation,
                encounters,
                savedPlans,
                planBudget,
                worldPlanner,
                unavailableGeneration(),
                unavailableEncounterImport(),
                executionLane,
                uiDispatcher,
                diagnostics);
    }

    public SessionPlannerServiceAssembly(
            SessionPlanRepository repository,
            PartyApi party,
            ActivePartyModel activeParty,
            AdventuringDayCalculationModel dayCalculation,
            EncounterApi encounters,
            SavedEncounterPlanListModel savedPlans,
            EncounterPlanBudgetModel planBudget,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            SessionGenerationApi generation,
            GeneratedEncounterPlanImportApi generatedEncounterImport,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        SessionPlanRepository safeRepository = Objects.requireNonNull(repository, "repository");
        ExecutionLane safeExecutionLane = Objects.requireNonNull(executionLane, "executionLane");
        Diagnostics safeDiagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        UiDispatcher safeUiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        SessionPlannerForeignFacts facts = new SessionPlannerForeignFacts(
                party, activeParty, dayCalculation, encounters, savedPlans, planBudget, worldPlanner);
        SessionPlannerPublishedState publishedState = new SessionPlannerPublishedState(
                safeRepository,
                facts,
                new SessionPlannerProjection(),
                safeUiDispatcher);
        SessionGenerationPublishedState generationState = new SessionGenerationPublishedState(safeUiDispatcher);
        SessionGenerationCoordinator generationCoordinator = new SessionGenerationCoordinator(
                safeRepository,
                facts,
                publishedState,
                generationState,
                Objects.requireNonNull(generation, "generation"),
                Objects.requireNonNull(generatedEncounterImport, "generatedEncounterImport"),
                safeExecutionLane,
                safeDiagnostics);
        SessionPlannerApplicationService application = new SessionPlannerApplicationService(
                safeRepository,
                facts,
                publishedState,
                generationCoordinator,
                safeExecutionLane,
                safeDiagnostics);
        facts.subscribeLocationRefresh(application::refreshForeignFacts);
        facts.subscribePartyRefresh(application::refreshPartyFacts);
        runtime = new Runtime(publishedState, generationState, application);
    }

    public SessionPlannerApi application() {
        return runtime.applicationService();
    }

    public SessionPlannerCurrentSessionModel currentSessionModel() {
        return runtime.publishedState().currentSessionModel();
    }

    public SessionPlannerCatalogModel catalogModel() {
        return runtime.publishedState().catalogModel();
    }

    public SessionPlannerParticipantsModel participantsModel() {
        return runtime.publishedState().participantsModel();
    }

    public SessionPlannerSceneTimelineModel sceneTimelineModel() {
        return runtime.publishedState().sceneTimelineModel();
    }

    public SessionPlannerStatePanelModel statePanelModel() {
        return runtime.publishedState().statePanelModel();
    }

    public SessionGenerationPreviewModel generationPreviewModel() {
        return runtime.generationState().model();
    }

    public PreparedSceneCatalogModel preparedScenes() {
        return runtime.publishedState().preparedSceneCatalogModel();
    }

    public ShellContribution contribution() {
        return new SessionPlannerContribution(
                runtime.applicationService(),
                currentSessionModel(),
                catalogModel(),
                participantsModel(),
                sceneTimelineModel(),
                statePanelModel(),
                generationPreviewModel());
    }

    private static SessionGenerationApi unavailableGeneration() {
        return new SessionGenerationApi() {
            @Override
            public java.util.concurrent.CompletionStage<GenerationResponse> generate(GenerationRequest request) {
                return CompletableFuture.completedFuture(GenerationResponse.failure(
                        GenerationStatus.CATALOG_FAILURE,
                        "Session generation is not configured."));
            }

            @Override
            public java.util.concurrent.CompletionStage<GenerationResponse> load(GenerationRunId runId) {
                return CompletableFuture.completedFuture(GenerationResponse.failure(
                        GenerationStatus.NOT_FOUND,
                        "Session generation is not configured."));
            }
        };
    }

    private static GeneratedEncounterPlanImportApi unavailableEncounterImport() {
        return command -> CompletableFuture.completedFuture(
                GeneratedEncounterPlanImportResult.invalidRequest(
                        "Generated encounter import is not configured."));
    }

    private record Runtime(
            SessionPlannerPublishedState publishedState,
            SessionGenerationPublishedState generationState,
            SessionPlannerApplicationService applicationService
    ) {
    }
}
