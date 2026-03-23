package features.world.dungeonmap.bootstrap;

import features.world.api.WorldTravelSurface;
import features.world.dungeonmap.application.corridor.DungeonCorridorEditService;
import features.world.dungeonmap.application.corridor.DungeonCorridorPersistenceService;
import features.world.dungeonmap.application.corridor.DungeonCorridorRoomRewriteService;
import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationService;
import features.world.dungeonmap.application.runtime.DungeonRuntimeStateRepairService;
import features.world.dungeonmap.application.stair.DungeonStairEditService;
import features.world.dungeonmap.application.transition.DungeonTransitionEditService;
import features.world.dungeonmap.application.room.DungeonClusterMoveService;
import features.world.dungeonmap.application.room.DungeonBoundaryEditService;
import features.world.dungeonmap.application.room.DungeonRoomNarrationService;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;
import features.world.dungeonmap.persistence.DungeonStairWriteRepository;
import features.world.dungeonmap.persistence.DungeonTransitionWriteRepository;
import features.world.dungeonmap.persistence.DungeonRoomGeometryWriteMapper;
import features.world.dungeonmap.persistence.DungeonRoomWriteRepository;
import features.world.dungeonmap.shell.editor.DungeonEditorView;
import features.world.dungeonmap.shell.runtime.DungeonRuntimeView;
import features.world.dungeonmap.state.DungeonMapState;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class DungeonMapModule {

    private final AppView dungeonView;
    private final AppView dungeonEditorView;

    public DungeonMapModule(DetailsNavigator detailsNavigator, WorldTravelSurface travelSurface) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        DungeonMapLoader mapLoader = new DungeonMapLoader();
        DungeonCorridorWriteRepository corridorWriteRepository = new DungeonCorridorWriteRepository();
        DungeonCorridorPersistenceService corridorPersistenceService = new DungeonCorridorPersistenceService(corridorWriteRepository);
        DungeonRoomWriteRepository roomWriteRepository = new DungeonRoomWriteRepository();
        DungeonStairWriteRepository stairWriteRepository = new DungeonStairWriteRepository();
        DungeonTransitionWriteRepository transitionWriteRepository = new DungeonTransitionWriteRepository();
        DungeonRoomNarrationService roomNarrationService = new DungeonRoomNarrationService(roomWriteRepository);
        DungeonRoomGeometryWriteMapper geometryWriteMapper = new DungeonRoomGeometryWriteMapper();
        DungeonCorridorRoomRewriteService corridorRoomRewriteService = new DungeonCorridorRoomRewriteService();
        DungeonRoomTopologyService roomTopologyService = new DungeonRoomTopologyService(
                mapLoader,
                roomWriteRepository,
                geometryWriteMapper,
                corridorPersistenceService,
                corridorRoomRewriteService);
        DungeonStairEditService stairEditService = new DungeonStairEditService(roomTopologyService, stairWriteRepository);
        DungeonTransitionEditService transitionEditService = new DungeonTransitionEditService(roomTopologyService, transitionWriteRepository);
        DungeonMapCatalogService mapCatalogService = new DungeonMapCatalogService(
                roomTopologyService,
                new DungeonRuntimeStateRepairService(mapLoader));
        DungeonBoundaryEditService boundaryEditService = new DungeonBoundaryEditService(roomTopologyService);
        DungeonClusterMoveService clusterMoveService = new DungeonClusterMoveService(
                mapLoader,
                roomWriteRepository,
                geometryWriteMapper);
        DungeonCorridorEditService corridorEditService = new DungeonCorridorEditService(corridorWriteRepository, corridorPersistenceService);
        DungeonMapState state = new DungeonMapState();
        DungeonMapLoadingService loadingService = new DungeonMapLoadingService(
                mapLoader,
                state);
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
                roomTopologyService,
                boundaryEditService,
                roomNarrationService,
                clusterMoveService,
                corridorEditService,
                stairEditService,
                transitionEditService);
    }

    public AppView dungeonView() {
        return dungeonView;
    }

    public AppView dungeonEditorView() {
        return dungeonEditorView;
    }
}
