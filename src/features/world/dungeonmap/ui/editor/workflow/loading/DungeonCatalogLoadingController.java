package features.world.dungeonmap.ui.editor.workflow.loading;

import features.world.dungeonmap.service.catalog.DungeonEncounterCatalogAdapter;
import features.world.dungeonmap.service.catalog.DungeonEncounterTableCatalogAdapter;
import features.world.dungeonmap.ui.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import ui.async.UiErrorReporter;

public final class DungeonCatalogLoadingController {

    private final DungeonEditorState state;
    private final DungeonToolSettingsPane toolSettingsPane;
    private Runnable onEncounterTablesChanged = () -> { };
    private Runnable onStoredEncountersChanged = () -> { };

    public DungeonCatalogLoadingController(
            DungeonEditorState state,
            DungeonToolSettingsPane toolSettingsPane
    ) {
        this.state = state;
        this.toolSettingsPane = toolSettingsPane;
    }

    public void loadCatalogs() {
        loadEncounterTables();
        loadStoredEncounters();
    }

    public void setOnEncounterTablesChanged(Runnable callback) {
        onEncounterTablesChanged = callback == null ? () -> { } : callback;
    }

    public void setOnStoredEncountersChanged(Runnable callback) {
        onStoredEncountersChanged = callback == null ? () -> { } : callback;
    }

    private void loadEncounterTables() {
        DungeonUiAsyncSupport.submitValue(
                DungeonEncounterTableCatalogAdapter::loadSummaries,
                tables -> {
                    state.setEncounterTables(tables);
                    toolSettingsPane.setEncounterTables(tables);
                    onEncounterTablesChanged.run();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonCatalogLoadingController.loadEncounterTables()", ex));
    }

    private void loadStoredEncounters() {
        DungeonUiAsyncSupport.submitValue(
                DungeonEncounterCatalogAdapter::loadSummaries,
                encounters -> {
                    state.setEncounters(encounters);
                    toolSettingsPane.setStoredEncounters(encounters);
                    onStoredEncountersChanged.run();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonCatalogLoadingController.loadStoredEncounters()", ex));
    }
}
