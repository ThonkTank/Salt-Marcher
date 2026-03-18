package features.world.dungeonmap.editor.shell.ui.controls;

import features.world.dungeonmap.editor.shell.ui.DungeonEditorControls.MapActionRequest;
import features.world.dungeonmap.catalog.model.DungeonMap;
import features.world.dungeonmap.catalog.ui.DungeonMapSelector;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

public final class MapControls {

    private final DungeonMapSelector selector = new DungeonMapSelector();
    private final Button newMapButton = new Button("Neuen Dungeon");
    private final Button editMapButton = new Button("Dungeon bearbeiten");
    private final VBox content;
    private Consumer<Long> onMapSelected;

    public MapControls(ViewModeControls viewModeControls, Function<String, Label> sectionLabelFactory) {
        selector.getNode().setPrefWidth(220);
        selector.getNode().setMaxWidth(Double.MAX_VALUE);

        newMapButton.setTooltip(new Tooltip("Neuen Dungeon anlegen"));
        newMapButton.setAccessibleText("Neuen Dungeon anlegen");
        editMapButton.setTooltip(new Tooltip("Dungeon bearbeiten"));
        editMapButton.setAccessibleText("Dungeon bearbeiten");
        editMapButton.disableProperty().bind(selector.getNode().valueProperty().isNull());
        newMapButton.setMinWidth(Region.USE_PREF_SIZE);
        editMapButton.setMinWidth(Region.USE_PREF_SIZE);

        HBox mapRow = new HBox(
                8,
                selector.getNode(),
                newMapButton,
                editMapButton,
                viewModeControls.gridButton(),
                viewModeControls.graphButton());
        mapRow.setAlignment(Pos.CENTER_LEFT);
        mapRow.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(selector.getNode(), Priority.ALWAYS);

        content = new VBox(6, sectionLabelFactory.apply("Dungeon"), mapRow);
        content.setMaxWidth(Double.MAX_VALUE);
        content.getStyleClass().add("editor-toolbar-group");

        selector.setOnMapSelected(map -> {
            if (onMapSelected != null) {
                onMapSelected.accept(map.mapId());
            }
        });
    }

    public VBox content() {
        return content;
    }

    public void setMaps(List<DungeonMap> maps) {
        selector.setMaps(maps);
    }

    public void selectMap(Long mapId) {
        selector.selectMap(mapId);
    }

    public void setOnMapSelected(Consumer<Long> onMapSelected) {
        this.onMapSelected = onMapSelected;
    }

    public void setOnNewMapRequested(Consumer<Node> onNewMapRequested) {
        newMapButton.setOnAction(event -> {
            if (onNewMapRequested != null) {
                onNewMapRequested.accept(newMapButton);
            }
        });
    }

    public void setOnEditMapRequested(Consumer<MapActionRequest> onEditMapRequested) {
        editMapButton.setOnAction(event -> {
            DungeonMap map = selector.getNode().getSelectionModel().getSelectedItem();
            if (map != null && onEditMapRequested != null) {
                onEditMapRequested.accept(new MapActionRequest(map, editMapButton));
            }
        });
    }
}
