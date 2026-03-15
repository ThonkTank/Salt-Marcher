package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.model.DungeonMap;
import javafx.geometry.Insets;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonControls extends VBox {

    private final ComboBox<DungeonMap> mapSelector = new ComboBox<>();
    private final Label activeRoomLabel = new Label("Kein aktiver Raum");

    public DungeonControls() {
        setSpacing(10);
        setPadding(new Insets(12));
        mapSelector.setCellFactory(list -> new features.world.dungeonmap.ui.editor.DungeonMapCell());
        mapSelector.setButtonCell(new features.world.dungeonmap.ui.editor.DungeonMapCell());
        getChildren().addAll(new Label("Dungeon"), mapSelector, activeRoomLabel);
    }

    public void setMaps(List<DungeonMap> maps) {
        mapSelector.getItems().setAll(maps);
    }

    public void selectMap(Long mapId) {
        if (mapId == null) {
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

    public void setActiveRoomName(String name) {
        activeRoomLabel.setText(name == null ? "Kein aktiver Raum" : "Aktiv: " + name);
    }
}
