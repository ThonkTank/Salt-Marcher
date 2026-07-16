package src.domain.dungeon;

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
        DungeonEditorPublishedState editorPublishedState = new DungeonEditorPublishedState();
        DungeonAuthoredPublishedState authoredPublishedState = new DungeonAuthoredPublishedState();
        DungeonAuthoredApplicationService authoredMaps =
                new DungeonAuthoredApplicationService(repository, authoredPublishedState);
        DungeonEditorRuntimeApplicationService editor =
                new DungeonEditorRuntimeApplicationService(authoredMaps, editorPublishedState);
        DungeonTravelPartyGateway partyGateway = new DungeonTravelPartyGateway(
                activeParty, partyTravelPositions, party, partyMutation);
        DungeonTravelSurfaceLoader surfaceLoader =
                new DungeonTravelSurfaceLoader(authoredMaps, partyGateway);
        DungeonTravelNavigator navigator =
                new DungeonTravelNavigator(authoredMaps, partyGateway, surfaceLoader);
        DungeonTravelPublishedState publishedState = new DungeonTravelPublishedState();
        return new Component(
                authoredMaps,
                editor,
                new DungeonTravelRuntimeApplicationService(surfaceLoader, navigator, publishedState),
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
