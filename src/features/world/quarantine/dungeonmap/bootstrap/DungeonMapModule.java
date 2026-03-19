package features.world.quarantine.dungeonmap.bootstrap;

import database.DatabaseManager;
import features.world.quarantine.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.quarantine.dungeonmap.foundation.db.DungeonConnectionFactory;
import features.world.quarantine.dungeonmap.editor.DungeonEditorService;
import features.world.quarantine.dungeonmap.runtime.application.DungeonRuntimeService;
import features.world.quarantine.dungeonmap.runtime.application.DungeonRuntimeStateSupport;
import features.world.quarantine.dungeonmap.runtime.application.DungeonRuntimeWorkflow;
import features.world.quarantine.dungeonmap.corridors.application.DungeonCorridorBindingReanchorer;
import features.world.quarantine.dungeonmap.corridors.application.DungeonCorridorCommandService;
import features.world.quarantine.dungeonmap.corridors.application.DungeonCorridorDetailEditService;
import features.world.quarantine.dungeonmap.corridors.application.DungeonCorridorRoomReconciler;
import features.world.quarantine.dungeonmap.rooms.application.DungeonRoomTopologyCoordinator;
import features.world.quarantine.dungeonmap.editor.shell.DungeonEditorView;
import features.world.quarantine.dungeonmap.inspector.DungeonInspectorPort;
import features.world.quarantine.dungeonmap.runtime.ui.DungeonView;
import features.world.quarantine.dungeonmap.foundation.async.DungeonUiAsyncRunner;
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
        DungeonMapCatalogService mapCatalogService = new DungeonMapCatalogService(connectionFactory, roomTopologySupport,
                DungeonRuntimeStateSupport::repairStoredRuntimeState);
        DungeonRuntimeService runtimeService = new DungeonRuntimeService(connectionFactory, roomTopologySupport);
        DungeonEditorService editorService = new DungeonEditorService(
                connectionFactory,
                roomTopologySupport,
                corridorCommandService,
                corridorDetailEditService,
                DungeonRuntimeStateSupport::repairStoredRuntimeState);
        DungeonInspectorPort inspectorPort = DungeonInspectorPort.fromNavigator(detailsNavigator);
        this.dungeonView = new DungeonView(
                inspectorPort,
                new DungeonRuntimeWorkflow(mapCatalogService, runtimeService, new DungeonUiAsyncRunner()));
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
