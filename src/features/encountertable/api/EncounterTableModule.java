package features.encountertable.api;

import features.creatures.api.CreatureCatalogService;
import features.encountertable.ui.EncounterTableEditorView;
import ui.shell.AppView;

public final class EncounterTableModule {

    private final EncounterTableEditorView tableEditorView;

    public EncounterTableModule() {
        this.tableEditorView = new EncounterTableEditorView();
    }

    public AppView view() {
        return tableEditorView;
    }

    public void setFilterData(CreatureCatalogService.FilterOptions data) {
        tableEditorView.setFilterData(data);
    }
}
