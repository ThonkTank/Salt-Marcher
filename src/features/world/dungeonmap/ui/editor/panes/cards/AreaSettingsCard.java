package features.world.dungeonmap.ui.editor.panes.cards;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.service.catalog.DungeonEncounterTableSummary;
import features.world.dungeonmap.ui.editor.panes.AreaEncounterProfileEditor;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;

public final class AreaSettingsCard {

    private final ComboBox<DungeonArea> areaCombo = new ComboBox<>();
    private final Button newAreaButton = new Button("Bereich neu");
    private final Button deleteAreaButton = new Button("Bereich löschen");
    private final AreaEncounterProfileEditor areaProfileEditor = new AreaEncounterProfileEditor();
    private final VBox root;
    private boolean updatingSelections;
    private boolean mapLoaded;
    private Consumer<DungeonArea> onAreaSelected;

    public AreaSettingsCard() {
        areaCombo.setPromptText("Bereich wählen…");
        areaCombo.setMaxWidth(Double.MAX_VALUE);
        deleteAreaButton.getStyleClass().add("danger");
        areaCombo.setOnAction(event -> {
            if (updatingSelections) {
                return;
            }
            updateSelectedAreaEditor();
            if (onAreaSelected != null) {
                onAreaSelected.accept(areaCombo.getValue());
            }
        });

        Label areaLabel = new Label("Aktiver Bereich");
        areaLabel.getStyleClass().add("text-muted");
        HBox areaActions = DungeonSidebarCards.actionRow(newAreaButton, deleteAreaButton);
        root = DungeonSidebarCards.createCard("Bereich", new VBox(8, areaLabel, areaCombo, areaActions, areaProfileEditor));
        setMapLoaded(false);
    }

    public Node root() {
        return root;
    }

    public DungeonArea selectedArea() {
        return areaCombo.getValue();
    }

    public Long selectedAreaId() {
        return selectedArea() == null ? null : selectedArea().areaId();
    }

    public void setAreas(List<DungeonArea> areas) {
        updatingSelections = true;
        DungeonArea previous = areaCombo.getValue();
        areaCombo.getItems().setAll(areas);
        areaCombo.setValue(findById(areas, previous == null ? null : previous.areaId(), areas.isEmpty() ? null : areas.get(0)));
        updatingSelections = false;
        updateSelectedAreaEditor();
    }

    public void setSelectedArea(Long areaId) {
        updatingSelections = true;
        areaCombo.setValue(findById(areaCombo.getItems(), areaId, null));
        updatingSelections = false;
        updateSelectedAreaEditor();
    }

    public void setEncounterTables(List<DungeonEncounterTableSummary> tables) {
        areaProfileEditor.setEncounterTables(tables);
    }

    public void setMapLoaded(boolean loaded) {
        mapLoaded = loaded;
        newAreaButton.setDisable(!loaded);
        deleteAreaButton.setDisable(!loaded);
        updateSelectedAreaEditor();
    }

    public void setOnAreaSelected(Consumer<DungeonArea> onAreaSelected) {
        this.onAreaSelected = onAreaSelected;
    }

    public void setOnCreateRequested(Consumer<Node> callback) {
        Consumer<Node> safeCallback = callback == null ? ignored -> { } : callback;
        newAreaButton.setOnAction(event -> safeCallback.accept(newAreaButton));
    }

    public void setOnDeleteRequested(Consumer<Node> callback) {
        Consumer<Node> safeCallback = callback == null ? ignored -> { } : callback;
        deleteAreaButton.setOnAction(event -> safeCallback.accept(deleteAreaButton));
    }

    public void setOnSaveRequested(Consumer<DungeonArea> callback) {
        areaProfileEditor.setOnSaveRequested(callback);
    }

    private void updateSelectedAreaEditor() {
        areaProfileEditor.setArea(areaCombo.getValue());
        areaProfileEditor.setEditable(mapLoaded && areaCombo.getValue() != null);
    }

    private static DungeonArea findById(List<DungeonArea> items, Long areaId, DungeonArea fallback) {
        if (areaId != null) {
            for (DungeonArea area : items) {
                if (areaId.equals(area.areaId())) {
                    return area;
                }
            }
        }
        return fallback;
    }
}
