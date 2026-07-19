package features.party;

import java.util.Objects;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import shell.api.ShellContribution;
import features.party.adapter.javafx.adventuringday.AdventuringDayTopBarContribution;
import features.party.adapter.javafx.party.PartyTopBarContribution;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;
import features.party.api.PartyApi;
import features.party.application.PartyApplicationService;
import features.party.application.PartyPublishedState;
import features.party.domain.roster.repository.PartyRosterRepository;
import features.party.api.ActivePartyCompositionModel;
import features.party.api.ActivePartyModel;
import features.party.api.AdventuringDayCalculationModel;
import features.party.api.AdventuringDaySummaryModel;
import features.party.api.PartyMutationModel;
import features.party.api.PartySnapshotModel;
import features.party.api.PartyTravelPositionsModel;

public final class PartyServiceAssembly {

    private PartyServiceAssembly() {
    }

    public static Component create(PartyRosterRepository repository) {
        Component component = assemble(
                repository,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
        start(component);
        return component;
    }

    public static Component create(
            SqliteDatabase database,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        return assemble(
                new SqlitePartyRosterRepository(Objects.requireNonNull(database, "database")),
                executionLane,
                uiDispatcher,
                diagnostics);
    }

    public static Component create(
            PartyRosterRepository repository,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        Component component = assemble(repository, executionLane, uiDispatcher, diagnostics);
        start(component);
        return component;
    }

    private static Component assemble(
            PartyRosterRepository repository,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        PartyPublishedState publishedState = new PartyPublishedState(
                Objects.requireNonNull(uiDispatcher, "uiDispatcher"));
        PartySnapshotModel snapshot = publishedState.snapshotModel();
        ActivePartyModel activeParty = publishedState.activePartyModel();
        ActivePartyCompositionModel activeComposition = publishedState.activeCompositionModel();
        AdventuringDaySummaryModel daySummary = publishedState.adventuringDaySummaryModel();
        PartyTravelPositionsModel travelPositions = publishedState.travelPositionsModel();
        PartyMutationModel mutation = publishedState.mutationModel();
        AdventuringDayCalculationModel dayCalculation = publishedState.adventuringDayCalculationModel();
        PartyApplicationService application = new PartyApplicationService(
                Objects.requireNonNull(repository, "repository"),
                publishedState,
                Objects.requireNonNull(executionLane, "executionLane"),
                Objects.requireNonNull(diagnostics, "diagnostics"));
        return new Component(
                application,
                snapshot,
                activeParty,
                activeComposition,
                daySummary,
                travelPositions,
                mutation,
                dayCalculation,
                new PartyTopBarContribution(application, snapshot, daySummary, mutation),
                new AdventuringDayTopBarContribution(daySummary, dayCalculation, application));
    }

    public static void start(Component component) {
        PartyApi application = Objects.requireNonNull(component, "component").application();
        ((PartyApplicationService) application).refreshPublishedState();
    }

    public record Component(
            PartyApi application,
            PartySnapshotModel snapshot,
            ActivePartyModel activeParty,
            ActivePartyCompositionModel activeComposition,
            AdventuringDaySummaryModel adventuringDaySummary,
            PartyTravelPositionsModel travelPositions,
            PartyMutationModel mutation,
            AdventuringDayCalculationModel adventuringDayCalculation,
            ShellContribution partyTopBarContribution,
            ShellContribution adventuringDayTopBarContribution
    ) {
    }
}
