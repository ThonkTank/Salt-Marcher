package src.view.tabs.catalog;

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
import javafx.scene.input.KeyCode;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;

public final class CatalogMainView extends VBox {

    private final ObservableList<RowItem> items = FXCollections.observableArrayList();
    private final TableView<RowItem> table = new TableView<>(items);
    private final Label placeholder = new Label("Lade Monster...");
    private @Nullable LongConsumer rowOpenHandler;

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

    private void fireOpen(long id) {
        if (rowOpenHandler != null) {
            rowOpenHandler.accept(id);
        }
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
