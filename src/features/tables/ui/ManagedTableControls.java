package features.tables.ui;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import ui.components.ThemeColors;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.ToLongFunction;

public class ManagedTableControls<T> extends VBox {

    private final ComboBox<T> tableCombo = new ComboBox<>();
    private final Button renameBtn = new Button("Umbenennen");
    private final Button deleteBtn = new Button("Löschen");
    private final VBox tableSupplements = new VBox(4);
    private final VBox filterRegion = new VBox();
    private final List<Node> selectionDependentNodes = new ArrayList<>();

    private Consumer<T> onTableSelected;
    private Consumer<TableActionRequest<T>> onCreateTable;
    private Consumer<TableActionRequest<T>> onRenameTable;
    private Consumer<TableActionRequest<T>> onDeleteTable;

    public ManagedTableControls(String tableHeaderText, String tablePromptText) {
        setSpacing(0);
        setPadding(new Insets(0));

        Label tableHeader = new Label(tableHeaderText);
        tableHeader.getStyleClass().addAll("section-header", "text-muted");

        tableCombo.setMaxWidth(Double.MAX_VALUE);
        tableCombo.setPromptText(tablePromptText);
        tableCombo.setOnAction(event -> {
            T table = tableCombo.getValue();
            updateActionButtons(table != null);
            if (onTableSelected != null) {
                onTableSelected.accept(table);
            }
        });

        Button createBtn = new Button("Neue Tabelle");
        createBtn.getStyleClass().add("compact");
        renameBtn.getStyleClass().add("compact");
        deleteBtn.getStyleClass().add("compact");
        updateActionButtons(false);

        createBtn.setOnAction(event -> {
            if (onCreateTable != null) {
                onCreateTable.accept(new TableActionRequest<>(tableCombo.getValue(), createBtn));
            }
        });
        renameBtn.setOnAction(event -> {
            if (onRenameTable != null && tableCombo.getValue() != null) {
                onRenameTable.accept(new TableActionRequest<>(tableCombo.getValue(), renameBtn));
            }
        });
        deleteBtn.setOnAction(event -> {
            if (onDeleteTable != null && tableCombo.getValue() != null) {
                onDeleteTable.accept(new TableActionRequest<>(tableCombo.getValue(), deleteBtn));
            }
        });

        HBox actionRow = new HBox(4, createBtn, renameBtn, deleteBtn);
        actionRow.setPadding(new Insets(4, 4, 4, 4));

        VBox tableSection = new VBox(4, tableHeader, tableCombo, actionRow, tableSupplements);
        tableSection.setPadding(new Insets(0, 4, 4, 4));

        Label filterHeader = new Label("FILTER");
        filterHeader.getStyleClass().addAll("section-header", "text-muted");

        Label loadingLabel = new Label("Lade Filter...");
        loadingLabel.getStyleClass().add("text-muted");
        filterRegion.getChildren().setAll(loadingLabel);
        filterRegion.setPadding(new Insets(0, 4, 0, 4));

        VBox filterSection = new VBox(0, filterHeader, filterRegion);

        getChildren().setAll(tableSection, ThemeColors.controlSeparator(), filterSection);
    }

    public void setTableList(List<T> tables, ToLongFunction<T> idExtractor) {
        T current = tableCombo.getValue();
        tableCombo.getItems().setAll(tables);
        if (current == null) {
            return;
        }
        long currentId = idExtractor.applyAsLong(current);
        tables.stream()
                .filter(table -> idExtractor.applyAsLong(table) == currentId)
                .findFirst()
                .ifPresentOrElse(tableCombo::setValue, () -> {
                    tableCombo.setValue(null);
                    updateActionButtons(false);
                });
    }

    public void setFilterContent(Node content) {
        filterRegion.getChildren().setAll(content);
    }

    public T getSelectedTable() {
        return tableCombo.getValue();
    }

    public void selectTable(T table) {
        tableCombo.setValue(table);
    }

    public void setOnTableSelected(Consumer<T> callback) {
        this.onTableSelected = callback;
    }

    public void setOnCreateTable(Consumer<TableActionRequest<T>> callback) {
        this.onCreateTable = callback;
    }

    public void setOnRenameTable(Consumer<TableActionRequest<T>> callback) {
        this.onRenameTable = callback;
    }

    public void setOnDeleteTable(Consumer<TableActionRequest<T>> callback) {
        this.onDeleteTable = callback;
    }

    private void updateActionButtons(boolean hasTable) {
        renameBtn.setDisable(!hasTable);
        deleteBtn.setDisable(!hasTable);
        for (Node node : selectionDependentNodes) {
            node.setDisable(!hasTable);
        }
    }

    protected final void addTableSupplement(Node... nodes) {
        tableSupplements.getChildren().addAll(nodes);
    }

    protected final void registerSelectionDependent(Node... nodes) {
        for (Node node : nodes) {
            selectionDependentNodes.add(node);
            node.setDisable(getSelectedTable() == null);
        }
    }
}
