package src.view.slotcontent.main.catalog;

import java.util.List;
import java.util.function.LongConsumer;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;

public final class CatalogMainView extends VBox {

    private final ObservableList<RowItem> items = FXCollections.observableArrayList();
    private final TableView<RowItem> table = new TableView<>(items);
    private final Label placeholder = new Label("Lade Monster...");
    private @Nullable LongConsumer rowOpenHandler;
    private @Nullable LongConsumer rowActionHandler;
    private String rowActionLabel = "";
    private String rowActionTooltip = "";

    public CatalogMainView() {
        getStyleClass().add("surface-root");
        setPadding(new Insets(8));
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        table.setPlaceholder(placeholder);
        table.setOnKeyPressed(event -> {
            RowItem row = table.getSelectionModel().getSelectedItem();
            if (row != null && event.getCode() == KeyCode.ENTER) {
                fireOpen(row.id());
                event.consume();
            }
        });
        getChildren().add(table);
        VBox.setVgrow(table, Priority.ALWAYS);
    }

    public void setColumns(List<ColumnItem> columns) {
        table.getColumns().clear();
        List<ColumnItem> safeColumns = columns == null ? List.of() : List.copyOf(columns);
        for (int index = 0; index < safeColumns.size(); index++) {
            ColumnItem column = safeColumns.get(index);
            TableColumn<RowItem, String> tableColumn = new TableColumn<>(column.label());
            tableColumn.setUserData(column);
            int cellIndex = index;
            tableColumn.setCellValueFactory(data ->
                    new SimpleStringProperty(data.getValue().cell(cellIndex)));
            if (index == 0) {
                tableColumn.setMinWidth(150);
                tableColumn.setPrefWidth(220);
                tableColumn.setCellFactory(ignored -> new LinkCell());
            } else if ("cr".equals(column.key())) {
                tableColumn.setMinWidth(40);
                tableColumn.setPrefWidth(50);
                tableColumn.setMaxWidth(65);
            } else if ("xp".equals(column.key())) {
                tableColumn.setMinWidth(55);
                tableColumn.setPrefWidth(70);
                tableColumn.setMaxWidth(90);
            } else {
                tableColumn.setMinWidth(70);
                tableColumn.setPrefWidth(110);
            }
            table.getColumns().add(tableColumn);
        }
        if (rowActionHandler != null) {
            table.getColumns().add(actionColumn());
        }
    }

    public void setRows(List<RowItem> rows) {
        items.setAll(rows == null ? List.of() : rows);
    }

    public void setPlaceholderText(String text) {
        placeholder.setText(text == null ? "" : text);
    }

    public void setOnRowOpen(LongConsumer handler) {
        rowOpenHandler = handler;
    }

    public void setRowAction(String label, String tooltip, LongConsumer handler) {
        rowActionLabel = label == null ? "" : label;
        rowActionTooltip = tooltip == null ? "" : tooltip;
        rowActionHandler = handler;
        List<ColumnItem> existingColumns = table.getColumns().stream()
                .map(TableColumn::getUserData)
                .filter(ColumnItem.class::isInstance)
                .map(ColumnItem.class::cast)
                .toList();
        if (!existingColumns.isEmpty()) {
            setColumns(existingColumns);
        }
    }

    private void fireOpen(long id) {
        if (rowOpenHandler != null) {
            rowOpenHandler.accept(id);
        }
    }

    private TableColumn<RowItem, Void> actionColumn() {
        TableColumn<RowItem, Void> column = new TableColumn<>("");
        column.setUserData("action");
        column.setMinWidth(64);
        column.setPrefWidth(72);
        column.setMaxWidth(82);
        column.setSortable(false);
        column.setCellFactory(ignored -> new TableCell<>() {
            private final Button button = new Button();

            {
                button.getStyleClass().addAll("accent", "compact");
                button.setTooltip(new Tooltip(rowActionTooltip));
                button.setOnAction(event -> {
                    RowItem row = getTableRow() == null ? null : getTableRow().getItem();
                    if (row != null && rowActionHandler != null) {
                        rowActionHandler.accept(row.id());
                    }
                });
            }

            @Override
            protected void updateItem(Void value, boolean empty) {
                super.updateItem(null, empty);
                RowItem row = getTableRow() == null ? null : getTableRow().getItem();
                if (empty || row == null) {
                    setGraphic(null);
                    return;
                }
                button.setText(rowActionLabel);
                button.setAccessibleText(rowActionLabel + ": " + row.cell(0));
                setGraphic(button);
            }
        });
        return column;
    }

    public record ColumnItem(String key, String label) {
    }

    public record RowItem(long id, List<String> cells) {
        public RowItem {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }

        String cell(int index) {
            return index >= 0 && index < cells.size() ? cells.get(index) : "";
        }
    }

    private final class LinkCell extends TableCell<RowItem, String> {

        private final Button button = new Button();

        LinkCell() {
            button.getStyleClass().addAll("creature-link", "flat");
            button.setOnAction(event -> {
                RowItem row = getTableRow() == null ? null : getTableRow().getItem();
                if (row != null) {
                    fireOpen(row.id());
                }
            });
        }

        @Override
        protected void updateItem(String value, boolean empty) {
            super.updateItem(value, empty);
            if (empty || value == null) {
                setText(null);
                setGraphic(null);
                return;
            }
            button.setText(value);
            button.setAccessibleText("Stat Block: " + value);
            setText(null);
            setGraphic(button);
        }
    }
}
