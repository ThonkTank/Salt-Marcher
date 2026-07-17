package features.dungeon;

import java.util.Objects;
import features.dungeon.adapter.javafx.editor.DungeonEditorContribution;
import features.dungeon.adapter.javafx.travel.DungeonTravelContribution;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonMapRepository;
import features.dungeon.api.DungeonAuthoredMutationModel;
import features.dungeon.api.DungeonAuthoredReadModel;
import features.dungeon.api.DungeonEditorControlsModel;
import features.dungeon.api.DungeonEditorMapSurfaceModel;
import features.dungeon.api.DungeonEditorStateModel;
import features.dungeon.api.DungeonMapCatalogModel;
import features.dungeon.api.TravelDungeonModel;
import features.dungeon.api.authored.DungeonAuthoredApi;
import features.dungeon.api.editor.DungeonEditorApi;
import features.dungeon.api.travel.DungeonTravelApi;
import features.dungeon.application.authored.DungeonAuthoredApplicationService;
import features.dungeon.application.authored.DungeonAuthoredPublishedState;
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.application.editor.DungeonEditorPublishedState;
import features.dungeon.application.editor.DungeonEditorApiFacade;
import features.dungeon.application.editor.DungeonEditorFeatureRuntimeRoot;
import features.dungeon.application.editor.DungeonEditorRuntimeApplicationService;
import features.dungeon.application.editor.DungeonEditorRuntimeDependencies;
import features.dungeon.application.travel.DungeonTravelNavigator;
import features.dungeon.application.travel.DungeonTravelPartyGateway;
import features.dungeon.application.travel.DungeonTravelPublishedState;
import features.dungeon.application.travel.DungeonTravelRuntimeApplicationService;
import features.dungeon.application.travel.DungeonTravelSurfaceLoader;
import features.party.api.ActivePartyModel;
import features.party.api.PartyApi;
import features.party.api.PartyMutationModel;
import features.party.api.PartyTravelPositionsModel;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.UiDispatcher;
import shell.api.ShellContribution;

/** Dungeon feature composition entry point used by the application root. */
public final class DungeonFeature {

    private DungeonFeature() {
    }

    public static Component create(
            SqliteDatabase database,
            PartyApi party,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        PartyApi safeParty = Objects.requireNonNull(party, "party");
        ExecutionLane lane = Objects.requireNonNull(executionLane, "executionLane");
        UiDispatcher dispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        Runtime runtime = createRuntime(
                new SqliteDungeonMapRepository(Objects.requireNonNull(database, "database")),
                safeParty.activeParty(),
                safeParty.travelPositions(),
                safeParty,
                safeParty.mutation(),
                lane,
                dispatcher,
                Objects.requireNonNull(diagnostics, "diagnostics"));
        DungeonEditorRuntimeDependencies editorDependencies = new DungeonEditorRuntimeDependencies(
                new DungeonEditorRuntimeDependencies.CompatibilityReadbackModels(
                        runtime.editorControls(), runtime.editorMapSurface(), runtime.editorState()),
                runtime.editor(),
                lane,
                dispatcher);
        DungeonEditorFeatureRuntimeRoot editorRuntimeRoot =
                DungeonEditorFeatureRuntimeRoot.create(editorDependencies);
        DungeonEditorApi editorApi = new DungeonEditorApiFacade(editorRuntimeRoot, dispatcher);
        return new Component(
                new DungeonEditorContribution(editorRuntimeRoot, dispatcher),
                new DungeonTravelContribution(runtime.travel(), runtime.mapCatalog(), runtime.travelModel()),
                runtime.authored(),
                editorApi,
                runtime.travel());
    }

    static Runtime createRuntime(
            DungeonMapRepository repository,
            ActivePartyModel activeParty,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApi party,
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
        DungeonAuthoredApplicationService authoredMaps = new DungeonAuthoredApplicationService(
                Objects.requireNonNull(repository, "repository"), authoredPublishedState);
        DungeonEditorRuntimeApplicationService editor =
                new DungeonEditorRuntimeApplicationService(authoredMaps, editorPublishedState);
        DungeonTravelPartyGateway partyGateway = new DungeonTravelPartyGateway(
                activeParty, partyTravelPositions, party, partyMutation);
        DungeonTravelSurfaceLoader surfaceLoader = new DungeonTravelSurfaceLoader(authoredMaps, partyGateway);
        DungeonTravelNavigator navigator = new DungeonTravelNavigator(authoredMaps, partyGateway, surfaceLoader);
        DungeonTravelPublishedState publishedState = new DungeonTravelPublishedState(dispatcher);
        return new Runtime(
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
            ShellContribution editorContribution,
            ShellContribution travelContribution,
            DungeonAuthoredApi authoredApi,
            DungeonEditorApi editorApi,
            DungeonTravelApi travelApi
    ) {
        public Component {
            editorContribution = Objects.requireNonNull(editorContribution, "editorContribution");
            travelContribution = Objects.requireNonNull(travelContribution, "travelContribution");
            authoredApi = Objects.requireNonNull(authoredApi, "authoredApi");
            editorApi = Objects.requireNonNull(editorApi, "editorApi");
            travelApi = Objects.requireNonNull(travelApi, "travelApi");
        }
    }

    record Runtime(
            DungeonAuthoredApplicationService authored,
            DungeonEditorRuntimeApplicationService editor,
            DungeonTravelRuntimeApplicationService travel,
            DungeonAuthoredReadModel authoredRead,
            DungeonAuthoredMutationModel authoredMutation,
            DungeonMapCatalogModel mapCatalog,
            TravelDungeonModel travelModel,
            DungeonEditorControlsModel editorControls,
            DungeonEditorMapSurfaceModel editorMapSurface,
            DungeonEditorStateModel editorState
    ) {
    }
}
