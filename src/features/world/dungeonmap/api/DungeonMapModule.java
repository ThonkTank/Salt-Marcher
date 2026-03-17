package features.world.dungeonmap.api;

import database.DatabaseManager;
import features.world.dungeonmap.application.DungeonConnectionFactory;
import features.world.dungeonmap.application.catalog.DungeonMapCatalogService;
import features.world.dungeonmap.application.editor.DungeonEditorService;
import features.world.dungeonmap.application.runtime.DungeonRuntimeService;
import features.world.dungeonmap.application.runtime.DungeonRuntimeWorkflow;
import features.world.dungeonmap.ui.editor.DungeonEditorView;
import features.world.dungeonmap.ui.runtime.DungeonView;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class DungeonMapModule {

    private final AppView dungeonView;
    private final AppView dungeonEditorView;

    public DungeonMapModule(DetailsNavigator detailsNavigator) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        DungeonConnectionFactory connectionFactory = DatabaseManager::getConnection;
        DungeonMapCatalogService mapCatalogService = new DungeonMapCatalogService(connectionFactory);
        DungeonRuntimeService runtimeService = new DungeonRuntimeService(connectionFactory);
        DungeonEditorService editorService = new DungeonEditorService(connectionFactory);
        this.dungeonView = new DungeonView(
                detailsNavigator,
                new DungeonRuntimeWorkflow(mapCatalogService, runtimeService));
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
