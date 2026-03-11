package features.encountertable.ui;

import features.creatures.api.CreatureCatalogService;
import features.creatures.api.CreatureFilterPane;
import features.encountertable.model.EncounterTable;
import features.loottable.api.LootTableApi;
import features.tables.ui.ManagedTableControls;
import features.tables.ui.TableActionRequest;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;

import java.util.List;
import java.util.function.Consumer;

/**
 * Controls panel for the encounter table editor.
 * Top section: table selector ComboBox + create/rename/delete actions.
 * Bottom section: CreatureFilterPane for the monster browser.
 */
public class TableEditorControls extends ManagedTableControls<EncounterTable> {

    private CreatureFilterPane filterPane;
    private Consumer<CreatureCatalogService.FilterCriteria> filterCallback;

    private final ComboBox<LootTableApi.LootTableSummary> lootTableCombo;

    private Consumer<LootTableApi.LootTableSummary> onLootTableSelected;

    public TableEditorControls() {
        super("TABELLE", "— Tabelle wählen —");

        lootTableCombo = new ComboBox<>();
        lootTableCombo.setMaxWidth(Double.MAX_VALUE);
        lootTableCombo.setPromptText("— Loot-Tabelle —");
        lootTableCombo.setDisable(true);
        lootTableCombo.setOnAction(event -> {
            if (onLootTableSelected != null && !lootTableCombo.isDisable()) {
                onLootTableSelected.accept(lootTableCombo.getValue());
            }
        });

        Label lootHeader = new Label("LOOT");
        lootHeader.getStyleClass().addAll("section-header", "text-muted");
        addTableSupplement(lootHeader, lootTableCombo);
        registerSelectionDependent(lootTableCombo);

        super.setOnTableSelected(table -> {
            syncLootTableSelection(table);
            if (onTableSelected != null) {
                onTableSelected.accept(table);
            }
        });
    }

    private Consumer<EncounterTable> onTableSelected;

    // ---- Public API ----

    public void setFilterData(CreatureCatalogService.FilterOptions data) {
        filterPane = new CreatureFilterPane(data);
        setFilterContent(filterPane);
        if (filterCallback != null) {
            filterPane.setOnFilterChanged(filterCallback);
        }
    }

    public void setOnFilterChanged(Consumer<CreatureCatalogService.FilterCriteria> callback) {
        this.filterCallback = callback;
        if (filterPane != null) {
            filterPane.setOnFilterChanged(callback);
        }
    }

    public CreatureCatalogService.FilterCriteria buildCriteria() {
        return filterPane != null ? filterPane.buildCriteria() : CreatureCatalogService.FilterCriteria.empty();
    }

    /**
     * Replaces the table list. Preserves the current selection if the table is still present;
     * deselects if the previously selected table has been removed.
     */
    public void setTableList(List<EncounterTable> tables) {
        EncounterTable previous = getSelectedTable();
        super.setTableList(tables, table -> table.tableId);
        if (previous != null && getSelectedTable() == null) {
            syncLootTableSelection(null);
        }
    }

    public void setLootTableList(List<LootTableApi.LootTableSummary> tables) {
        lootTableCombo.getItems().setAll(tables);
        LootTableApi.LootTableSummary none = new LootTableApi.LootTableSummary(-1L, "(Keine Loot-Tabelle)");
        lootTableCombo.getItems().add(0, none);
        if (getSelectedTable() != null) {
            syncLootTableSelection(getSelectedTable());
        } else {
            lootTableCombo.setValue(none);
        }
    }

    public EncounterTable getSelectedTable() {
        return super.getSelectedTable();
    }

    /** Programmatically select a table (triggers the onTableSelected callback via ComboBox listener). */
    public void selectTable(EncounterTable table) {
        super.selectTable(table);
    }

    public void setOnTableSelected(Consumer<EncounterTable> callback) {
        this.onTableSelected = callback;
    }

    public void setOnLootTableSelected(Consumer<LootTableApi.LootTableSummary> callback) {
        this.onLootTableSelected = callback;
    }

    public void setOnCreateTable(Consumer<TableActionRequest<EncounterTable>> callback) {
        super.setOnCreateTable(callback);
    }

    public void setOnRenameTable(Consumer<TableActionRequest<EncounterTable>> callback) {
        super.setOnRenameTable(callback);
    }

    public void setOnDeleteTable(Consumer<TableActionRequest<EncounterTable>> callback) {
        super.setOnDeleteTable(callback);
    }

    private void syncLootTableSelection(EncounterTable table) {
        if (lootTableCombo.getItems().isEmpty()) return;
        if (table == null || table.linkedLootTableId == null) {
            lootTableCombo.getSelectionModel().selectFirst();
            return;
        }
        lootTableCombo.getItems().stream()
                .filter(ref -> ref.tableId() == table.linkedLootTableId)
                .findFirst()
                .ifPresentOrElse(lootTableCombo::setValue, () -> lootTableCombo.getSelectionModel().selectFirst());
    }
}
