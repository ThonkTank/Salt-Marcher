package features.dungeon;

import java.util.Objects;
import features.dungeon.adapter.javafx.editor.DungeonEditorContribution;
import features.dungeon.adapter.javafx.travel.DungeonTravelContribution;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonCatalogStore;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonIdentityAllocator;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonUnitOfWork;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonWindowStore;
import features.dungeon.api.DungeonAuthoredMutationModel;
import features.dungeon.api.DungeonAuthoredReadModel;
import features.dungeon.api.DungeonEditorControlsModel;
import features.dungeon.api.DungeonTravelContextModel;
import features.dungeon.api.DungeonEditorMapSurfaceModel;
import features.dungeon.api.DungeonEditorStateModel;
import features.dungeon.api.DungeonMapCatalogModel;
import features.dungeon.api.TravelDungeonModel;
import features.dungeon.api.authored.DungeonAuthoredApi;
import features.dungeon.api.editor.DungeonEditorApi;
import features.dungeon.api.travel.DungeonTravelApi;
import features.dungeon.application.authored.DungeonAuthoredApplicationService;
import features.dungeon.application.authored.DungeonCachedWindowStore;
import features.dungeon.application.authored.DungeonAuthoredPublishedState;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonIdentityAllocator;
import features.dungeon.application.authored.port.DungeonUnitOfWork;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.application.editor.DungeonEditorPublishedState;
import features.dungeon.application.editor.DungeonEditorApiFacade;
import features.dungeon.application.editor.DungeonEditorFeatureRuntimeRoot;
import features.dungeon.application.editor.DungeonEditorRuntimeApplicationService;
import features.dungeon.application.editor.DungeonEditorRuntimeDependencies;
import features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy;
import features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy;
import features.dungeon.application.travel.DungeonTravelNavigator;
import features.dungeon.application.travel.DungeonTravelAuthoredReader;
import features.dungeon.application.travel.DungeonTravelPartyGateway;
import features.dungeon.application.travel.DungeonTravelPublishedState;
import features.dungeon.application.travel.DungeonTravelRuntimeApplicationService;
import features.dungeon.application.travel.DungeonTravelSurfaceLoader;
import features.party.api.ActivePartyModel;
import features.party.api.PartyApi;
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
        SqliteDungeonCatalogStore catalogStore =
                new SqliteDungeonCatalogStore(Objects.requireNonNull(database, "database"));
        DungeonCachedWindowStore windowStore = new DungeonCachedWindowStore(
                new SqliteDungeonWindowStore(database));
        SqliteDungeonUnitOfWork unitOfWork = new SqliteDungeonUnitOfWork(database);
        SqliteDungeonIdentityAllocator identityAllocator = new SqliteDungeonIdentityAllocator(database);
        Runtime runtime = createRuntime(
                catalogStore,
                windowStore,
                unitOfWork,
                identityAllocator,
                safeParty.activeParty(),
                safeParty.travelPositions(),
                safeParty,
                lane,
                dispatcher,
                Objects.requireNonNull(diagnostics, "diagnostics"));
        DungeonEditorRuntimeDependencies editorDependencies = new DungeonEditorRuntimeDependencies(
                runtime.editorControls(), runtime.editorMapSurface(), runtime.editorState(),
                runtime.editor(),
                runtime.corridorRoutingPolicy(),
                runtime.authored()::currentWindowRequestGeneration,
                lane,
                dispatcher);
        DungeonEditorFeatureRuntimeRoot editorRuntimeRoot =
                DungeonEditorFeatureRuntimeRoot.createUnstarted(editorDependencies);
        DungeonEditorApi editorApi = new DungeonEditorApiFacade(editorRuntimeRoot, dispatcher);
        return new Component(
                new DungeonEditorContribution(editorApi),
                new DungeonTravelContribution(runtime.travel(), runtime.mapCatalog(), runtime.travelModel()),
                runtime.authored(),
                editorApi,
                runtime.travel(),
                runtime.travelContextModel());
    }

    static Runtime createRuntime(
            DungeonCatalogStore catalogStore,
            DungeonWindowStore windowStore,
            DungeonUnitOfWork unitOfWork,
            DungeonIdentityAllocator identityAllocator,
            ActivePartyModel activeParty,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApi party,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        ExecutionLane lane = Objects.requireNonNull(executionLane, "executionLane");
        UiDispatcher dispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        Objects.requireNonNull(diagnostics, "diagnostics");
        DungeonEditorPublishedState editorPublishedState = new DungeonEditorPublishedState(dispatcher);
        DungeonAuthoredPublishedState authoredPublishedState = new DungeonAuthoredPublishedState(dispatcher);
        CorridorRoutingPolicy corridorRoutingPolicy = new OrthogonalCorridorRoutingPolicy();
        DungeonAuthoredApplicationService authoredMaps = new DungeonAuthoredApplicationService(
                Objects.requireNonNull(catalogStore, "catalogStore"),
                Objects.requireNonNull(windowStore, "windowStore"),
                Objects.requireNonNull(unitOfWork, "unitOfWork"),
                Objects.requireNonNull(identityAllocator, "identityAllocator"),
                lane,
                authoredPublishedState,
                corridorRoutingPolicy);
        DungeonEditorRuntimeApplicationService editor =
                new DungeonEditorRuntimeApplicationService(authoredMaps, editorPublishedState);
        DungeonTravelPartyGateway partyGateway = new DungeonTravelPartyGateway(
                activeParty, partyTravelPositions, party);
        DungeonTravelAuthoredReader travelReader = new DungeonTravelAuthoredReader(catalogStore, windowStore);
        DungeonTravelSurfaceLoader surfaceLoader = new DungeonTravelSurfaceLoader(travelReader, partyGateway);
        DungeonTravelNavigator navigator = new DungeonTravelNavigator(travelReader, partyGateway, surfaceLoader);
        DungeonTravelPublishedState publishedState = new DungeonTravelPublishedState(dispatcher);
        return new Runtime(
                corridorRoutingPolicy,
                authoredMaps,
                editor,
                new DungeonTravelRuntimeApplicationService(surfaceLoader, navigator, publishedState, lane),
                authoredPublishedState.authoredReadModel(),
                authoredPublishedState.authoredMutationModel(),
                authoredPublishedState.mapCatalogModel(),
                publishedState.travelModel(),
                publishedState.travelContextModel(),
                editorPublishedState.controlsModel(),
                editorPublishedState.mapSurfaceModel(),
                editorPublishedState.stateModel());
    }

    public record Component(
            ShellContribution editorContribution,
            ShellContribution travelContribution,
            DungeonAuthoredApi authoredApi,
            DungeonEditorApi editorApi,
            DungeonTravelApi travelApi,
            DungeonTravelContextModel travelContext
    ) {
        public Component {
            editorContribution = Objects.requireNonNull(editorContribution, "editorContribution");
            travelContribution = Objects.requireNonNull(travelContribution, "travelContribution");
            authoredApi = Objects.requireNonNull(authoredApi, "authoredApi");
            editorApi = Objects.requireNonNull(editorApi, "editorApi");
            travelApi = Objects.requireNonNull(travelApi, "travelApi");
            travelContext = Objects.requireNonNull(travelContext, "travelContext");
        }

        public void start() {
            ((DungeonEditorApiFacade) editorApi).initialize();
        }
    }

    record Runtime(
            CorridorRoutingPolicy corridorRoutingPolicy,
            DungeonAuthoredApplicationService authored,
            DungeonEditorRuntimeApplicationService editor,
            DungeonTravelRuntimeApplicationService travel,
            DungeonAuthoredReadModel authoredRead,
            DungeonAuthoredMutationModel authoredMutation,
            DungeonMapCatalogModel mapCatalog,
            TravelDungeonModel travelModel,
            DungeonTravelContextModel travelContextModel,
            DungeonEditorControlsModel editorControls,
            DungeonEditorMapSurfaceModel editorMapSurface,
            DungeonEditorStateModel editorState
    ) {
    }
}
