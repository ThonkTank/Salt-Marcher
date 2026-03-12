package features.world.dungeonmap.ui.editor.controls;

import features.world.dungeonmap.model.DungeonMap;
import javafx.scene.Node;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

import java.util.List;
import java.util.function.Consumer;

public class DungeonEditorControls extends VBox {

    public record MapActionRequest(DungeonMap map, Node anchor) {}

    private final ComboBox<DungeonMap> mapCombo = new ComboBox<>();
    private DungeonEditorTool activeTool = DungeonEditorTool.SELECT;
    private boolean updatingMapCombo = false;

    private Consumer<Long> onMapSelected;
    private Consumer<Node> onNewMapRequested;
    private Consumer<MapActionRequest> onEditMapRequested;
    private Consumer<DungeonEditorTool> onToolChanged;

    public DungeonEditorControls() {
        getStyleClass().add("map-editor-toolbar");
        getStyleClass().add("dungeon-editor-toolbar");
        setSpacing(8);
        setPadding(new Insets(8, 10, 8, 10));

        mapCombo.setPrefWidth(180);
        mapCombo.setMaxWidth(Double.MAX_VALUE);
        mapCombo.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonMap map) {
                return map == null ? "" : map.name();
            }

            @Override
            public DungeonMap fromString(String string) {
                return null;
            }
        });
        mapCombo.setPromptText("Dungeon wählen…");
        mapCombo.setOnAction(event -> {
            if (!updatingMapCombo && onMapSelected != null && mapCombo.getValue() != null) {
                onMapSelected.accept(mapCombo.getValue().mapId());
            }
        });

        Button newMapButton = new Button("Neu");
        newMapButton.getStyleClass().addAll("button", "compact");
        newMapButton.setTooltip(new Tooltip("Neuen Dungeon anlegen"));
        newMapButton.setAccessibleText("Neuen Dungeon anlegen");
        newMapButton.setOnAction(event -> {
            if (onNewMapRequested != null) {
                onNewMapRequested.accept(newMapButton);
            }
        });

        Button editMapButton = new Button("Bearbeiten");
        editMapButton.getStyleClass().addAll("button", "compact");
        editMapButton.setTooltip(new Tooltip("Dungeon bearbeiten"));
        editMapButton.setAccessibleText("Ausgewählten Dungeon bearbeiten");
        editMapButton.setOnAction(event -> {
            if (onEditMapRequested != null && mapCombo.getValue() != null) {
                onEditMapRequested.accept(new MapActionRequest(mapCombo.getValue(), editMapButton));
            }
        });
        editMapButton.disableProperty().bind(mapCombo.valueProperty().isNull());

        ToggleGroup toolGroup = new ToggleGroup();
        ToggleButton selectButton = buildToolButton("Auswahl", DungeonEditorTool.SELECT, toolGroup, true);
        ToggleButton paintButton = buildToolButton("Malen", DungeonEditorTool.PAINT, toolGroup, false);
        ToggleButton eraseButton = buildToolButton("Löschen", DungeonEditorTool.ERASE, toolGroup, false);
        ToggleButton areaButton = buildToolButton("Bereich", DungeonEditorTool.AREA_ASSIGN, toolGroup, false);
        ToggleButton featureButton = buildToolButton("Feature", DungeonEditorTool.FEATURE, toolGroup, false);
        ToggleButton passageButton = buildToolButton("Wände", DungeonEditorTool.PASSAGE, toolGroup, false);
        ToggleButton endpointButton = buildToolButton("Übergang", DungeonEditorTool.ENDPOINT, toolGroup, false);
        ToggleButton linkButton = buildToolButton("Link", DungeonEditorTool.LINK, toolGroup, false);

        toolGroup.selectedToggleProperty().addListener((obs, oldValue, newValue) -> {
            if (newValue == null) {
                if (oldValue != null) {
                    oldValue.setSelected(true);
                }
                return;
            }
            activeTool = (DungeonEditorTool) newValue.getUserData();
            if (onToolChanged != null) {
                onToolChanged.accept(activeTool);
            }
        });

        Label mapLabel = sectionLabel("Dungeon");
        HBox mapRow = new HBox(8, mapCombo, newMapButton, editMapButton);
        mapRow.setAlignment(Pos.CENTER_LEFT);
        HBox.setHgrow(mapCombo, javafx.scene.layout.Priority.ALWAYS);
        mapRow.getStyleClass().add("editor-action-row");

        VBox mapGroup = new VBox(6, mapLabel, mapRow);
        mapGroup.getStyleClass().add("editor-toolbar-group");
        HBox.setHgrow(mapGroup, javafx.scene.layout.Priority.ALWAYS);

        Label toolsLabel = sectionLabel("Werkzeuge");
        FlowPane toolRow = new FlowPane();
        toolRow.setHgap(6);
        toolRow.setVgap(6);
        toolRow.getStyleClass().add("editor-tool-flow");
        toolRow.getChildren().addAll(
                selectButton,
                paintButton,
                eraseButton,
                areaButton,
                featureButton,
                passageButton,
                endpointButton,
                linkButton);
        VBox toolsGroup = new VBox(6, toolsLabel, toolRow);
        toolsGroup.getStyleClass().add("editor-toolbar-group");
        getChildren().addAll(mapGroup, toolsGroup);
    }

    private ToggleButton buildToolButton(String label, DungeonEditorTool tool, ToggleGroup group, boolean selected) {
        ToggleButton button = new ToggleButton(label);
        button.getStyleClass().add("tool-btn");
        button.setToggleGroup(group);
        button.setUserData(tool);
        button.setSelected(selected);
        return button;
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    public DungeonEditorTool getActiveTool() {
        return activeTool;
    }

    public void setMaps(List<DungeonMap> maps) {
        updatingMapCombo = true;
        DungeonMap previous = mapCombo.getValue();
        mapCombo.getItems().setAll(maps);
        DungeonMap restored = null;
        if (previous != null) {
            for (DungeonMap map : maps) {
                if (map.mapId().equals(previous.mapId())) {
                    restored = map;
                    break;
                }
            }
        }
        mapCombo.setValue(restored);
        updatingMapCombo = false;
    }

    public void selectMap(Long mapId) {
        if (mapId == null) {
            return;
        }
        for (DungeonMap map : mapCombo.getItems()) {
            if (mapId.equals(map.mapId())) {
                mapCombo.setValue(map);
                return;
            }
        }
    }

    public void setOnMapSelected(Consumer<Long> onMapSelected) {
        this.onMapSelected = onMapSelected;
    }

    public void setOnNewMapRequested(Consumer<Node> onNewMapRequested) {
        this.onNewMapRequested = onNewMapRequested;
    }

    public void setOnEditMapRequested(Consumer<MapActionRequest> onEditMapRequested) {
        this.onEditMapRequested = onEditMapRequested;
    }

    public void setOnToolChanged(Consumer<DungeonEditorTool> onToolChanged) {
        this.onToolChanged = onToolChanged;
    }
}
