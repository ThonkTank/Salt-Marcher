package features.tables.api;

import features.creatures.api.CreatureCatalogService;
import features.encountertable.api.EncounterTableModule;
import features.loottable.api.LootTableModule;
import features.tables.ui.TablesWorkspaceView;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

/**
 * Shell-facing facade for the combined encounter/loot table workspace.
 */
public final class TablesModule {

    private final EncounterTableModule encounterTableModule;
    private final LootTableModule lootTableModule;
    private final TablesWorkspaceView workspaceView;

    public TablesModule(DetailsNavigator detailsNavigator) {
        this.encounterTableModule = new EncounterTableModule();
        this.lootTableModule = new LootTableModule();
        this.encounterTableModule.setDetailsNavigator(detailsNavigator);
        this.workspaceView = new TablesWorkspaceView(
                encounterTableModule.view(),
                lootTableModule.view());
        lootTableModule.start(detailsNavigator);
    }

    public AppView view() {
        return workspaceView;
    }

    public void setCreatureFilterData(CreatureCatalogService.FilterOptions data) {
        encounterTableModule.setFilterData(data);
    }
}
