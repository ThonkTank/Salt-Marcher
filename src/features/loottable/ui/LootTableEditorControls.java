package features.loottable.ui;

import features.items.api.ItemCatalogService;
import features.items.api.ItemFilterPane;
import features.loottable.model.LootTable;
import features.tables.ui.ManagedTableControls;
import javafx.scene.Node;

import java.util.List;
import java.util.function.Consumer;

public class LootTableEditorControls extends ManagedTableControls<LootTable> {

    public record TableActionRequest(LootTable table, Node anchor) {}

    private ItemFilterPane filterPane;
    private Consumer<ItemCatalogService.FilterCriteria> filterCallback;
    private Consumer<TableActionRequest> onRenameTable;
    private Consumer<TableActionRequest> onDeleteTable;

    public LootTableEditorControls() {
        super("LOOT-TABELLE", "— Loot-Tabelle wählen —");
        super.setOnRenameTable(anchor -> {
            LootTable table = getSelectedTable();
            if (onRenameTable != null && table != null) {
                onRenameTable.accept(new TableActionRequest(table, anchor));
            }
        });
        super.setOnDeleteTable(anchor -> {
            LootTable table = getSelectedTable();
            if (onDeleteTable != null && table != null) {
                onDeleteTable.accept(new TableActionRequest(table, anchor));
            }
        });
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

    public void setOnCreateTable(Consumer<Node> callback) {
        super.setOnCreateTable(callback);
    }

    public void setOnRenameTableRequested(Consumer<TableActionRequest> callback) {
        this.onRenameTable = callback;
    }

    public void setOnDeleteTableRequested(Consumer<TableActionRequest> callback) {
        this.onDeleteTable = callback;
    }
}
