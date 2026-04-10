package features.tables.api;

import features.tables.TablesObject;
import features.tables.input.CreateWorkspaceViewInput;
import features.tables.input.SetCreatureFilterDataInput;
import features.creatures.catalog.input.LoadFilterOptionsInput;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

/**
 * Shell-facing facade for the combined encounter/loot table workspace.
 */
@SuppressWarnings("unused")
public final class TablesModule {
    private final TablesObject tablesObject;

    public TablesModule(DetailsNavigator detailsNavigator) {
        this.tablesObject = new TablesObject(detailsNavigator);
    }

    public AppView view() {
        return tablesObject.createWorkspaceView(new CreateWorkspaceViewInput()).workspaceView();
    }

    public void setCreatureFilterData(LoadFilterOptionsInput.LoadedFilterOptionsInput data) {
        tablesObject.setCreatureFilterData(new SetCreatureFilterDataInput(data));
    }
}
