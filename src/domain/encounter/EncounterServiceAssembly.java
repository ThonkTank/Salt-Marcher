package src.domain.encounter;

import org.jspecify.annotations.Nullable;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureEncounterCandidatesModel;
import src.domain.encounter.model.generation.EncounterGenerator;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCandidatesModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

public final class EncounterServiceAssembly {

    public static Component create(
            CreaturesApplicationService creatures,
            CreatureDetailModel creatureDetails,
            CreatureEncounterCandidatesModel creatureCandidates,
            EncounterTableApplicationService encounterTables,
            EncounterTableCandidatesModel tableCandidates,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            PartyApplicationService party,
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
            CreaturesApplicationService creatures,
            CreatureDetailModel creatureDetails,
            CreatureEncounterCandidatesModel creatureCandidates,
            EncounterTableApplicationService encounterTables,
            EncounterTableCandidatesModel tableCandidates,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            PartyApplicationService party,
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
            EncounterApplicationService application,
            src.domain.encounter.published.EncounterStateModel state,
            src.domain.encounter.published.EncounterBuilderInputsModel builderInputs,
            src.domain.encounter.published.EncounterTuningPreviewModel tuningPreview,
            src.domain.encounter.published.SavedEncounterPlanListModel savedPlans,
            src.domain.encounter.published.EncounterPlanBudgetModel planBudget
    ) {
    }

}
