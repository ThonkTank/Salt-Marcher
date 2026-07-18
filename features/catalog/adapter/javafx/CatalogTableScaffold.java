package features.catalog.adapter.javafx;

import features.catalog.application.CatalogResultState;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.SimpleStringProperty;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;

/** Shared status, table, stable-selection, paging, keyboard, and action chrome. */
public final class CatalogTableScaffold<Row, Id> extends BorderPane {

    private final Function<Row, Id> idReader;
    private final Function<Row, String> accessibleLabel;
    private final Consumer<Row> primaryAction;
    private final Consumer<Id> selectionAction;
    private final Label count = new Label();
    private final Label status = new Label();
    private final Label page = new Label();
    private final Button previous = new Button("◀ Zurück");
    private final Button next = new Button("Weiter ▶");
    private final TableView<Row> table = new TableView<>();
    private final HBox header;
    private String pageSeparator = " / ";
    private boolean rendering;

    public CatalogTableScaffold(
            String accessibleTableName,
            Function<Row, Id> idReader,
            Function<Row, String> accessibleLabel,
            List<ColumnSpec<Row>> columns,
            Consumer<Row> primaryAction,
            Consumer<Id> selectionAction,
            List<ActionSpec<Row>> actions,
            Consumer<Integer> pageAction
    ) {
        this.idReader = Objects.requireNonNull(idReader, "idReader");
        this.accessibleLabel = Objects.requireNonNull(accessibleLabel, "accessibleLabel");
        this.primaryAction = Objects.requireNonNull(primaryAction, "primaryAction");
        this.selectionAction = Objects.requireNonNull(selectionAction, "selectionAction");
        getStyleClass().add("surface-root");
        count.getStyleClass().add("text-secondary");
        status.getStyleClass().add("text-muted");
        page.getStyleClass().add("text-secondary");
        table.setAccessibleText(accessibleTableName);
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        table.setPlaceholder(new Label("Lade Einträge..."));
        table.getColumns().setAll(createColumns(columns, actions));
        table.getSelectionModel().selectedItemProperty().addListener((ignored, before, selected) -> {
            if (!rendering) {
                selectionAction.accept(selected == null ? null : idReader.apply(selected));
            }
        });
        table.setOnMouseClicked(event -> {
            if (event.getButton() == MouseButton.PRIMARY && event.getClickCount() == 2) {
                openSelected();
            }
        });
        table.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ENTER) {
                openSelected();
                event.consume();
            }
        });
        previous.setOnAction(ignored -> pageAction.accept(-1));
        next.setOnAction(ignored -> pageAction.accept(1));
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        header = new HBox(8, count, spacer, status);
        header.getStyleClass().add("catalog-main-topbar");
        HBox footer = new HBox(8, previous, page, next);
        footer.getStyleClass().add("catalog-main-pagination");
        setTop(header);
        setCenter(table);
        setBottom(footer);
    }

    public void render(
            CatalogResultState<Row> results,
            Id selectedId,
            int totalCount,
            int pageSize,
            int pageOffset,
            String resultLabel
    ) {
        CatalogResultState<Row> safe = Objects.requireNonNull(results, "results");
        rendering = true;
        try {
            table.getItems().setAll(safe.rows());
            table.getSelectionModel().clearSelection();
            if (selectedId != null) {
                table.getItems().stream()
                        .filter(row -> selectedId.equals(idReader.apply(row)))
                        .findFirst()
                        .ifPresent(table.getSelectionModel()::select);
            }
        } finally {
            rendering = false;
        }
        int currentPage = totalCount == 0 ? 1 : (pageOffset / pageSize) + 1;
        int pageCount = totalCount == 0 ? 1 : (int) Math.ceil((double) totalCount / pageSize);
        count.setText(totalCount + " " + resultLabel + " gefunden");
        page.setText("Seite " + currentPage + pageSeparator + pageCount);
        previous.setDisable(pageOffset <= 0 || safe.status() == CatalogResultState.Status.LOADING);
        next.setDisable(pageOffset + pageSize >= totalCount || safe.status() == CatalogResultState.Status.LOADING);
        status.setText(statusText(safe));
        if (table.getPlaceholder() instanceof Label placeholder) {
            placeholder.setText(placeholderText(safe));
        }
    }

    public TableView<Row> table() {
        return table;
    }

    public void setHeaderControl(javafx.scene.Node control) {
        if (control != null && !header.getChildren().contains(control)) {
            header.getChildren().add(control);
        }
    }

    public void configurePaging(
            String previousText,
            String previousAccessibleText,
            String nextText,
            String nextAccessibleText,
            String pageAccessibleText,
            String separator
    ) {
        previous.setText(Objects.requireNonNull(previousText, "previousText"));
        previous.setAccessibleText(Objects.requireNonNull(previousAccessibleText, "previousAccessibleText"));
        next.setText(Objects.requireNonNull(nextText, "nextText"));
        next.setAccessibleText(Objects.requireNonNull(nextAccessibleText, "nextAccessibleText"));
        page.setAccessibleText(Objects.requireNonNull(pageAccessibleText, "pageAccessibleText"));
        pageSeparator = Objects.requireNonNull(separator, "separator");
    }

    public void setPagingVisible(boolean visible) {
        getBottom().setVisible(visible);
        getBottom().setManaged(visible);
    }

    private void openSelected() {
        Row selected = table.getSelectionModel().getSelectedItem();
        if (selected != null) {
            primaryAction.accept(selected);
        }
    }

    private List<TableColumn<Row, ?>> createColumns(
            List<ColumnSpec<Row>> columns,
            List<ActionSpec<Row>> actions
    ) {
        java.util.ArrayList<TableColumn<Row, ?>> result = new java.util.ArrayList<>();
        List<ColumnSpec<Row>> safeColumns = List.copyOf(columns);
        for (int index = 0; index < safeColumns.size(); index++) {
            ColumnSpec<Row> spec = safeColumns.get(index);
            result.add(index == 0 ? primaryColumn(spec) : textColumn(spec));
        }
        if (!actions.isEmpty()) {
            result.add(actionColumn(List.copyOf(actions)));
        }
        return List.copyOf(result);
    }

    private TableColumn<Row, String> textColumn(ColumnSpec<Row> spec) {
        TableColumn<Row, String> column = new TableColumn<>(spec.label());
        column.setCellValueFactory(data -> new SimpleStringProperty(spec.value().apply(data.getValue())));
        return column;
    }

    private TableColumn<Row, Row> primaryColumn(ColumnSpec<Row> spec) {
        TableColumn<Row, Row> column = new TableColumn<>(spec.label());
        column.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue()));
        column.setCellFactory(ignored -> new TableCell<>() {
            private final Button open = new Button();
            {
                open.getStyleClass().addAll("creature-link", "flat");
                open.setOnAction(ignoredEvent -> {
                    Row row = getItem();
                    if (row != null) {
                        table.getSelectionModel().select(row);
                        primaryAction.accept(row);
                    }
                });
            }

            @Override
            protected void updateItem(Row row, boolean empty) {
                super.updateItem(row, empty);
                Row shown = empty ? null : row;
                open.setText(shown == null ? "" : spec.value().apply(shown));
                open.setAccessibleText(shown == null ? "" : "Öffnen: " + accessibleLabel.apply(shown));
                setGraphic(shown == null ? null : open);
            }
        });
        return column;
    }

    private TableColumn<Row, Row> actionColumn(List<ActionSpec<Row>> actions) {
        TableColumn<Row, Row> column = new TableColumn<>("");
        column.setSortable(false);
        column.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue()));
        column.setCellFactory(ignored -> new TableCell<>() {
            private final HBox buttons = new HBox(4);
            {
                for (ActionSpec<Row> action : actions) {
                    Button button = new Button(action.label());
                    button.getStyleClass().addAll(action.styleClasses());
                    button.setTooltip(new Tooltip(action.tooltip()));
                    button.setOnAction(ignoredEvent -> {
                        Row row = getItem();
                        if (row != null) {
                            table.getSelectionModel().select(row);
                            action.action().accept(row);
                        }
                    });
                    button.getProperties().put("accessibility-prefix", action.accessiblePrefix());
                    buttons.getChildren().add(button);
                }
            }

            @Override
            protected void updateItem(Row row, boolean empty) {
                super.updateItem(row, empty);
                Row shown = empty ? null : row;
                for (javafx.scene.Node node : buttons.getChildren()) {
                    Button button = (Button) node;
                    String prefix = String.valueOf(button.getProperties().get("accessibility-prefix"));
                    button.setAccessibleText(shown == null ? "" : prefix + ": " + accessibleLabel.apply(shown));
                }
                setGraphic(shown == null ? null : buttons);
            }
        });
        return column;
    }

    private static String statusText(CatalogResultState<?> result) {
        return switch (result.status()) {
            case LOADING -> "Lade...";
            case READY -> "";
            case EMPTY -> "Keine Einträge gefunden.";
            case INVALID_INPUT -> result.message().isBlank() ? "Eingabe ist ungültig." : result.message();
            case UNAVAILABLE -> result.message().isBlank() ? "Quelle ist nicht verfügbar." : result.message();
            case FAILED -> result.message().isBlank() ? "Fehler beim Laden." : result.message();
        };
    }

    private static String placeholderText(CatalogResultState<?> result) {
        String status = statusText(result);
        return status.isBlank() ? "Keine Einträge gefunden." : status;
    }

    public record ColumnSpec<Row>(String label, Function<Row, String> value) {
        public ColumnSpec {
            label = Objects.requireNonNull(label, "label");
            value = Objects.requireNonNull(value, "value");
        }
    }

    public record ActionSpec<Row>(
            String label,
            String tooltip,
            String accessiblePrefix,
            List<String> styleClasses,
            Consumer<Row> action
    ) {
        public ActionSpec {
            label = Objects.requireNonNull(label, "label");
            tooltip = Objects.requireNonNull(tooltip, "tooltip");
            accessiblePrefix = Objects.requireNonNull(accessiblePrefix, "accessiblePrefix");
            styleClasses = List.copyOf(styleClasses);
            action = Objects.requireNonNull(action, "action");
        }
    }
}
