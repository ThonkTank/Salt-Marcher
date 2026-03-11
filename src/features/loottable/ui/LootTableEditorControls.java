package features.loottable.ui;

import features.items.api.ItemCatalogService;
import features.items.api.ItemFilterPane;
import features.loottable.model.LootTable;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import ui.components.ThemeColors;

import java.util.List;
import java.util.function.Consumer;

public class LootTableEditorControls extends VBox {

    private final ComboBox<LootTable> tableCombo;
    private final Button renameBtn;
    private final Button deleteBtn;
    private final VBox filterRegion;

    private ItemFilterPane filterPane;
    private Consumer<ItemCatalogService.FilterCriteria> filterCallback;

    private Consumer<LootTable> onTableSelected;
    private Runnable onCreateTable;
    private Runnable onRenameTable;
    private Runnable onDeleteTable;

    public LootTableEditorControls() {
        setSpacing(0);
        setPadding(new Insets(0));

        Label tableHeader = new Label("LOOT-TABELLE");
        tableHeader.getStyleClass().addAll("section-header", "text-muted");

        ComboBox<LootTable> combo = new ComboBox<>();
        combo.setMaxWidth(Double.MAX_VALUE);
        combo.setPromptText("— Loot-Tabelle wählen —");

        Button createBtn = new Button("Neue Tabelle");
        Button rename = new Button("Umbenennen");
        Button delete = new Button("Löschen");
        createBtn.getStyleClass().add("compact");
        rename.getStyleClass().add("compact");
        delete.getStyleClass().add("compact");
        rename.setDisable(true);
        delete.setDisable(true);
        combo.setOnAction(e -> {
            LootTable t = combo.getValue();
            rename.setDisable(t == null);
            delete.setDisable(t == null);
            if (onTableSelected != null) onTableSelected.accept(t);
        });
        createBtn.setOnAction(e -> { if (onCreateTable != null) onCreateTable.run(); });
        rename.setOnAction(e -> { if (onRenameTable != null) onRenameTable.run(); });
        delete.setOnAction(e -> { if (onDeleteTable != null) onDeleteTable.run(); });

        tableCombo = combo;
        renameBtn = rename;
        deleteBtn = delete;

        HBox actionRow = new HBox(4, createBtn, rename, delete);
        actionRow.setPadding(new Insets(4, 4, 4, 4));

        VBox tableSection = new VBox(4, tableHeader, combo, actionRow);

        Label filterHeader = new Label("FILTER");
        filterHeader.getStyleClass().addAll("section-header", "text-muted");
        filterRegion = new VBox();
        Label loadingLabel = new Label("Lade Filter...");
        loadingLabel.getStyleClass().add("text-muted");
        filterRegion.getChildren().setAll(loadingLabel);
        filterRegion.setPadding(new Insets(0, 4, 0, 4));
        VBox filterSection = new VBox(0, filterHeader, filterRegion);

        getChildren().setAll(tableSection, ThemeColors.controlSeparator(), filterSection);
    }

    public void setTableList(List<LootTable> tables) {
        LootTable current = tableCombo.getValue();
        tableCombo.getItems().setAll(tables);
        if (current != null) {
            tables.stream()
                    .filter(t -> t.tableId == current.tableId)
                    .findFirst()
                    .ifPresentOrElse(tableCombo::setValue, () -> {
                        tableCombo.setValue(null);
                        renameBtn.setDisable(true);
                        deleteBtn.setDisable(true);
                    });
        }
    }

    public void setFilterData(ItemCatalogService.FilterOptions data) {
        filterPane = new ItemFilterPane(data);
        filterRegion.getChildren().setAll(filterPane);
        if (filterCallback != null) filterPane.setOnFilterChanged(filterCallback);
    }

    public void setOnFilterChanged(Consumer<ItemCatalogService.FilterCriteria> callback) {
        filterCallback = callback;
        if (filterPane != null) filterPane.setOnFilterChanged(callback);
    }

    public void selectTable(LootTable table) { tableCombo.setValue(table); }
    public void setOnTableSelected(Consumer<LootTable> cb) { this.onTableSelected = cb; }
    public void setOnCreateTable(Runnable cb) { this.onCreateTable = cb; }
    public void setOnRenameTable(Runnable cb) { this.onRenameTable = cb; }
    public void setOnDeleteTable(Runnable cb) { this.onDeleteTable = cb; }
}
