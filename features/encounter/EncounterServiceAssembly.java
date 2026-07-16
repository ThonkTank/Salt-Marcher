package features.encounter;

import org.jspecify.annotations.Nullable;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import shell.api.InspectorSink;
import shell.api.ShellContribution;
import features.creatures.api.CreaturesApi;
import features.creatures.api.CreatureCatalogModel;
import features.creatures.api.CreatureDetailModel;
import features.creatures.api.CreatureEncounterCandidatesModel;
import features.creatures.api.CreatureFilterOptionsModel;
import features.encounter.adapter.javafx.catalog.CatalogContribution;
import features.encounter.adapter.javafx.state.EncounterStateContribution;
import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import features.encounter.api.EncounterApi;
import features.encounter.application.EncounterApplicationService;
import features.encounter.application.EncounterForeignFacts;
import features.encounter.application.EncounterPlanGateway;
import features.encounter.application.EncounterPublishedState;
import features.encounter.application.EncounterSessionRuntimeAccess;
import features.encounter.domain.generation.EncounterGenerator;
import features.encounter.domain.plan.repository.EncounterPlanRepository;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCandidatesModel;
import features.encountertable.api.EncounterTableCatalogModel;
import features.party.api.PartyApi;
import features.party.api.ActivePartyCompositionModel;
import features.party.api.ActivePartyModel;
import features.party.api.AdventuringDaySummaryModel;
import features.party.api.PartyMutationModel;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.worldplanner.api.WorldPlannerApi;

public final class EncounterServiceAssembly {

    public static Component create(
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
            EncounterPlanRepository planRepository
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
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
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
                new SqliteEncounterPlanRepository(java.util.Objects.requireNonNull(database, "database")),
                executionLane,
                uiDispatcher,
                diagnostics);
    }

    public static Component create(
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
            ExecutionLane executionLane,
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
        EncounterApplicationService application = new EncounterApplicationService(
                runtime, plans, publishedState, java.util.Objects.requireNonNull(executionLane, "executionLane"));
        return new Component(
                application,
                publishedState.stateModel(),
                publishedState.builderInputsModel(),
                publishedState.tuningPreviewModel(),
                publishedState.savedPlansModel(),
                publishedState.planBudgetModel());
    }

    public record Component(
            EncounterApi application,
            features.encounter.api.EncounterStateModel state,
            features.encounter.api.EncounterBuilderInputsModel builderInputs,
            features.encounter.api.EncounterTuningPreviewModel tuningPreview,
            features.encounter.api.SavedEncounterPlanListModel savedPlans,
            features.encounter.api.EncounterPlanBudgetModel planBudget
    ) {

        public ShellContribution catalogContribution(
                CreaturesApi creatures,
                EncounterTableApi encounterTables,
                CreatureFilterOptionsModel filterOptions,
                CreatureCatalogModel catalog,
                CreatureDetailModel detail,
                EncounterTableCatalogModel encounterTableCatalog,
                @Nullable WorldPlannerSnapshotModel worldPlanner,
                InspectorSink inspector
        ) {
            return new CatalogContribution(
                    creatures,
                    encounterTables,
                    application,
                    builderInputs,
                    filterOptions,
                    catalog,
                    detail,
                    encounterTableCatalog,
                    tuningPreview,
                    worldPlanner,
                    inspector);
        }

        public ShellContribution stateContribution(
                CreatureDetailModel detail,
                CreaturesApi creatures,
                @Nullable WorldPlannerApi worldPlanner,
                InspectorSink inspector
        ) {
            return new EncounterStateContribution(
                    detail,
                    creatures,
                    state,
                    application,
                    worldPlanner,
                    inspector);
        }
    }

}
