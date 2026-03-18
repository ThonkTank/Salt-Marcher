package features.world.dungeonmap.api;

import database.DatabaseManager;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.foundation.db.DungeonConnectionFactory;
import features.world.dungeonmap.editor.application.DungeonEditorService;
import features.world.dungeonmap.runtime.navigation.application.DungeonRuntimeService;
import features.world.dungeonmap.runtime.loading.application.DungeonRuntimeWorkflow;
import features.world.dungeonmap.runtime.loading.ui.DungeonRuntimeUiAsyncRunner;
import features.world.dungeonmap.corridors.application.DungeonCorridorBindingReanchorer;
import features.world.dungeonmap.corridors.application.DungeonCorridorCommandService;
import features.world.dungeonmap.corridors.application.DungeonCorridorDetailEditService;
import features.world.dungeonmap.corridors.application.DungeonCorridorRoomReconciler;
import features.world.dungeonmap.rooms.application.DungeonRoomTopologyCoordinator;
import features.world.dungeonmap.editor.shell.ui.DungeonEditorView;
import features.world.dungeonmap.runtime.presentation.ui.DungeonView;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class DungeonMapModule {

    private final AppView dungeonView;
    private final AppView dungeonEditorView;

    public DungeonMapModule(DetailsNavigator detailsNavigator) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        DungeonConnectionFactory connectionFactory = DatabaseManager::getConnection;
        DungeonCorridorBindingReanchorer corridorBindingReanchorer = new DungeonCorridorBindingReanchorer();
        DungeonCorridorRoomReconciler corridorRoomReconciler = new DungeonCorridorRoomReconciler();
        DungeonRoomTopologyCoordinator roomTopologySupport = new DungeonRoomTopologyCoordinator(
                corridorBindingReanchorer,
                corridorRoomReconciler);
        DungeonCorridorCommandService corridorCommandService = new DungeonCorridorCommandService();
        DungeonCorridorDetailEditService corridorDetailEditService = new DungeonCorridorDetailEditService();
        DungeonMapCatalogService mapCatalogService = new DungeonMapCatalogService(connectionFactory, roomTopologySupport);
        DungeonRuntimeService runtimeService = new DungeonRuntimeService(connectionFactory, roomTopologySupport);
        DungeonEditorService editorService = new DungeonEditorService(
                connectionFactory,
                roomTopologySupport,
                corridorCommandService,
                corridorDetailEditService);
        this.dungeonView = new DungeonView(
                detailsNavigator,
                new DungeonRuntimeWorkflow(mapCatalogService, runtimeService, new DungeonRuntimeUiAsyncRunner()));
        this.dungeonEditorView = new DungeonEditorView(
                detailsNavigator,
                mapCatalogService,
                editorService);
    }

    public AppView dungeonView() {
        return dungeonView;
    }

    public AppView dungeonEditorView() {
        return dungeonEditorView;
    }
}
