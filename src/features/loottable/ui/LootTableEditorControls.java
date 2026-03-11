package features.loottable.ui;

import features.items.api.ItemCatalogService;
import features.items.api.ItemFilterPane;
import features.loottable.model.LootTable;
import features.tables.ui.ManagedTableControls;
import features.tables.ui.TableActionRequest;

import java.util.List;
import java.util.function.Consumer;

public class LootTableEditorControls extends ManagedTableControls<LootTable> {

    private ItemFilterPane filterPane;
    private Consumer<ItemCatalogService.FilterCriteria> filterCallback;

    public LootTableEditorControls() {
        super("LOOT-TABELLE", "— Loot-Tabelle wählen —");
    }

    public void setTableList(List<LootTable> tables) {
        super.setTableList(tables, table -> table.tableId);
    }

    public void setFilterData(ItemCatalogService.FilterOptions data) {
        filterPane = new ItemFilterPane(data);
        setFilterContent(filterPane);
        if (filterCallback != null) {
            filterPane.setOnFilterChanged(filterCallback);
        }
    }

    public void setOnFilterChanged(Consumer<ItemCatalogService.FilterCriteria> callback) {
        filterCallback = callback;
        if (filterPane != null) {
            filterPane.setOnFilterChanged(callback);
        }
    }

    public void selectTable(LootTable table) {
        super.selectTable(table);
    }

    public void setOnTableSelected(Consumer<LootTable> callback) {
        super.setOnTableSelected(callback);
    }

    public void setOnCreateTable(Consumer<TableActionRequest<LootTable>> callback) {
        super.setOnCreateTable(callback);
    }

    public void setOnRenameTableRequested(Consumer<TableActionRequest<LootTable>> callback) {
        super.setOnRenameTable(callback);
    }

    public void setOnDeleteTableRequested(Consumer<TableActionRequest<LootTable>> callback) {
        super.setOnDeleteTable(callback);
    }
}
