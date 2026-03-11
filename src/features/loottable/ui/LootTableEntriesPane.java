package features.loottable.ui;

import features.loottable.model.LootTable;
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
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

public class LootTableEntriesPane extends BorderPane {
    private final ObservableList<LootTable.Entry> items = FXCollections.observableArrayList();
    private final TableView<LootTable.Entry> table = new TableView<>(items);
    private Set<Long> pendingWeightItemIds = Set.of();
    private Consumer<Long> onRemoveEntry;
    private BiConsumer<Long, Integer> onUpdateWeight;
    private Consumer<Long> onRequestItem;

    public LootTableEntriesPane() {
        setPadding(new Insets(8));
        Label titleLabel = new Label("EINTRÄGE");
        titleLabel.getStyleClass().addAll("section-header", "text-muted");
        titleLabel.setPadding(new Insets(0, 0, 4, 0));

        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        Label emptyLabel = new Label("Keine Einträge");
        emptyLabel.getStyleClass().add("text-muted");
        table.setPlaceholder(emptyLabel);

        TableColumn<LootTable.Entry, String> nameCol = new TableColumn<>("Item");
        nameCol.setCellValueFactory(cd -> new SimpleStringProperty(cd.getValue().itemName()));
        nameCol.setCellFactory(col -> new TableCell<>() {
            private final Button btn = new Button();
            {
                btn.getStyleClass().addAll("item-link", "flat");
                btn.setOnAction(e -> {
                    if (getIndex() < 0 || getIndex() >= getTableView().getItems().size()) return;
                    LootTable.Entry entry = getTableView().getItems().get(getIndex());
                    if (onRequestItem != null) onRequestItem.accept(entry.itemId());
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
                btn.setText(item);
                btn.setAccessibleText("Item anzeigen: " + item);
                setGraphic(btn);
            }
        });

        TableColumn<LootTable.Entry, String> metaCol = new TableColumn<>("Typ");
        metaCol.setCellValueFactory(cd -> new SimpleStringProperty(metaText(cd.getValue())));

        TableColumn<LootTable.Entry, String> costCol = new TableColumn<>("Wert");
        costCol.setCellValueFactory(cd -> new SimpleStringProperty(costText(cd.getValue())));
        costCol.setMaxWidth(110);

        TableColumn<LootTable.Entry, Void> weightCol = new TableColumn<>("Gewicht");
        weightCol.setMaxWidth(95);
        weightCol.setSortable(false);
        weightCol.setCellFactory(col -> new TableCell<>() {
            private final Button minus = new Button("\u2212");
            private final Label weightLabel = new Label();
            private final Button plus = new Button("+");
            private final HBox box = new HBox(2, minus, weightLabel, plus);
            {
                box.setAlignment(Pos.CENTER);
                minus.getStyleClass().addAll("compact", "flat");
                plus.getStyleClass().addAll("compact", "flat");
                minus.setOnAction(e -> adjustWeight(-1));
                plus.setOnAction(e -> adjustWeight(1));
            }

            private void adjustWeight(int delta) {
                if (getIndex() < 0 || getIndex() >= items.size()) return;
                LootTable.Entry entry = items.get(getIndex());
                int newWeight = Math.max(1, Math.min(10, entry.weight() + delta));
                if (newWeight == entry.weight()) return;
                items.set(getIndex(), new LootTable.Entry(
                        entry.itemId(), entry.itemName(), entry.category(), entry.rarity(),
                        entry.costCp(), entry.costDisplay(), newWeight));
                if (onUpdateWeight != null) onUpdateWeight.accept(entry.itemId(), newWeight);
            }

            @Override
            protected void updateItem(Void item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || getIndex() < 0 || getIndex() >= items.size()) {
                    setGraphic(null);
                    return;
                }
                LootTable.Entry entry = items.get(getIndex());
                boolean pending = pendingWeightItemIds.contains(entry.itemId());
                weightLabel.setText(String.valueOf(entry.weight()));
                minus.setDisable(pending || entry.weight() <= 1);
                plus.setDisable(pending || entry.weight() >= 10);
                setGraphic(box);
            }
        });

        TableColumn<LootTable.Entry, Void> removeCol = new TableColumn<>("");
        removeCol.setMaxWidth(55);
        removeCol.setSortable(false);
        removeCol.setCellFactory(col -> new TableCell<>() {
            private final Button btn = new Button("\u2715");
            {
                btn.getStyleClass().addAll("compact", "flat");
                btn.setTooltip(new Tooltip("Aus Tabelle entfernen"));
                btn.setOnAction(e -> {
                    if (getIndex() < 0 || getIndex() >= items.size()) return;
                    LootTable.Entry entry = items.get(getIndex());
                    if (onRemoveEntry != null) onRemoveEntry.accept(entry.itemId());
                });
            }

            @Override
            protected void updateItem(Void item, boolean empty) {
                super.updateItem(item, empty);
                setGraphic(empty ? null : btn);
            }
        });

        table.getColumns().addAll(nameCol, metaCol, costCol, weightCol, removeCol);
        setTop(titleLabel);
        setCenter(table);
    }

    public void setEntries(List<LootTable.Entry> entries) {
        items.setAll(entries == null ? List.of() : entries);
    }

    public void setPendingWeightItemIds(Set<Long> itemIds) {
        pendingWeightItemIds = itemIds == null ? Set.of() : Set.copyOf(itemIds);
        table.refresh();
    }

    public void setOnRemoveEntry(Consumer<Long> cb) { this.onRemoveEntry = cb; }
    public void setOnUpdateWeight(BiConsumer<Long, Integer> cb) { this.onUpdateWeight = cb; }
    public void setOnRequestItem(Consumer<Long> cb) { this.onRequestItem = cb; }

    private static String metaText(LootTable.Entry entry) {
        String rarity = entry.rarity();
        if (rarity == null || rarity.isBlank()) return entry.category();
        return entry.category() + " · " + rarity;
    }

    private static String costText(LootTable.Entry entry) {
        if (entry.costCp() > 0) return entry.costDisplay() == null || entry.costDisplay().isBlank()
                ? entry.costCp() + " cp"
                : entry.costDisplay();
        return "0 cp";
    }
}
