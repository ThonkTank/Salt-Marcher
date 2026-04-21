package src.view.slotcontent.main.catalog;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.LongConsumer;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.SelectionMode;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import org.jspecify.annotations.Nullable;

public final class CatalogMainView extends BorderPane {

    private final ObservableList<RowItem> items = FXCollections.observableArrayList();
    private final TableView<RowItem> table = new TableView<>(items);
    private final Label placeholder = new Label("Lade Monster...");
    private final Label countLabel = new Label("0 Monster gefunden");
    private final Label pageLabel = new Label("Seite 1 / 1");
    private final Button previousButton = new Button("◀ Zurück");
    private final Button nextButton = new Button("Weiter ▶");
    private final ComboBox<SortSelection> sortCombo = new ComboBox<>();
    private @Nullable LongConsumer rowOpenHandler;
    private @Nullable LongConsumer rowActionHandler;
    private @Nullable Consumer<String> sortChangedHandler;
    private @Nullable Runnable previousPageHandler;
    private @Nullable Runnable nextPageHandler;
    private String rowActionLabel = "";
    private String rowActionTooltip = "";
    private boolean suppressSortEvents;

    public CatalogMainView() {
        getStyleClass().add("surface-root");
        setPadding(new Insets(8));

        HBox topBar = new HBox(8);
        topBar.setAlignment(Pos.CENTER_LEFT);
        topBar.setPadding(new Insets(0, 0, 6, 0));
        countLabel.getStyleClass().add("text-secondary");
        pageLabel.getStyleClass().add("text-secondary");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        Label sortLabel = new Label("Sortierung:");
        sortLabel.getStyleClass().add("text-muted");
        sortCombo.setOnAction(event -> {
            SortSelection selection = sortCombo.getValue();
            if (!suppressSortEvents && selection != null && sortChangedHandler != null) {
                sortChangedHandler.accept(selection.key());
            }
        });
        topBar.getChildren().addAll(countLabel, spacer, sortLabel, sortCombo);
        setTop(topBar);

        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        table.getSelectionModel().setSelectionMode(SelectionMode.SINGLE);
        table.setPlaceholder(placeholder);
        table.setOnKeyPressed(event -> {
            RowItem row = table.getSelectionModel().getSelectedItem();
            if (row == null) {
                return;
            }
            if (event.getCode() == KeyCode.ENTER && !event.isShiftDown()) {
                fireOpen(row.id());
                event.consume();
            } else if (event.getCode() == KeyCode.ENTER && event.isShiftDown()) {
                if (rowActionHandler != null) {
                    rowActionHandler.accept(row.id());
                }
                event.consume();
            }
        });
        setCenter(table);

        previousButton.setOnAction(event -> {
            if (previousPageHandler != null) {
                previousPageHandler.run();
            }
        });
        nextButton.setOnAction(event -> {
            if (nextPageHandler != null) {
                nextPageHandler.run();
            }
        });
        HBox pagination = new HBox(8, previousButton, pageLabel, nextButton);
        pagination.setAlignment(Pos.CENTER);
        pagination.setPadding(new Insets(6, 0, 0, 0));
        setBottom(pagination);
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
            configureColumn(tableColumn, column, index);
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

    public void setSortOptions(List<SortSelection> selections) {
        sortCombo.setItems(FXCollections.observableArrayList(selections == null ? List.of() : selections));
    }

    public void selectSort(String key) {
        suppressSortEvents = true;
        for (SortSelection selection : sortCombo.getItems()) {
            if (selection.key().equals(key)) {
                sortCombo.getSelectionModel().select(selection);
                suppressSortEvents = false;
                return;
            }
        }
        suppressSortEvents = false;
    }

    public StringProperty countTextProperty() {
        return countLabel.textProperty();
    }

    public StringProperty pageTextProperty() {
        return pageLabel.textProperty();
    }

    public BooleanProperty previousDisableProperty() {
        return previousButton.disableProperty();
    }

    public BooleanProperty nextDisableProperty() {
        return nextButton.disableProperty();
    }

    public void setOnSortChanged(Consumer<String> handler) {
        sortChangedHandler = handler;
    }

    public void setOnPreviousPage(Runnable handler) {
        previousPageHandler = handler;
    }

    public void setOnNextPage(Runnable handler) {
        nextPageHandler = handler;
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

    private void configureColumn(TableColumn<RowItem, String> column, ColumnItem item, int index) {
        if (index == 0) {
            column.setMinWidth(120);
            column.setPrefWidth(200);
            column.setCellFactory(ignored -> new LinkCell());
        } else if ("cr".equals(item.key())) {
            column.setMinWidth(40);
            column.setPrefWidth(50);
            column.setMaxWidth(60);
        } else if ("type".equals(item.key())) {
            column.setMinWidth(80);
            column.setPrefWidth(110);
            column.setMaxWidth(150);
        } else if ("size".equals(item.key())) {
            column.setMinWidth(65);
            column.setPrefWidth(85);
            column.setMaxWidth(100);
        } else if ("xp".equals(item.key())) {
            column.setMinWidth(45);
            column.setPrefWidth(60);
            column.setMaxWidth(75);
        } else {
            column.setMinWidth(70);
            column.setPrefWidth(110);
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
        column.setMinWidth(55);
        column.setPrefWidth(65);
        column.setMaxWidth(75);
        column.setSortable(false);
        column.setCellFactory(ignored -> new TableCell<>() {
            private final Button button = new Button();
            private final Tooltip tooltip = new Tooltip();

            {
                button.getStyleClass().addAll("accent", "compact");
                button.setTooltip(tooltip);
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
                tooltip.setText(rowActionTooltip);
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

    public record SortSelection(String key, String label) {
        @Override
        public String toString() {
            return label;
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
