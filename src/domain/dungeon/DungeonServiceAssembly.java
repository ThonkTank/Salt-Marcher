package src.domain.dungeon;

import java.util.Objects;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyTravelPositionsModel;

public final class DungeonServiceAssembly {
    public static Component create(
            DungeonMapRepository repository,
            ActivePartyModel activeParty,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApplicationService party,
            PartyMutationModel partyMutation
    ) {
        return create(
                repository,
                activeParty,
                partyTravelPositions,
                party,
                partyMutation,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    public static Component create(
            DungeonMapRepository repository,
            ActivePartyModel activeParty,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApplicationService party,
            PartyMutationModel partyMutation,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        ExecutionLane lane = Objects.requireNonNull(executionLane, "executionLane");
        UiDispatcher dispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        Objects.requireNonNull(diagnostics, "diagnostics");
        DungeonEditorPublishedState editorPublishedState = new DungeonEditorPublishedState(dispatcher);
        DungeonAuthoredPublishedState authoredPublishedState = new DungeonAuthoredPublishedState(dispatcher);
        DungeonAuthoredApplicationService authoredMaps =
                new DungeonAuthoredApplicationService(
                        Objects.requireNonNull(repository, "repository"), authoredPublishedState);
        DungeonEditorRuntimeApplicationService editor =
                new DungeonEditorRuntimeApplicationService(authoredMaps, editorPublishedState);
        DungeonTravelPartyGateway partyGateway = new DungeonTravelPartyGateway(
                activeParty, partyTravelPositions, party, partyMutation);
        DungeonTravelSurfaceLoader surfaceLoader =
                new DungeonTravelSurfaceLoader(authoredMaps, partyGateway);
        DungeonTravelNavigator navigator =
                new DungeonTravelNavigator(authoredMaps, partyGateway, surfaceLoader);
        DungeonTravelPublishedState publishedState = new DungeonTravelPublishedState(dispatcher);
        return new Component(
                authoredMaps,
                editor,
                new DungeonTravelRuntimeApplicationService(surfaceLoader, navigator, publishedState, lane),
                authoredPublishedState.authoredReadModel(),
                authoredPublishedState.authoredMutationModel(),
                authoredPublishedState.mapCatalogModel(),
                publishedState.travelModel(),
                editorPublishedState.controlsModel(),
                editorPublishedState.mapSurfaceModel(),
                editorPublishedState.stateModel());
    }

    public record Component(
            DungeonAuthoredApplicationService authored,
            DungeonEditorRuntimeApplicationService editor,
            DungeonTravelRuntimeApplicationService travel,
            src.domain.dungeon.published.DungeonAuthoredReadModel authoredRead,
            src.domain.dungeon.published.DungeonAuthoredMutationModel authoredMutation,
            src.domain.dungeon.published.DungeonMapCatalogModel mapCatalog,
            TravelDungeonModel travelModel,
            src.domain.dungeon.published.DungeonEditorControlsModel editorControls,
            src.domain.dungeon.published.DungeonEditorMapSurfaceModel editorMapSurface,
            src.domain.dungeon.published.DungeonEditorStateModel editorState
    ) {
    }
}
