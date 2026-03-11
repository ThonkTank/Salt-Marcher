package features.encountertable.ui;

import features.encountertable.model.EncounterTable;
import features.loottable.api.LootTableApi;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import features.creatures.api.CreatureCatalogService;
import ui.components.ThemeColors;
import features.creatures.api.CreatureFilterPane;

import java.util.List;
import java.util.function.Consumer;

/**
 * Controls panel for the encounter table editor.
 * Top section: table selector ComboBox + create/rename/delete actions.
 * Bottom section: CreatureFilterPane for the monster browser.
 */
public class TableEditorControls extends VBox {

    private CreatureFilterPane filterPane;
    private Consumer<CreatureCatalogService.FilterCriteria> filterCallback;

    private final ComboBox<EncounterTable> tableCombo;
    private final ComboBox<LootTableApi.LootTableSummary> lootTableCombo;
    private final Button renameBtn;
    private final Button deleteBtn;
    private final VBox filterRegion;

    private Consumer<EncounterTable> onTableSelected;
    private Consumer<LootTableApi.LootTableSummary> onLootTableSelected;
    private Runnable onCreateTable;
    private Runnable onRenameTable;
    private Runnable onDeleteTable;

    public TableEditorControls() {
        setSpacing(0);
        setPadding(new Insets(0));

        // ---- Table section ----
        Label tableHeader = new Label("TABELLE");
        tableHeader.getStyleClass().addAll("section-header", "text-muted");

        tableCombo = new ComboBox<>();
        tableCombo.setMaxWidth(Double.MAX_VALUE);
        tableCombo.setPromptText("— Tabelle wählen —");
        tableCombo.setOnAction(e -> {
            EncounterTable t = tableCombo.getValue();
            updateActionButtons(t != null);
            syncLootTableSelection(t);
            if (onTableSelected != null) onTableSelected.accept(t);
        });

        lootTableCombo = new ComboBox<>();
        lootTableCombo.setMaxWidth(Double.MAX_VALUE);
        lootTableCombo.setPromptText("— Loot-Tabelle —");
        lootTableCombo.setDisable(true);
        lootTableCombo.setOnAction(e -> {
            if (onLootTableSelected != null && !lootTableCombo.isDisable()) {
                onLootTableSelected.accept(lootTableCombo.getValue());
            }
        });

        Button createBtn = new Button("Neue Tabelle");
        renameBtn = new Button("Umbenennen");
        deleteBtn = new Button("Löschen");

        createBtn.getStyleClass().add("compact");
        renameBtn.getStyleClass().add("compact");
        deleteBtn.getStyleClass().add("compact");

        renameBtn.setDisable(true);
        deleteBtn.setDisable(true);

        createBtn.setOnAction(e -> { if (onCreateTable != null) onCreateTable.run(); });
        renameBtn.setOnAction(e -> { if (onRenameTable != null) onRenameTable.run(); });
        deleteBtn.setOnAction(e -> { if (onDeleteTable != null) onDeleteTable.run(); });

        HBox actionRow = new HBox(4, createBtn, renameBtn, deleteBtn);
        actionRow.setPadding(new Insets(4, 4, 4, 4));

        Label lootHeader = new Label("LOOT");
        lootHeader.getStyleClass().addAll("section-header", "text-muted");

        VBox tableSection = new VBox(4, tableHeader, tableCombo, actionRow, lootHeader, lootTableCombo);
        tableSection.setPadding(new Insets(0, 4, 4, 4));

        // ---- Filter section ----
        Label filterHeader = new Label("FILTER");
        filterHeader.getStyleClass().addAll("section-header", "text-muted");

        filterRegion = new VBox();
        Label loadingLabel = new Label("Lade Filter...");
        loadingLabel.getStyleClass().add("text-muted");
        filterRegion.getChildren().add(loadingLabel);
        filterRegion.setPadding(new Insets(0, 4, 0, 4));

        VBox filterSection = new VBox(0, filterHeader, filterRegion);

        getChildren().setAll(tableSection, ThemeColors.controlSeparator(), filterSection);
    }

    private void updateActionButtons(boolean hasTable) {
        renameBtn.setDisable(!hasTable);
        deleteBtn.setDisable(!hasTable);
        lootTableCombo.setDisable(!hasTable);
    }

    // ---- Public API ----

    public void setFilterData(CreatureCatalogService.FilterOptions data) {
        filterPane = new CreatureFilterPane(data);
        filterRegion.getChildren().setAll(filterPane);
        if (filterCallback != null) filterPane.setOnFilterChanged(filterCallback);
    }

    public void setOnFilterChanged(Consumer<CreatureCatalogService.FilterCriteria> callback) {
        this.filterCallback = callback;
        if (filterPane != null) filterPane.setOnFilterChanged(callback);
    }

    public CreatureCatalogService.FilterCriteria buildCriteria() {
        return filterPane != null ? filterPane.buildCriteria() : CreatureCatalogService.FilterCriteria.empty();
    }

    /**
     * Replaces the table list. Preserves the current selection if the table is still present;
     * deselects if the previously selected table has been removed.
     */
    public void setTableList(List<EncounterTable> tables) {
        EncounterTable current = tableCombo.getValue();
        tableCombo.getItems().setAll(tables);
        if (current != null) {
            tables.stream()
                    .filter(t -> t.tableId == current.tableId)
                    .findFirst()
                    .ifPresentOrElse(
                            t -> tableCombo.setValue(t),
                            () -> {
                                tableCombo.setValue(null);
                                updateActionButtons(false);
                                syncLootTableSelection(null);
                            });
        }
    }

    public void setLootTableList(List<LootTableApi.LootTableSummary> tables) {
        lootTableCombo.getItems().setAll(tables);
        LootTableApi.LootTableSummary none = new LootTableApi.LootTableSummary(-1L, "(Keine Loot-Tabelle)");
        lootTableCombo.getItems().add(0, none);
        if (tableCombo.getValue() != null) {
            syncLootTableSelection(tableCombo.getValue());
        } else {
            lootTableCombo.setValue(none);
        }
    }

    public EncounterTable getSelectedTable() { return tableCombo.getValue(); }

    /** Programmatically select a table (triggers the onTableSelected callback via ComboBox listener). */
    public void selectTable(EncounterTable t) { tableCombo.setValue(t); }

    public void setOnTableSelected(Consumer<EncounterTable> cb) { this.onTableSelected = cb; }
    public void setOnLootTableSelected(Consumer<LootTableApi.LootTableSummary> cb) { this.onLootTableSelected = cb; }
    public void setOnCreateTable(Runnable cb) { this.onCreateTable = cb; }
    public void setOnRenameTable(Runnable cb) { this.onRenameTable = cb; }
    public void setOnDeleteTable(Runnable cb) { this.onDeleteTable = cb; }

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
