package src.domain.party;

import java.util.Objects;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import src.domain.party.model.roster.repository.PartyRosterRepository;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartyTravelPositionsModel;

public final class PartyServiceAssembly {

    private PartyServiceAssembly() {
    }

    public static Component create(PartyRosterRepository repository) {
        return create(
                repository,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    public static Component create(
            PartyRosterRepository repository,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        UiDispatcher dispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        PartySnapshotModel snapshot = new PartySnapshotModel(dispatcher);
        ActivePartyModel activeParty = new ActivePartyModel(dispatcher);
        ActivePartyCompositionModel activeComposition = new ActivePartyCompositionModel(dispatcher);
        AdventuringDaySummaryModel daySummary = new AdventuringDaySummaryModel(dispatcher);
        PartyTravelPositionsModel travelPositions = new PartyTravelPositionsModel(dispatcher);
        PartyMutationModel mutation = new PartyMutationModel(dispatcher);
        AdventuringDayCalculationModel dayCalculation = new AdventuringDayCalculationModel(dispatcher);
        PartyApplicationService application = new PartyApplicationService(
                Objects.requireNonNull(repository, "repository"),
                snapshot,
                activeParty,
                activeComposition,
                daySummary,
                travelPositions,
                mutation,
                dayCalculation,
                Objects.requireNonNull(executionLane, "executionLane"),
                Objects.requireNonNull(diagnostics, "diagnostics"));
        application.refreshPublishedState();
        return new Component(application, snapshot, activeParty, activeComposition, daySummary,
                travelPositions, mutation, dayCalculation);
    }

    public record Component(
            PartyApplicationService application,
            PartySnapshotModel snapshot,
            ActivePartyModel activeParty,
            ActivePartyCompositionModel activeComposition,
            AdventuringDaySummaryModel adventuringDaySummary,
            PartyTravelPositionsModel travelPositions,
            PartyMutationModel mutation,
            AdventuringDayCalculationModel adventuringDayCalculation
    ) {
    }
}
