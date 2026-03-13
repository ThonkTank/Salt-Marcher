package features.world.dungeonmap.ui.editor.panes;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonAreaEncounterTableLink;
import features.world.dungeonmap.service.catalog.DungeonEncounterTableSummary;
import features.world.dungeonmap.ui.DungeonAreaEncounterText;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.control.SpinnerValueFactory;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

final class AreaEncounterProfileEditor extends VBox {

    private final TextField areaNameField = new TextField();
    private final Spinner<Integer> encounterEveryHoursSpinner = new Spinner<>(
            new SpinnerValueFactory.IntegerSpinnerValueFactory(1, 999, DungeonArea.DEFAULT_ENCOUNTER_EVERY_HOURS));
    private final ComboBox<DungeonEncounterTableSummary> encounterTableAddCombo = new ComboBox<>();
    private final Button addEncounterTableButton = new Button("Hinzufügen");
    private final Button saveAreaProfileButton = new Button("Speichern");
    private final VBox encounterTableRows = new VBox(6);
    private final Label emptyEncounterTablesLabel = new Label("Keine Encounter-Tabellen.");

    private Consumer<DungeonArea> onSaveRequested;
    private List<DungeonEncounterTableSummary> knownEncounterTables = List.of();
    private List<DungeonAreaEncounterTableLink> editedEncounterTableLinks = List.of();
    private DungeonArea selectedArea;
    private boolean editable;
    private boolean updating;

    AreaEncounterProfileEditor() {
        setSpacing(8);

        areaNameField.setPromptText("Bereichsname");
        encounterEveryHoursSpinner.setEditable(false);
        encounterTableAddCombo.setMaxWidth(Double.MAX_VALUE);
        encounterTableAddCombo.setPromptText("Tabelle hinzufügen…");
        emptyEncounterTablesLabel.getStyleClass().add("text-muted");
        emptyEncounterTablesLabel.setWrapText(true);

        areaNameField.textProperty().addListener((obs, oldValue, newValue) -> updateSaveState());
        encounterEveryHoursSpinner.valueProperty().addListener((obs, oldValue, newValue) -> updateSaveState());
        addEncounterTableButton.setOnAction(event -> addSelectedEncounterTable());
        saveAreaProfileButton.setOnAction(event -> requestSave());

        Label areaNameLabel = new Label("Name");
        areaNameLabel.getStyleClass().add("text-muted");
        Label cadenceLabel = new Label("Encounter-Rhythmus");
        cadenceLabel.getStyleClass().add("text-muted");
        HBox cadenceRow = new HBox(6, new Label("1 Encounter alle"), encounterEveryHoursSpinner, new Label("Stunden"));
        cadenceRow.setAlignment(Pos.CENTER_LEFT);

        Label areaTablesLabel = new Label("Encounter-Tabellen");
        areaTablesLabel.getStyleClass().add("text-muted");
        HBox addRow = new HBox(8, encounterTableAddCombo, addEncounterTableButton);
        addRow.setAlignment(Pos.CENTER_LEFT);
        HBox.setHgrow(encounterTableAddCombo, Priority.ALWAYS);

        getChildren().addAll(
                areaNameLabel,
                areaNameField,
                cadenceLabel,
                cadenceRow,
                areaTablesLabel,
                addRow,
                encounterTableRows,
                actionRow(saveAreaProfileButton));

        setArea(null);
        setEditable(false);
    }

    void setArea(DungeonArea area) {
        selectedArea = area;
        updating = true;
        areaNameField.setText(area == null || area.name() == null ? "" : area.name());
        encounterEveryHoursSpinner.getValueFactory().setValue(
                area == null
                        ? DungeonArea.DEFAULT_ENCOUNTER_EVERY_HOURS
                        : Math.max(1, area.encounterEveryHours()));
        editedEncounterTableLinks = area == null ? List.of() : reindexLinks(area.encounterTableLinks());
        refreshEncounterTableChoices();
        renderEncounterTableRows();
        updating = false;
        updateDisabledState();
    }

    void setEncounterTables(List<DungeonEncounterTableSummary> tables) {
        knownEncounterTables = tables == null ? List.of() : List.copyOf(tables);
        refreshEncounterTableChoices();
        renderEncounterTableRows();
        updateDisabledState();
    }

    void setEditable(boolean editable) {
        this.editable = editable;
        updateDisabledState();
    }

    void setOnSaveRequested(Consumer<DungeonArea> onSaveRequested) {
        this.onSaveRequested = onSaveRequested;
    }

    private void refreshEncounterTableChoices() {
        List<DungeonEncounterTableSummary> available = new ArrayList<>();
        for (DungeonEncounterTableSummary table : knownEncounterTables) {
            if (!hasEncounterTable(table.tableId())) {
                available.add(table);
            }
        }
        DungeonEncounterTableSummary previous = encounterTableAddCombo.getValue();
        encounterTableAddCombo.getItems().setAll(available);
        if (previous != null && containsTable(available, previous.tableId())) {
            encounterTableAddCombo.setValue(previous);
        } else {
            encounterTableAddCombo.setValue(available.isEmpty() ? null : available.get(0));
        }
    }

    private void renderEncounterTableRows() {
        encounterTableRows.getChildren().clear();
        if (editedEncounterTableLinks.isEmpty()) {
            encounterTableRows.getChildren().add(emptyEncounterTablesLabel);
            return;
        }
        int totalWeight = DungeonAreaEncounterText.totalWeight(editedEncounterTableLinks);
        for (int i = 0; i < editedEncounterTableLinks.size(); i++) {
            encounterTableRows.getChildren().add(buildEncounterTableRow(i, editedEncounterTableLinks.get(i), totalWeight));
        }
    }

    private Node buildEncounterTableRow(int index, DungeonAreaEncounterTableLink link, int totalWeight) {
        Label tableNameLabel = new Label(resolveEncounterTableName(link.tableId()));
        tableNameLabel.setWrapText(true);
        tableNameLabel.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(tableNameLabel, Priority.ALWAYS);

        Spinner<Integer> weightSpinner = new Spinner<>(
                new SpinnerValueFactory.IntegerSpinnerValueFactory(1, 999, Math.max(1, link.weight())));
        weightSpinner.setEditable(false);
        weightSpinner.setPrefWidth(80);

        Label percentLabel = new Label(DungeonAreaEncounterText.formatPercent(link.weight(), totalWeight));
        percentLabel.getStyleClass().add("text-muted");
        percentLabel.setMinWidth(Region.USE_PREF_SIZE);

        Button removeButton = new Button("Entfernen");
        removeButton.getStyleClass().add("compact");
        removeButton.setOnAction(event -> removeEncounterTable(index));
        weightSpinner.valueProperty().addListener(
                (obs, oldValue, newValue) -> updateEncounterTableWeight(index, newValue == null ? 1 : newValue));
        weightSpinner.setDisable(!editable);
        removeButton.setDisable(!editable);

        HBox row = new HBox(8, tableNameLabel, new Label("Gewicht"), weightSpinner, percentLabel, removeButton);
        row.setAlignment(Pos.CENTER_LEFT);
        row.getStyleClass().add("editor-subsection");
        return row;
    }

    private void addSelectedEncounterTable() {
        DungeonEncounterTableSummary selectedTable = encounterTableAddCombo.getValue();
        if (selectedArea == null || selectedTable == null || hasEncounterTable(selectedTable.tableId())) {
            return;
        }
        List<DungeonAreaEncounterTableLink> updated = new ArrayList<>(editedEncounterTableLinks);
        updated.add(new DungeonAreaEncounterTableLink(selectedTable.tableId(), 1, updated.size()));
        editedEncounterTableLinks = List.copyOf(updated);
        refreshEncounterTableChoices();
        renderEncounterTableRows();
        updateSaveState();
    }

    private void removeEncounterTable(int index) {
        if (index < 0 || index >= editedEncounterTableLinks.size()) {
            return;
        }
        List<DungeonAreaEncounterTableLink> updated = new ArrayList<>(editedEncounterTableLinks);
        updated.remove(index);
        editedEncounterTableLinks = reindexLinks(updated);
        refreshEncounterTableChoices();
        renderEncounterTableRows();
        updateSaveState();
    }

    private void updateEncounterTableWeight(int index, int weight) {
        if (updating || index < 0 || index >= editedEncounterTableLinks.size()) {
            return;
        }
        List<DungeonAreaEncounterTableLink> updated = new ArrayList<>(editedEncounterTableLinks);
        DungeonAreaEncounterTableLink current = updated.get(index);
        updated.set(index, new DungeonAreaEncounterTableLink(current.tableId(), Math.max(1, weight), current.sortOrder()));
        editedEncounterTableLinks = List.copyOf(updated);
        renderEncounterTableRows();
        updateSaveState();
    }

    private void updateSaveState() {
        if (updating) {
            return;
        }
        updateDisabledState();
    }

    private void requestSave() {
        DungeonArea editedArea = buildEditedArea();
        if (onSaveRequested == null || !isDirty(editedArea) || editedArea == null) {
            return;
        }
        onSaveRequested.accept(editedArea);
    }

    private void updateDisabledState() {
        boolean areaSelected = selectedArea != null;
        areaNameField.setDisable(!areaSelected || !editable);
        encounterEveryHoursSpinner.setDisable(!areaSelected || !editable);
        encounterTableAddCombo.setDisable(!areaSelected || !editable || encounterTableAddCombo.getItems().isEmpty());
        addEncounterTableButton.setDisable(!areaSelected || !editable || encounterTableAddCombo.getValue() == null);
        saveAreaProfileButton.setDisable(!areaSelected || !editable || !isDirty(buildEditedArea()));
    }

    private boolean hasEncounterTable(Long tableId) {
        if (tableId == null) {
            return false;
        }
        for (DungeonAreaEncounterTableLink link : editedEncounterTableLinks) {
            if (tableId.equals(link.tableId())) {
                return true;
            }
        }
        return false;
    }

    private boolean containsTable(List<DungeonEncounterTableSummary> tables, Long tableId) {
        for (DungeonEncounterTableSummary table : tables) {
            if (tableId != null && tableId.equals(table.tableId())) {
                return true;
            }
        }
        return false;
    }

    private String resolveEncounterTableName(Long tableId) {
        if (tableId == null) {
            return "-";
        }
        for (DungeonEncounterTableSummary table : knownEncounterTables) {
            if (tableId.equals(table.tableId())) {
                return table.name();
            }
        }
        return "#" + tableId;
    }

    private DungeonArea buildEditedArea() {
        if (selectedArea == null) {
            return null;
        }
        return new DungeonArea(
                selectedArea.areaId(),
                selectedArea.mapId(),
                areaNameField.getText().trim(),
                encounterEveryHoursSpinner.getValue(),
                reindexLinks(editedEncounterTableLinks));
    }

    private List<DungeonAreaEncounterTableLink> reindexLinks(List<DungeonAreaEncounterTableLink> links) {
        if (links == null || links.isEmpty()) {
            return List.of();
        }
        List<DungeonAreaEncounterTableLink> normalized = new ArrayList<>(links.size());
        for (int i = 0; i < links.size(); i++) {
            DungeonAreaEncounterTableLink link = links.get(i);
            normalized.add(new DungeonAreaEncounterTableLink(link.tableId(), link.weight(), i));
        }
        return List.copyOf(normalized);
    }

    private boolean isDirty(DungeonArea editedArea) {
        if (selectedArea == null || editedArea == null) {
            return false;
        }
        return !selectedArea.equals(editedArea);
    }

    private static HBox actionRow(Button... buttons) {
        HBox row = new HBox(8, buttons);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }
}
