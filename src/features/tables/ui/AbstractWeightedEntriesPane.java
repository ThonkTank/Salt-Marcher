package features.tables.ui;

import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;

import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.ToIntFunction;
import java.util.function.ToLongFunction;

public abstract class AbstractWeightedEntriesPane<E> extends BorderPane {

    protected final ObservableList<E> items = FXCollections.observableArrayList();
    protected final TableView<E> table = new TableView<>(items);

    private Consumer<Long> onRemoveEntry;
    private BiConsumer<Long, Integer> onUpdateWeight;

    protected AbstractWeightedEntriesPane(String titleText, String emptyText) {
        setPadding(new Insets(8));

        Label titleLabel = new Label(titleText);
        titleLabel.getStyleClass().addAll("section-header", "text-muted");
        titleLabel.setPadding(new Insets(0, 0, 4, 0));

        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        Label emptyLabel = new Label(emptyText);
        emptyLabel.getStyleClass().add("text-muted");
        table.setPlaceholder(emptyLabel);

        setTop(titleLabel);
        setCenter(table);
    }

    public void setEntries(List<E> entries) {
        items.setAll(entries == null ? List.of() : entries);
    }

    public void setOnRemoveEntry(Consumer<Long> callback) {
        this.onRemoveEntry = callback;
    }

    public void setOnUpdateWeight(BiConsumer<Long, Integer> callback) {
        this.onUpdateWeight = callback;
    }

    protected TableColumn<E, String> textColumn(String title, Function<E, String> textProvider) {
        TableColumn<E, String> column = new TableColumn<>(title);
        column.setCellValueFactory(cd -> new SimpleStringProperty(textProvider.apply(cd.getValue())));
        return column;
    }

    protected TableColumn<E, String> createLinkColumn(
            String title,
            String buttonStyleClass,
            String accessiblePrefix,
            Function<E, String> labelProvider,
            ToLongFunction<E> idProvider,
            Consumer<Long> requestHandler) {
        TableColumn<E, String> column = textColumn(title, labelProvider);
        column.setCellFactory(col -> new TableCell<>() {
            private final Button button = new Button();
            {
                button.getStyleClass().addAll(buttonStyleClass, "flat");
                button.setOnAction(event -> {
                    if (getIndex() < 0 || getIndex() >= getTableView().getItems().size()) {
                        return;
                    }
                    E entry = getTableView().getItems().get(getIndex());
                    if (requestHandler != null) {
                        requestHandler.accept(idProvider.applyAsLong(entry));
                    }
                });
            }

            @Override
            protected void updateItem(String item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || item == null) {
                    setText(null);
                    setGraphic(null);
                    return;
                }
                setText(null);
                button.setText(item);
                button.setAccessibleText(accessiblePrefix + item);
                setGraphic(button);
            }
        });
        return column;
    }

    protected TableColumn<E, Void> createWeightColumn(
            ToLongFunction<E> idProvider,
            ToIntFunction<E> weightProvider,
            BiFunction<E, Integer, E> withWeight) {
        TableColumn<E, Void> column = new TableColumn<>("Gewicht");
        column.setSortable(false);
        column.setCellFactory(col -> new TableCell<>() {
            private final Button minus = new Button("\u2212");
            private final Label weightLabel = new Label();
            private final Button plus = new Button("+");
            private final HBox box = new HBox(2, minus, weightLabel, plus);
            {
                box.setAlignment(Pos.CENTER);
                minus.getStyleClass().addAll("compact", "flat");
                plus.getStyleClass().addAll("compact", "flat");
                weightLabel.setMinWidth(18);
                weightLabel.setAlignment(Pos.CENTER);
                minus.setOnAction(event -> adjustWeight(-1));
                plus.setOnAction(event -> adjustWeight(1));
            }

            private void adjustWeight(int delta) {
                if (onUpdateWeight == null || getIndex() < 0 || getIndex() >= items.size()) {
                    return;
                }
                E entry = items.get(getIndex());
                long entryId = idProvider.applyAsLong(entry);
                if (isWeightPending(entryId)) {
                    return;
                }
                int currentWeight = weightProvider.applyAsInt(entry);
                int nextWeight = Math.max(1, Math.min(10, currentWeight + delta));
                if (nextWeight == currentWeight) {
                    return;
                }
                items.set(getIndex(), withWeight.apply(entry, nextWeight));
                if (onUpdateWeight != null) {
                    onUpdateWeight.accept(entryId, nextWeight);
                }
            }

            @Override
            protected void updateItem(Void item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || getIndex() < 0 || getIndex() >= items.size()) {
                    setGraphic(null);
                    return;
                }
                E entry = items.get(getIndex());
                long entryId = idProvider.applyAsLong(entry);
                int weight = weightProvider.applyAsInt(entry);
                boolean pending = onUpdateWeight == null || isWeightPending(entryId);
                weightLabel.setText(String.valueOf(weight));
                minus.setDisable(pending || weight <= 1);
                plus.setDisable(pending || weight >= 10);
                setGraphic(box);
            }
        });
        return column;
    }

    protected TableColumn<E, Void> createRemoveColumn(String tooltipText, ToLongFunction<E> idProvider) {
        TableColumn<E, Void> column = new TableColumn<>("");
        column.setSortable(false);
        column.setCellFactory(col -> new TableCell<>() {
            private final Button button = new Button("\u2715");
            {
                button.getStyleClass().addAll("compact", "flat");
                button.setTooltip(new Tooltip(tooltipText));
                button.setOnAction(event -> {
                    if (getIndex() < 0 || getIndex() >= items.size()) {
                        return;
                    }
                    E entry = items.get(getIndex());
                    if (onRemoveEntry != null) {
                        onRemoveEntry.accept(idProvider.applyAsLong(entry));
                    }
                });
            }

            @Override
            protected void updateItem(Void item, boolean empty) {
                super.updateItem(item, empty);
                setGraphic(empty ? null : button);
            }
        });
        return column;
    }

    protected boolean isWeightPending(long entryId) {
        return false;
    }
}
