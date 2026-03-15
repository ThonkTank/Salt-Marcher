package features.world.dungeonmap.ui.shared.map;

import features.world.dungeonmap.model.domain.DungeonMap;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public final class DungeonMapControlsPane extends VBox implements DungeonInlineControlsHost {
    public record MapActionRequest(DungeonMap map, Node anchor) {}

    private final ComboBox<DungeonMap> mapCombo = new ComboBox<>();
    private final HBox mapRow;
    private final HBox primaryInlineExtras = new HBox(6);
    private final Region trailingSpacer = new Region();
    private boolean updatingMapCombo = false;

    private Consumer<Long> onMapSelected;
    private Consumer<Node> onNewMapRequested;
    private Consumer<MapActionRequest> onEditMapRequested;

    public DungeonMapControlsPane() {
        Label mapLabel = sectionLabel("Dungeon");
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
        editMapButton.disableProperty().bind(mapCombo.valueProperty().isNull());
        editMapButton.setOnAction(event -> {
            if (onEditMapRequested != null && mapCombo.getValue() != null) {
                onEditMapRequested.accept(new MapActionRequest(mapCombo.getValue(), editMapButton));
            }
        });

        primaryInlineExtras.setAlignment(Pos.CENTER_LEFT);
        mapRow = new HBox(8, mapCombo, newMapButton, editMapButton, primaryInlineExtras, trailingSpacer);
        mapRow.setAlignment(Pos.CENTER_LEFT);
        HBox.setHgrow(mapCombo, Priority.ALWAYS);
        HBox.setHgrow(trailingSpacer, Priority.ALWAYS);
        mapRow.getStyleClass().add("editor-action-row");

        getStyleClass().add("editor-toolbar-group");
        setSpacing(6);
        getChildren().addAll(mapLabel, mapRow);
    }

    public void setMaps(List<DungeonMap> maps) {
        updatingMapCombo = true;
        DungeonMap previous = mapCombo.getValue();
        mapCombo.getItems().setAll(maps);
        DungeonMap restored = null;
        if (previous != null) {
            for (DungeonMap map : maps) {
                if (Objects.equals(previous.mapId(), map.mapId())) {
                    restored = map;
                    break;
                }
            }
        }
        mapCombo.setValue(restored);
        updatingMapCombo = false;
    }

    public void selectMap(Long mapId) {
        selectMap(mapId, false);
    }

    public void selectMap(Long mapId, boolean notifyListeners) {
        if (mapId == null) {
            boolean previousUpdating = updatingMapCombo;
            if (!notifyListeners) {
                updatingMapCombo = true;
            }
            try {
                mapCombo.setValue(null);
            } finally {
                updatingMapCombo = previousUpdating;
            }
            return;
        }
        boolean previousUpdating = updatingMapCombo;
        if (!notifyListeners) {
            updatingMapCombo = true;
        }
        try {
            for (DungeonMap map : mapCombo.getItems()) {
                if (Objects.equals(mapId, map.mapId())) {
                    mapCombo.setValue(map);
                    return;
                }
            }
        } finally {
            updatingMapCombo = previousUpdating;
        }
    }

    public void clearMapSelection() {
        selectMap(null, false);
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

    public void setInlineTrailingNode(Node node) {
        primaryInlineExtras.getChildren().setAll();
        if (node != null) {
            primaryInlineExtras.getChildren().setAll(node);
        }
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }
}
