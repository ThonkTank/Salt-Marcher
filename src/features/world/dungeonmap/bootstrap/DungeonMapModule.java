package features.world.dungeonmap.bootstrap;

import features.world.api.WorldTravelSurface;
import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationService;
import features.world.dungeonmap.application.runtime.DungeonRuntimeStateRepairService;
import features.world.dungeonmap.application.transition.DungeonTransitionEditService;
import features.world.dungeonmap.application.transition.DungeonTransitionTargetCatalogService;
import features.world.dungeonmap.application.room.DungeonClusterMoveProjectionApplicationService;
import features.world.dungeonmap.application.room.DungeonClusterMoveService;
import features.world.dungeonmap.application.room.DungeonBoundaryEditService;
import features.world.dungeonmap.application.room.DungeonRoomNarrationService;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.application.traversal.DungeonTraversalApplicationService;
import features.world.dungeonmap.application.traversal.DungeonTraversalStructureCommitter;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;
import features.world.dungeonmap.persistence.DungeonStairWriteRepository;
import features.world.dungeonmap.persistence.DungeonTransitionWriteRepository;
import features.world.dungeonmap.persistence.DungeonTraversalWriteRepository;
import features.world.dungeonmap.persistence.DungeonRoomGeometryWriteMapper;
import features.world.dungeonmap.persistence.DungeonRoomWriteRepository;
import features.world.dungeonmap.shell.editor.DungeonEditorView;
import features.world.dungeonmap.shell.editor.interaction.BoundaryTool;
import features.world.dungeonmap.shell.editor.interaction.DungeonGridHitTester;
import features.world.dungeonmap.shell.editor.interaction.EditorInteraction;
import features.world.dungeonmap.shell.editor.interaction.EditorTool;
import features.world.dungeonmap.shell.editor.interaction.PaintTool;
import features.world.dungeonmap.shell.editor.interaction.SelectionTool;
import features.world.dungeonmap.shell.editor.interaction.TransitionTool;
import features.world.dungeonmap.shell.editor.interaction.TraversalTool;
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
        DungeonMapLoader mapLoader = new DungeonMapLoader();
        DungeonCorridorWriteRepository corridorWriteRepository = new DungeonCorridorWriteRepository();
        DungeonStairWriteRepository stairWriteRepository = new DungeonStairWriteRepository();
        DungeonTraversalWriteRepository traversalWriteRepository = new DungeonTraversalWriteRepository();
        DungeonTraversalStructureCommitter traversalStructureCommitter = new DungeonTraversalStructureCommitter(
                traversalWriteRepository,
                corridorWriteRepository,
                stairWriteRepository);
        DungeonTraversalApplicationService traversalApplicationService = new DungeonTraversalApplicationService(
                traversalWriteRepository,
                traversalStructureCommitter);
        DungeonRoomWriteRepository roomWriteRepository = new DungeonRoomWriteRepository();
        DungeonTransitionWriteRepository transitionWriteRepository = new DungeonTransitionWriteRepository();
        DungeonRoomNarrationService roomNarrationService = new DungeonRoomNarrationService(roomWriteRepository);
        DungeonRoomGeometryWriteMapper geometryWriteMapper = new DungeonRoomGeometryWriteMapper();
        DungeonRoomTopologyService roomTopologyService = new DungeonRoomTopologyService(
                mapLoader,
                roomWriteRepository,
                geometryWriteMapper,
                traversalApplicationService);
        DungeonTransitionEditService transitionEditService = new DungeonTransitionEditService(roomTopologyService, transitionWriteRepository);
        DungeonMapCatalogService mapCatalogService = new DungeonMapCatalogService(
                roomTopologyService,
                new DungeonRuntimeStateRepairService(mapLoader));
        DungeonBoundaryEditService boundaryEditService = new DungeonBoundaryEditService(roomTopologyService);
        DungeonClusterMoveProjectionApplicationService clusterMoveProjectionApplicationService =
                new DungeonClusterMoveProjectionApplicationService(traversalApplicationService);
        DungeonClusterMoveService clusterMoveService = new DungeonClusterMoveService(
                mapLoader,
                roomWriteRepository,
                geometryWriteMapper,
                traversalApplicationService,
                clusterMoveProjectionApplicationService);
        DungeonMapState state = new DungeonMapState();
        DungeonMapLoadingService loadingService = new DungeonMapLoadingService(
                mapLoader,
                state);
        DungeonEditorSessionState editorSessionState = new DungeonEditorSessionState();
        EditorInteractionState editorInteractionState = new EditorInteractionState();
        DungeonTransitionTargetCatalogService transitionTargetCatalogService = new DungeonTransitionTargetCatalogService();
        List<EditorTool> editorTools = List.of(
                new SelectionTool(
                        state,
                        loadingService,
                        clusterMoveService,
                        clusterMoveProjectionApplicationService,
                        roomNarrationService,
                        new DungeonGridHitTester(),
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
                        boundaryEditService,
                        editorInteractionState),
                new TraversalTool(
                        state,
                        loadingService,
                        editorSessionState,
                        traversalApplicationService,
                        editorInteractionState),
                new TransitionTool(
                        state,
                        loadingService,
                        editorSessionState,
                        transitionEditService,
                        transitionTargetCatalogService,
                        editorInteractionState));
        EditorInteraction editorInteraction = new EditorInteraction(
                state,
                editorSessionState,
                editorInteractionState,
                editorTools);
        this.dungeonView = new DungeonRuntimeView(
                "Dungeon",
                false,
                loadingService,
                state,
                new DungeonRuntimeNavigationService(),
                detailsNavigator,
                travelSurface);
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
