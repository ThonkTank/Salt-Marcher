package features.encountertable.api;

import features.creatures.api.CreatureCatalogService;
import features.encountertable.ui.EncounterTableEditorView;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

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

    public void setDetailsNavigator(DetailsNavigator detailsNavigator) {
        tableEditorView.setDetailsNavigator(detailsNavigator);
    }
}
