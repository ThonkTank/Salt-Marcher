package features.tables;

import features.encountertable.api.EncounterTableModule;
import features.loottable.api.LootTableModule;
import features.tables.input.CreateWorkspaceViewInput;
import features.tables.input.SetCreatureFilterDataInput;
import features.tables.ui.TablesWorkspaceView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

/**
 * Canonical root seam for the app-wide tables workspace that composes encounter
 * and loot editor surfaces behind one shell navigation entry.
 */
@SuppressWarnings("unused")
public final class TablesObject {

    private final EncounterTableModule encounterTableModule;
    private final LootTableModule lootTableModule;
    private final TablesWorkspaceView workspaceView;

    public TablesObject(DetailsNavigator detailsNavigator) {
        DetailsNavigator requiredNavigator = Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.encounterTableModule = new EncounterTableModule();
        this.lootTableModule = new LootTableModule();
        this.encounterTableModule.setDetailsNavigator(requiredNavigator);
        this.lootTableModule.start(requiredNavigator);
        this.workspaceView = new TablesWorkspaceView(
                encounterTableModule.view(),
                lootTableModule.view());
    }

    public CreateWorkspaceViewInput.CreatedWorkspaceViewInput createWorkspaceView(CreateWorkspaceViewInput input) {
        return new CreateWorkspaceViewInput.CreatedWorkspaceViewInput(workspaceView);
    }

    public SetCreatureFilterDataInput.AppliedCreatureFilterDataInput setCreatureFilterData(SetCreatureFilterDataInput input) {
        if (input != null && input.filterData() != null) {
            encounterTableModule.setFilterData(input.filterData());
        }
        return new SetCreatureFilterDataInput.AppliedCreatureFilterDataInput();
    }
}
