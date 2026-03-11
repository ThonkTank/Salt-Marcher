package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.model.DungeonMap;
import javafx.geometry.Insets;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import ui.components.ThemeColors;

import java.util.List;
import java.util.function.Consumer;

public class DungeonViewControls extends VBox {

    private final ComboBox<DungeonMap> mapCombo = new ComboBox<>();
    private final Label currentRoomLabel = new Label("-");
    private final Label currentAreaLabel = new Label("-");
    private final Label encounterTableLabel = new Label("-");
    private boolean updating = false;
    private Consumer<Long> onMapSelected;

    public DungeonViewControls() {
        setSpacing(8);
        setPadding(new Insets(8));

        Label header = new Label("DUNGEON");
        header.getStyleClass().addAll("section-header", "text-muted");

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
            if (!updating && onMapSelected != null && mapCombo.getValue() != null) {
                onMapSelected.accept(mapCombo.getValue().mapId());
            }
        });

        Label karteLabel = new Label("Karte");
        karteLabel.getStyleClass().add("text-muted");
        Label raumLabel = new Label("Aktueller Raum");
        raumLabel.getStyleClass().add("text-muted");
        Label bereichLabel = new Label("Aktueller Bereich");
        bereichLabel.getStyleClass().add("text-muted");
        Label tableLabel = new Label("Encounter Table");
        tableLabel.getStyleClass().add("text-muted");

        getChildren().addAll(
                header,
                ThemeColors.controlSeparator(),
                karteLabel,
                mapCombo,
                ThemeColors.controlSeparator(),
                raumLabel,
                currentRoomLabel,
                bereichLabel,
                currentAreaLabel,
                tableLabel,
                encounterTableLabel);
    }

    public void setMaps(List<DungeonMap> maps, Long selectedMapId) {
        updating = true;
        mapCombo.getItems().setAll(maps);
        mapCombo.setValue(null);
        selectMap(selectedMapId);
        updating = false;
    }

    public void selectMap(Long mapId) {
        boolean previousUpdating = updating;
        updating = true;
        if (mapId == null) {
            mapCombo.setValue(null);
            updating = previousUpdating;
            return;
        }
        for (DungeonMap map : mapCombo.getItems()) {
            if (mapId.equals(map.mapId())) {
                mapCombo.setValue(map);
                updating = previousUpdating;
                return;
            }
        }
        updating = previousUpdating;
    }

    public void showLocation(String roomName, String areaName, String encounterTableName) {
        currentRoomLabel.setText(roomName == null || roomName.isBlank() ? "-" : roomName);
        currentAreaLabel.setText(areaName == null || areaName.isBlank() ? "-" : areaName);
        encounterTableLabel.setText(encounterTableName == null || encounterTableName.isBlank() ? "-" : encounterTableName);
    }

    public void setOnMapSelected(Consumer<Long> onMapSelected) {
        this.onMapSelected = onMapSelected;
    }
}
