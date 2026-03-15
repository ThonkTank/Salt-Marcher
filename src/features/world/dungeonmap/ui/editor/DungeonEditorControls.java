package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.ui.shared.cell.DungeonMapSelectorController;
import features.world.dungeonmap.ui.shared.workspace.DungeonViewMode;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonEditorControls extends VBox {

    private final ComboBox<DungeonMap> mapSelector = new ComboBox<>();
    private final DungeonMapSelectorController mapSelectorController = new DungeonMapSelectorController(mapSelector);
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
        setFillWidth(true);
        setMaxWidth(Double.MAX_VALUE);
        mapSelector.setPrefWidth(220);
        mapSelector.setMaxWidth(Double.MAX_VALUE);

        gridButton.getStyleClass().add("tool-btn");
        graphButton.getStyleClass().add("tool-btn");
        reloadButton.setMinWidth(Region.USE_PREF_SIZE);
        gridButton.setMinWidth(Region.USE_PREF_SIZE);
        graphButton.setMinWidth(Region.USE_PREF_SIZE);
        gridButton.setToggleGroup(viewGroup);
        graphButton.setToggleGroup(viewGroup);
        gridButton.setSelected(true);

        Label mapLabel = sectionLabel("Dungeon");
        HBox mapRow = new HBox(8, mapSelector, reloadButton, gridButton, graphButton);
        mapRow.setAlignment(Pos.CENTER_LEFT);
        mapRow.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(mapSelector, Priority.ALWAYS);
        VBox mapGroup = new VBox(6, mapLabel, mapRow);
        mapGroup.setMaxWidth(Double.MAX_VALUE);
        mapGroup.getStyleClass().add("editor-toolbar-group");

        selectionLabel.setMaxWidth(Double.MAX_VALUE);
        getChildren().addAll(mapGroup, selectionLabel);

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
        mapSelectorController.setMaps(maps);
    }

    public void selectMap(Long mapId) {
        mapSelectorController.selectMap(mapId);
    }

    public void setOnMapSelected(Consumer<Long> onMapSelected) {
        mapSelectorController.setOnMapSelected(onMapSelected);
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
