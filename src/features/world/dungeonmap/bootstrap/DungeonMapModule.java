package features.world.dungeonmap.bootstrap;

import features.world.dungeonmap.application.room.DungeonRoomEditService;
import features.world.dungeonmap.application.room.LegacyRoomTopologyBridge;
import features.world.dungeonmap.application.room.RoomPaintTopologyPlanner;
import features.world.dungeonmap.application.room.RoomTopologyEditPlanApplier;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.persistence.DungeonRoomGeometryWriteMapper;
import features.world.dungeonmap.persistence.DungeonRoomWriteRepository;
import features.world.dungeonmap.shell.editor.DungeonEditorView;
import features.world.dungeonmap.shell.runtime.DungeonRuntimeView;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.quarantine.dungeonmap.corridors.application.DungeonCorridorBindingReanchorer;
import features.world.quarantine.dungeonmap.corridors.application.DungeonCorridorRoomReconciler;
import features.world.quarantine.dungeonmap.rooms.application.DungeonRoomTopologyCoordinator;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class DungeonMapModule {

    private final AppView dungeonView;
    private final AppView dungeonEditorView;

    public DungeonMapModule(DetailsNavigator detailsNavigator) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        DungeonRoomTopologyCoordinator roomTopologySupport = new DungeonRoomTopologyCoordinator(
                new DungeonCorridorBindingReanchorer(),
                new DungeonCorridorRoomReconciler());
        DungeonMapLoader mapLoader = new DungeonMapLoader();
        DungeonMapCatalogService mapCatalogService = new DungeonMapCatalogService(
                roomTopologySupport,
                features.world.quarantine.dungeonmap.runtime.application.DungeonRuntimeStateSupport::repairStoredRuntimeState);
        DungeonRoomEditService roomEditService = new DungeonRoomEditService(
                mapLoader,
                new RoomPaintTopologyPlanner(),
                new RoomTopologyEditPlanApplier(
                        new DungeonRoomWriteRepository(),
                        new DungeonRoomGeometryWriteMapper()),
                new LegacyRoomTopologyBridge(roomTopologySupport));
        DungeonMapState state = new DungeonMapState();
        DungeonMapLoadingService loadingService = new DungeonMapLoadingService(
                mapLoader,
                state);
        this.dungeonView = new DungeonRuntimeView("Dungeon", false, loadingService, state);
        this.dungeonEditorView = new DungeonEditorView(loadingService, state, mapCatalogService, roomEditService);
    }

    public AppView dungeonView() {
        return dungeonView;
    }

    public AppView dungeonEditorView() {
        return dungeonEditorView;
    }
}
