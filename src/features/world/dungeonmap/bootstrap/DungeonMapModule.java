package features.world.dungeonmap.bootstrap;

import features.world.api.WorldTravelSurface;
import features.world.dungeonmap.application.corridor.DungeonCorridorApplicationService;
import features.world.dungeonmap.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeonmap.application.transition.DungeonTransitionApplicationService;
import features.world.dungeonmap.application.transition.TransitionTargetCatalogApplicationService;
import features.world.dungeonmap.application.room.DungeonClusterMoveService;
import features.world.dungeonmap.application.room.DungeonRoomNarrationService;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.repository.DungeonCorridorRepository;
import features.world.dungeonmap.repository.DungeonLayoutRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonTransitionRepository;
import features.world.dungeonmap.shell.editor.DungeonEditorView;
import features.world.dungeonmap.shell.editor.RoomNarrationPane;
import features.world.dungeonmap.shell.editor.interaction.BoundaryTool;
import features.world.dungeonmap.shell.editor.interaction.ConnectionsTool;
import features.world.dungeonmap.shell.editor.interaction.EditorInteraction;
import features.world.dungeonmap.shell.editor.interaction.EditorTool;
import features.world.dungeonmap.shell.editor.interaction.PaintTool;
import features.world.dungeonmap.shell.editor.interaction.SelectionTool;
import features.world.dungeonmap.shell.editor.interaction.TransitionTool;
import features.world.dungeonmap.shell.interaction.DungeonHitCollector;
import features.world.dungeonmap.shell.runtime.DungeonRuntimeView;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.List;
import java.util.Objects;

public final class DungeonMapModule {

    private final AppView dungeonView;
    private final AppView dungeonEditorView;

    public DungeonMapModule(DetailsNavigator detailsNavigator, WorldTravelSurface travelSurface) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        DungeonLayoutRepository layoutRepository = new DungeonLayoutRepository();
        DungeonRoomRepository roomRepository = new DungeonRoomRepository();
        DungeonCorridorRepository corridorRepository = new DungeonCorridorRepository();
        DungeonTransitionRepository transitionRepository = new DungeonTransitionRepository();
        DungeonRoomNarrationService roomNarrationService = new DungeonRoomNarrationService(roomRepository);
        DungeonRoomTopologyService roomTopologyService = new DungeonRoomTopologyService(
                layoutRepository,
                roomRepository);
        DungeonTransitionApplicationService transitionApplicationService = new DungeonTransitionApplicationService(roomTopologyService, transitionRepository);
        DungeonRuntimeApplicationService runtimeApplicationService = new DungeonRuntimeApplicationService(layoutRepository);
        DungeonMapCatalogService mapCatalogService = new DungeonMapCatalogService(
                roomTopologyService,
                runtimeApplicationService);
        DungeonCorridorApplicationService corridorApplicationService = new DungeonCorridorApplicationService(layoutRepository, corridorRepository);
        DungeonClusterMoveService clusterMoveService = new DungeonClusterMoveService(
                layoutRepository,
                roomRepository);
        DungeonMapState state = new DungeonMapState();
        DungeonMapLoadingService loadingService = new DungeonMapLoadingService(
                layoutRepository,
                state);
        DungeonEditorSessionState editorSessionState = new DungeonEditorSessionState();
        EditorInteractionState editorInteractionState = new EditorInteractionState();
        RoomNarrationPane roomNarrationPane = new RoomNarrationPane(
                state,
                loadingService,
                roomNarrationService,
                editorInteractionState);
        DungeonHitCollector hitCollector = new DungeonHitCollector();
        TransitionTargetCatalogApplicationService transitionTargetCatalogApplicationService = new TransitionTargetCatalogApplicationService(transitionRepository);
        List<EditorTool> editorTools = List.of(
                new SelectionTool(
                        state,
                        loadingService,
                        clusterMoveService,
                        corridorApplicationService,
                        roomNarrationPane,
                        editorInteractionState),
                new PaintTool(
                        state,
                        loadingService,
                        editorSessionState,
                        roomTopologyService,
                        editorInteractionState),
                new BoundaryTool(
                        state,
                        loadingService,
                        editorSessionState,
                        roomTopologyService,
                        editorInteractionState),
                new ConnectionsTool(
                        state,
                        loadingService,
                        editorSessionState,
                        roomTopologyService,
                        corridorApplicationService,
                        editorInteractionState),
                new TransitionTool(
                        state,
                        loadingService,
                        editorSessionState,
                        transitionApplicationService,
                        transitionTargetCatalogApplicationService,
                        editorInteractionState));
        EditorInteraction editorInteraction = new EditorInteraction(
                state,
                editorSessionState,
                editorInteractionState,
                hitCollector,
                editorTools);
        this.dungeonView = new DungeonRuntimeView(
                "Dungeon",
                false,
                loadingService,
                state,
                runtimeApplicationService,
                detailsNavigator,
                travelSurface,
                hitCollector);
        this.dungeonEditorView = new DungeonEditorView(
                loadingService,
                state,
                mapCatalogService,
                editorSessionState,
                editorInteraction);
    }

    public AppView dungeonView() {
        return dungeonView;
    }

    public AppView dungeonEditorView() {
        return dungeonEditorView;
    }
}
