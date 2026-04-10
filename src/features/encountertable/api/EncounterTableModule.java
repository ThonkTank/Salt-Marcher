package features.encountertable.api;

import features.creatures.catalog.input.LoadFilterOptionsInput;
import features.encountertable.ui.EncounterTableEditorView;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

@SuppressWarnings("unused")
public final class EncounterTableModule {

    private final EncounterTableEditorView tableEditorView;

    public EncounterTableModule() {
        this.tableEditorView = new EncounterTableEditorView();
    }

    public AppView view() {
        return tableEditorView;
    }

    public void setFilterData(LoadFilterOptionsInput.LoadedFilterOptionsInput data) {
        tableEditorView.setFilterData(data);
    }

    public void setDetailsNavigator(DetailsNavigator detailsNavigator) {
        tableEditorView.setDetailsNavigator(detailsNavigator);
    }
}
