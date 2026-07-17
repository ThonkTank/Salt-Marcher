package features.catalog.adapter.javafx;

import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;
import java.util.function.Function;
import javafx.beans.property.SimpleStringProperty;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;

/** Shared catalog table chrome for provider-owned reference rows. */
final class CatalogSectionFrame<T> extends BorderPane {

    private final String resultLabel;
    private final Function<T, String> searchableText;
    private final Consumer<T> primaryAction;
    private final Label count = new Label();
    private final Label status = new Label();
    private final TableView<T> table = new TableView<>();
    private List<T> source = List.of();
    private String query = "";

    CatalogSectionFrame(
            String resultLabel,
            String emptyText,
            Function<T, String> searchableText,
            Consumer<T> primaryAction,
            String createLabel,
            Runnable create
    ) {
        this.resultLabel = resultLabel;
        this.searchableText = searchableText;
        this.primaryAction = primaryAction;
        getStyleClass().add("surface-root");
        count.getStyleClass().add("text-secondary");
        status.getStyleClass().add("text-muted");
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        table.setPlaceholder(new Label(emptyText));
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
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox header = new HBox(8, count, spacer);
        if (createLabel != null && !createLabel.isBlank()) {
            Button createButton = new Button(createLabel);
            createButton.getStyleClass().addAll("accent", "compact");
            createButton.setOnAction(ignored -> create.run());
            header.getChildren().add(createButton);
        }
        header.getStyleClass().add("catalog-main-topbar");
        HBox footer = new HBox(8, status);
        footer.setPadding(new Insets(8));
        setTop(header);
        setCenter(table);
        setBottom(footer);
    }

    void addTextColumn(String title, double width, Function<T, String> value) {
        TableColumn<T, String> column = new TableColumn<>(title);
        column.setPrefWidth(width);
        column.setCellValueFactory(cell -> new SimpleStringProperty(shown(value.apply(cell.getValue()))));
        table.getColumns().add(column);
    }

    void addActionColumn(String title, String buttonText, Consumer<T> action) {
        TableColumn<T, T> column = new TableColumn<>(title);
        column.setSortable(false);
        column.setPrefWidth(150);
        column.setCellValueFactory(cell -> new javafx.beans.property.ReadOnlyObjectWrapper<>(cell.getValue()));
        column.setCellFactory(ignored -> new TableCell<>() {
            private final Button button = actionButton(buttonText);
            {
                button.setOnAction(event -> {
                    T item = getItem();
                    if (item != null) {
                        action.accept(item);
                    }
                });
            }

            @Override
            protected void updateItem(T item, boolean empty) {
                super.updateItem(item, empty);
                setGraphic(empty || item == null ? null : button);
            }
        });
        table.getColumns().add(column);
    }

    void apply(List<T> values) {
        source = values == null ? List.of() : List.copyOf(values);
        refilter();
    }

    void setQuery(String nextQuery) {
        query = nextQuery == null ? "" : nextQuery.trim().toLowerCase(Locale.ROOT);
        refilter();
    }

    TableView<T> table() {
        return table;
    }

    void setStatus(String message) {
        status.setText(message == null ? "" : message);
    }

    private void refilter() {
        List<T> filtered = query.isBlank()
                ? source
                : source.stream()
                        .filter(value -> shown(searchableText.apply(value)).toLowerCase(Locale.ROOT).contains(query))
                        .toList();
        table.getItems().setAll(filtered);
        count.setText(filtered.size() + " " + resultLabel + " gefunden");
    }

    private void openSelected() {
        T selected = table.getSelectionModel().getSelectedItem();
        if (selected != null) {
            primaryAction.accept(selected);
        }
    }

    private static Button actionButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().addAll("accent", "compact");
        return button;
    }

    private static String shown(String value) {
        return value == null || value.isBlank() ? "–" : value;
    }
}
