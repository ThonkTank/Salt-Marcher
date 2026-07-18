package features.encounter;

import org.jspecify.annotations.Nullable;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import shell.api.ShellContribution;
import features.creatures.api.CreaturesApi;
import features.creatures.api.CreatureDetailModel;
import features.creatures.api.CreatureEncounterCandidatesModel;
import features.encounter.adapter.javafx.state.EncounterStateContribution;
import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import features.encounter.adapter.sqlite.gateway.local.SqliteEncounterRuntimeContextRepository;
import features.encounter.api.EncounterApi;
import features.encounter.api.EncounterRuntimeContextApi;
import features.encounter.application.EncounterApplicationService;
import features.encounter.application.EncounterForeignFacts;
import features.encounter.application.GeneratedEncounterBatchRepository;
import features.encounter.application.GeneratedEncounterBatchService;
import features.encounter.application.EncounterPlanGateway;
import features.encounter.application.EncounterPublishedState;
import features.encounter.application.EncounterSessionRuntimeAccess;
import features.encounter.domain.generation.EncounterGenerator;
import features.encounter.domain.plan.repository.EncounterPlanRepository;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCandidatesModel;
import features.party.api.PartyApi;
import features.party.api.ActivePartyCompositionModel;
import features.party.api.ActivePartyModel;
import features.party.api.AdventuringDaySummaryModel;
import features.party.api.PartyMutationModel;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.worldplanner.api.WorldPlannerApi;

public final class EncounterServiceAssembly {

    public static <T extends EncounterPlanRepository & GeneratedEncounterBatchRepository> Component create(
            CreaturesApi creatures,
            CreatureDetailModel creatureDetails,
            CreatureEncounterCandidatesModel creatureCandidates,
            EncounterTableApi encounterTables,
            EncounterTableCandidatesModel tableCandidates,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            PartyApi party,
            ActivePartyModel activeParty,
            ActivePartyCompositionModel activePartyComposition,
            AdventuringDaySummaryModel daySummary,
            PartyMutationModel partyMutation,
            T planRepository
    ) {
        return create(
                creatures, creatureDetails, creatureCandidates, encounterTables, tableCandidates,
                worldPlanner, party, activeParty, activePartyComposition, daySummary, partyMutation,
                planRepository, DirectExecutionLane.INSTANCE, DirectUiDispatcher.INSTANCE, NoopDiagnostics.INSTANCE);
    }

    public static Component create(
            SqliteDatabase database,
            CreaturesApi creatures,
            CreatureDetailModel creatureDetails,
            CreatureEncounterCandidatesModel creatureCandidates,
            EncounterTableApi encounterTables,
            EncounterTableCandidatesModel tableCandidates,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            PartyApi party,
            ActivePartyModel activeParty,
            ActivePartyCompositionModel activePartyComposition,
            AdventuringDaySummaryModel daySummary,
            PartyMutationModel partyMutation,
            ExecutionLane executionLane,
            ExecutionLane generatedCpuLane,
            ExecutionLane generatedIoLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        SqliteDatabase safeDatabase = java.util.Objects.requireNonNull(database, "database");
        SqliteEncounterPlanRepository planRepository = new SqliteEncounterPlanRepository(safeDatabase);
        return create(
                creatures,
                creatureDetails,
                creatureCandidates,
                encounterTables,
                tableCandidates,
                worldPlanner,
                party,
                activeParty,
                activePartyComposition,
                daySummary,
                partyMutation,
                planRepository,
                new SqliteEncounterRuntimeContextRepository(safeDatabase),
                executionLane,
                generatedCpuLane,
                generatedIoLane,
                planRepository,
                uiDispatcher,
                diagnostics);
    }

    public static Component create(
            SqliteDatabase database,
            CreaturesApi creatures,
            CreatureDetailModel creatureDetails,
            CreatureEncounterCandidatesModel creatureCandidates,
            EncounterTableApi encounterTables,
            EncounterTableCandidatesModel tableCandidates,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            PartyApi party,
            ActivePartyModel activeParty,
            ActivePartyCompositionModel activePartyComposition,
            AdventuringDaySummaryModel daySummary,
            PartyMutationModel partyMutation,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        return create(database, creatures, creatureDetails, creatureCandidates, encounterTables, tableCandidates,
                worldPlanner, party, activeParty, activePartyComposition, daySummary, partyMutation,
                executionLane, executionLane, executionLane, uiDispatcher, diagnostics);
    }

    public static <T extends EncounterPlanRepository & GeneratedEncounterBatchRepository> Component create(
            CreaturesApi creatures,
            CreatureDetailModel creatureDetails,
            CreatureEncounterCandidatesModel creatureCandidates,
            EncounterTableApi encounterTables,
            EncounterTableCandidatesModel tableCandidates,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            PartyApi party,
            ActivePartyModel activeParty,
            ActivePartyCompositionModel activePartyComposition,
            AdventuringDaySummaryModel daySummary,
            PartyMutationModel partyMutation,
            T planRepository,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        return create(
                creatures, creatureDetails, creatureCandidates, encounterTables, tableCandidates,
                worldPlanner, party, activeParty, activePartyComposition, daySummary, partyMutation,
                planRepository,
                new InMemoryRuntimeContextRepository(),
                executionLane,
                executionLane,
                executionLane,
                planRepository,
                uiDispatcher,
                diagnostics);
    }

    private static Component create(
            CreaturesApi creatures,
            CreatureDetailModel creatureDetails,
            CreatureEncounterCandidatesModel creatureCandidates,
            EncounterTableApi encounterTables,
            EncounterTableCandidatesModel tableCandidates,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            PartyApi party,
            ActivePartyModel activeParty,
            ActivePartyCompositionModel activePartyComposition,
            AdventuringDaySummaryModel daySummary,
            PartyMutationModel partyMutation,
            EncounterPlanRepository planRepository,
            features.encounter.application.EncounterRuntimeContextRepository contextRepository,
            ExecutionLane executionLane,
            ExecutionLane generatedCpuLane,
            ExecutionLane generatedIoLane,
            GeneratedEncounterBatchRepository generatedRepository,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        EncounterPublishedState publishedState = new EncounterPublishedState(
                java.util.Objects.requireNonNull(uiDispatcher, "uiDispatcher"));
        EncounterForeignFacts facts = new EncounterForeignFacts(
                creatures, creatureDetails, creatureCandidates, encounterTables, tableCandidates,
                worldPlanner, party, activeParty, activePartyComposition, daySummary, partyMutation);
        EncounterPlanGateway plans = new EncounterPlanGateway(
                planRepository, facts, java.util.Objects.requireNonNull(diagnostics, "diagnostics"));
        EncounterSessionRuntimeAccess runtime = new EncounterSessionRuntimeAccess(
                facts,
                plans,
                new EncounterGenerator(facts));
        GeneratedEncounterBatchService generatedBatches = new GeneratedEncounterBatchService(
                creatures,
                activePartyComposition,
                java.util.Objects.requireNonNull(generatedRepository, "generatedRepository"),
                java.util.Objects.requireNonNull(generatedCpuLane, "generatedCpuLane"),
                java.util.Objects.requireNonNull(generatedIoLane, "generatedIoLane"));
        EncounterApplicationService application = new EncounterApplicationService(
                runtime,
                plans,
                publishedState,
                contextRepository,
                java.util.Objects.requireNonNull(executionLane, "executionLane"),
                generatedBatches);
        return new Component(
                application,
                application.runtimeContexts(),
                publishedState.stateModel(),
                publishedState.builderInputsModel(),
                publishedState.poolFiltersModel(),
                publishedState.tuningPreviewModel(),
                publishedState.savedPlansModel(),
                publishedState.planBudgetModel());
    }

    public record Component(
            EncounterApi application,
            EncounterRuntimeContextApi runtimeContexts,
            features.encounter.api.EncounterStateModel state,
            features.encounter.api.EncounterBuilderInputsModel builderInputs,
            features.encounter.api.EncounterPoolFiltersModel poolFilters,
            features.encounter.api.EncounterTuningPreviewModel tuningPreview,
            features.encounter.api.SavedEncounterPlanListModel savedPlans,
            features.encounter.api.EncounterPlanBudgetModel planBudget
    ) {

        public ShellContribution stateContribution(
                CreaturesApi creatures,
                @Nullable WorldPlannerApi worldPlanner,
                java.util.function.LongConsumer openCreatureInspector
        ) {
            return new EncounterStateContribution(
                    creatures,
                    state,
                    application,
                    builderInputs,
                    worldPlanner,
                    openCreatureInspector);
        }
    }

    private static final class InMemoryRuntimeContextRepository
            implements features.encounter.application.EncounterRuntimeContextRepository {

        private StoredRuntimeContexts value = StoredRuntimeContexts.empty();

        @Override
        public StoredRuntimeContexts load() {
            return value;
        }

        @Override
        public void replace(StoredRuntimeContexts contexts) {
            value = contexts;
        }
    }

}
