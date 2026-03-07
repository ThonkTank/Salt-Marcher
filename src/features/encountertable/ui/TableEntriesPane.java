package features.encountertable.ui;

import features.encountertable.model.EncounterTable;
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
import java.util.function.Consumer;

/**
 * State panel for the encounter table editor.
 * Shows the entries (creatures) in the currently selected encounter table.
 * Weight (1–10) is adjustable via −/+ buttons; changes are reported via onUpdateWeight.
 */
public class TableEntriesPane extends BorderPane {

    private final TableView<EncounterTable.Entry> table;
    private final ObservableList<EncounterTable.Entry> items = FXCollections.observableArrayList();

    private Consumer<Long> onRemoveEntry;
    private BiConsumer<Long, Integer> onUpdateWeight;
    private Consumer<Long> onRequestStatBlock;

    public TableEntriesPane() {
        setPadding(new Insets(8));

        Label titleLabel = new Label("EINTR\u00c4GE");
        titleLabel.getStyleClass().addAll("section-header", "text-muted");
        titleLabel.setPadding(new Insets(0, 0, 4, 0));

        table = new TableView<>(items);
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        Label emptyLabel = new Label("Keine Eintr\u00e4ge");
        emptyLabel.getStyleClass().add("text-muted");
        table.setPlaceholder(emptyLabel);

        TableColumn<EncounterTable.Entry, String> nameCol = new TableColumn<>("Name");
        nameCol.setCellValueFactory(cd -> new SimpleStringProperty(cd.getValue().creatureName()));
        nameCol.setMinWidth(100);
        nameCol.setCellFactory(col -> new TableCell<>() {
            private final Button btn = new Button();
            {
                btn.getStyleClass().addAll("creature-link", "flat");
                btn.setOnAction(e -> {
                    if (getIndex() < 0 || getIndex() >= getTableView().getItems().size()) return;
                    EncounterTable.Entry entry = getTableView().getItems().get(getIndex());
                    if (onRequestStatBlock != null) onRequestStatBlock.accept(entry.creatureId());
                });
            }
            @Override
            protected void updateItem(String name, boolean empty) {
                super.updateItem(name, empty);
                if (empty || name == null) { setText(null); setGraphic(null); return; }
                btn.setText(name);
                btn.setAccessibleText("Stat Block: " + name);
                setGraphic(btn);
            }
        });

        TableColumn<EncounterTable.Entry, String> crCol = new TableColumn<>("CR");
        crCol.setCellValueFactory(cd -> new SimpleStringProperty(cd.getValue().crDisplay()));
        crCol.setMinWidth(35);
        crCol.setMaxWidth(50);

        // Weight column: − label + buttons
        TableColumn<EncounterTable.Entry, Void> weightCol = new TableColumn<>("Gewicht");
        weightCol.setMinWidth(80);
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
                weightLabel.setMinWidth(18);
                weightLabel.setAlignment(Pos.CENTER);
                minus.setOnAction(e -> adjustWeight(-1));
                plus.setOnAction(e -> adjustWeight(1));
            }

            private void adjustWeight(int delta) {
                if (getIndex() < 0 || getIndex() >= getTableView().getItems().size()) return;
                EncounterTable.Entry entry = getTableView().getItems().get(getIndex());
                int newWeight = Math.max(1, Math.min(10, entry.weight() + delta));
                if (newWeight == entry.weight()) return;
                // Optimistic update
                items.set(getIndex(), new EncounterTable.Entry(
                        entry.creatureId(), entry.creatureName(), entry.creatureType(),
                        entry.crDisplay(), entry.xp(), newWeight));
                if (onUpdateWeight != null) onUpdateWeight.accept(entry.creatureId(), newWeight);
            }

            @Override
            protected void updateItem(Void v, boolean empty) {
                super.updateItem(v, empty);
                if (empty || getIndex() < 0 || getIndex() >= getTableView().getItems().size()) {
                    setGraphic(null);
                    return;
                }
                EncounterTable.Entry entry = getTableView().getItems().get(getIndex());
                weightLabel.setText(String.valueOf(entry.weight()));
                minus.setDisable(entry.weight() <= 1);
                plus.setDisable(entry.weight() >= 10);
                setGraphic(box);
            }
        });

        TableColumn<EncounterTable.Entry, Void> removeCol = new TableColumn<>("");
        removeCol.setMinWidth(45);
        removeCol.setMaxWidth(55);
        removeCol.setSortable(false);
        removeCol.setCellFactory(col -> new TableCell<>() {
            private final Button btn = new Button("\u2715");
            {
                btn.getStyleClass().addAll("compact", "flat");
                btn.setTooltip(new Tooltip("Aus Tabelle entfernen"));
                btn.setOnAction(e -> {
                    if (getIndex() < 0 || getIndex() >= getTableView().getItems().size()) return;
                    EncounterTable.Entry entry = getTableView().getItems().get(getIndex());
                    if (onRemoveEntry != null) onRemoveEntry.accept(entry.creatureId());
                });
            }
            @Override
            protected void updateItem(Void v, boolean empty) {
                super.updateItem(v, empty);
                setGraphic(empty ? null : btn);
            }
        });

        table.getColumns().addAll(nameCol, crCol, weightCol, removeCol);

        setTop(titleLabel);
        setCenter(table);
    }

    public void setEntries(List<EncounterTable.Entry> entries) {
        items.setAll(entries != null ? entries : List.of());
    }

    public void setOnRemoveEntry(Consumer<Long> cb) { this.onRemoveEntry = cb; }
    public void setOnUpdateWeight(BiConsumer<Long, Integer> cb) { this.onUpdateWeight = cb; }
    public void setOnRequestStatBlock(Consumer<Long> cb) { this.onRequestStatBlock = cb; }
}
