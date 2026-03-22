package features.world.dungeonmap.bootstrap;

import features.world.dungeonmap.application.corridor.DungeonCorridorEditService;
import features.world.dungeonmap.application.corridor.DungeonCorridorPersistenceService;
import features.world.dungeonmap.application.corridor.DungeonCorridorRewriteCoordinator;
import features.world.dungeonmap.application.corridor.DungeonCorridorRoomRewriteService;
import features.world.dungeonmap.application.runtime.DungeonRuntimeStateRepairService;
import features.world.dungeonmap.application.room.DungeonClusterMoveService;
import features.world.dungeonmap.application.room.DungeonRoomEditService;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.application.room.RoomPaintTopologyPlanner;
import features.world.dungeonmap.application.room.RoomTopologyEditPlanApplier;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;
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

    public DungeonMapModule(DetailsNavigator detailsNavigator) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        DungeonMapLoader mapLoader = new DungeonMapLoader();
        DungeonCorridorWriteRepository corridorWriteRepository = new DungeonCorridorWriteRepository();
        DungeonCorridorPersistenceService corridorPersistenceService = new DungeonCorridorPersistenceService(corridorWriteRepository);
        DungeonRoomWriteRepository roomWriteRepository = new DungeonRoomWriteRepository();
        DungeonRoomGeometryWriteMapper geometryWriteMapper = new DungeonRoomGeometryWriteMapper();
        DungeonCorridorRoomRewriteService corridorRoomRewriteService = new DungeonCorridorRoomRewriteService();
        DungeonCorridorRewriteCoordinator corridorRewriteCoordinator = new DungeonCorridorRewriteCoordinator();
        DungeonRoomTopologyService roomTopologyService = new DungeonRoomTopologyService(
                mapLoader,
                roomWriteRepository,
                geometryWriteMapper,
                corridorPersistenceService,
                corridorRoomRewriteService,
                corridorRewriteCoordinator);
        DungeonMapCatalogService mapCatalogService = new DungeonMapCatalogService(
                roomTopologyService,
                new DungeonRuntimeStateRepairService(mapLoader));
        DungeonRoomEditService roomEditService = new DungeonRoomEditService(
                mapLoader,
                new RoomPaintTopologyPlanner(),
                new RoomTopologyEditPlanApplier(
                        roomWriteRepository,
                        geometryWriteMapper,
                        corridorPersistenceService,
                        corridorRoomRewriteService,
                        corridorRewriteCoordinator),
                roomTopologyService);
        DungeonClusterMoveService clusterMoveService = new DungeonClusterMoveService(
                mapLoader,
                roomWriteRepository,
                geometryWriteMapper);
        DungeonCorridorEditService corridorEditService = new DungeonCorridorEditService(corridorWriteRepository);
        DungeonMapState state = new DungeonMapState();
        DungeonMapLoadingService loadingService = new DungeonMapLoadingService(
                mapLoader,
                state);
        this.dungeonView = new DungeonRuntimeView("Dungeon", false, loadingService, state);
        this.dungeonEditorView = new DungeonEditorView(
                loadingService,
                state,
                mapCatalogService,
                roomEditService,
                clusterMoveService,
                corridorEditService);
    }

    public AppView dungeonView() {
        return dungeonView;
    }

    public AppView dungeonEditorView() {
        return dungeonEditorView;
    }
}
