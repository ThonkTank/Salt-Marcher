package features.world.dungeonmap.ui.editor.workflow.catalog;

import features.world.dungeonmap.service.integration.catalog.DungeonEncounterCatalogAdapter;
import features.world.dungeonmap.service.integration.catalog.DungeonEncounterTableCatalogAdapter;
import features.world.dungeonmap.ui.shared.async.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.editor.chrome.sidebar.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import ui.async.UiErrorReporter;

public final class DungeonCatalogLoader {

    private final DungeonEditorState state;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final Runnable onEncounterTablesChanged;
    private final Runnable onStoredEncountersChanged;

    public DungeonCatalogLoader(
            DungeonEditorState state,
            DungeonToolSettingsPane toolSettingsPane,
            Runnable onEncounterTablesChanged,
            Runnable onStoredEncountersChanged
    ) {
        this.state = state;
        this.toolSettingsPane = toolSettingsPane;
        this.onEncounterTablesChanged = onEncounterTablesChanged == null ? () -> { } : onEncounterTablesChanged;
        this.onStoredEncountersChanged = onStoredEncountersChanged == null ? () -> { } : onStoredEncountersChanged;
    }

    public void loadCatalogs() {
        loadEncounterTables();
        loadStoredEncounters();
    }

    private void loadEncounterTables() {
        DungeonUiAsyncSupport.submitValue(
                DungeonEncounterTableCatalogAdapter::loadSummaries,
                tables -> {
                    state.setEncounterTables(tables);
                    toolSettingsPane.setEncounterTables(tables);
                    onEncounterTablesChanged.run();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonCatalogLoader.loadEncounterTables()", ex));
    }

    private void loadStoredEncounters() {
        DungeonUiAsyncSupport.submitValue(
                DungeonEncounterCatalogAdapter::loadSummaries,
                encounters -> {
                    state.setEncounters(encounters);
                    toolSettingsPane.setStoredEncounters(encounters);
                    onStoredEncountersChanged.run();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonCatalogLoader.loadStoredEncounters()", ex));
    }
}
