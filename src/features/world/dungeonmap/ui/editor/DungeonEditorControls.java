package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.ui.shared.DungeonViewMode;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonEditorControls extends VBox {

    private final ComboBox<DungeonMap> mapSelector = new ComboBox<>();
    private final Button reloadButton = new Button("Neu laden");
    private final Label selectionLabel = new Label("Kein Raum gewählt");
    private final ToggleGroup viewGroup = new ToggleGroup();
    private final ToggleButton gridButton = new ToggleButton(DungeonViewMode.GRID.label());
    private final ToggleButton graphButton = new ToggleButton(DungeonViewMode.GRAPH.label());
    private Consumer<DungeonViewMode> onViewModeChanged;
    private boolean updatingViewMode;

    public DungeonEditorControls() {
        getStyleClass().add("dungeon-editor-toolbar");
        setSpacing(10);
        setPadding(new Insets(12));
        mapSelector.setMaxWidth(Double.MAX_VALUE);
        mapSelector.setCellFactory(list -> new DungeonMapCell());
        mapSelector.setButtonCell(new DungeonMapCell());

        gridButton.getStyleClass().add("tool-btn");
        graphButton.getStyleClass().add("tool-btn");
        gridButton.setToggleGroup(viewGroup);
        graphButton.setToggleGroup(viewGroup);
        gridButton.setSelected(true);

        Label mapLabel = sectionLabel("Dungeon");
        HBox mapRow = new HBox(8, mapSelector, reloadButton);
        mapRow.setAlignment(Pos.CENTER_LEFT);
        HBox.setHgrow(mapSelector, Priority.ALWAYS);
        VBox mapGroup = new VBox(6, mapLabel, mapRow);
        mapGroup.getStyleClass().add("editor-toolbar-group");

        Label viewLabel = sectionLabel("Ansicht");
        HBox viewRow = new HBox(6, gridButton, graphButton);
        viewRow.setAlignment(Pos.CENTER_LEFT);
        VBox viewGroupBox = new VBox(6, viewLabel, viewRow);
        viewGroupBox.getStyleClass().add("editor-toolbar-group");

        getChildren().addAll(mapGroup, viewGroupBox, selectionLabel);

        viewGroup.selectedToggleProperty().addListener((obs, oldToggle, newToggle) -> {
            if (updatingViewMode) {
                return;
            }
            if (newToggle == null) {
                updatingViewMode = true;
                if (oldToggle != null) {
                    oldToggle.setSelected(true);
                } else {
                    gridButton.setSelected(true);
                }
                updatingViewMode = false;
                return;
            }
            if (onViewModeChanged != null) {
                onViewModeChanged.accept(newToggle == graphButton ? DungeonViewMode.GRAPH : DungeonViewMode.GRID);
            }
        });
    }

    public void setMaps(List<DungeonMap> maps) {
        mapSelector.getItems().setAll(maps);
    }

    public void selectMap(Long mapId) {
        if (mapId == null) {
            mapSelector.getSelectionModel().clearSelection();
            return;
        }
        for (DungeonMap map : mapSelector.getItems()) {
            if (map.mapId() != null && map.mapId().equals(mapId)) {
                mapSelector.getSelectionModel().select(map);
                return;
            }
        }
    }

    public void setOnMapSelected(Consumer<Long> onMapSelected) {
        mapSelector.setOnAction(event -> {
            DungeonMap map = mapSelector.getSelectionModel().getSelectedItem();
            if (map != null) {
                onMapSelected.accept(map.mapId());
            }
        });
    }

    public void setOnReloadRequested(Runnable onReloadRequested) {
        reloadButton.setOnAction(event -> onReloadRequested.run());
    }

    public void setOnViewModeChanged(Consumer<DungeonViewMode> onViewModeChanged) {
        this.onViewModeChanged = onViewModeChanged;
    }

    public void selectViewMode(DungeonViewMode viewMode) {
        updatingViewMode = true;
        if (viewMode == DungeonViewMode.GRAPH) {
            graphButton.setSelected(true);
        } else {
            gridButton.setSelected(true);
        }
        updatingViewMode = false;
    }

    public void setSelectionText(String text) {
        selectionLabel.setText(text);
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }
}
