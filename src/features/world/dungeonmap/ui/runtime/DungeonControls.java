package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.ui.shared.cell.DungeonMapSelectorController;
import javafx.geometry.Insets;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonControls extends VBox {

    private final ComboBox<DungeonMap> mapSelector = new ComboBox<>();
    private final DungeonMapSelectorController mapSelectorController = new DungeonMapSelectorController(mapSelector);
    private final Label activeRoomLabel = new Label("Kein aktiver Raum");

    public DungeonControls() {
        setSpacing(10);
        setPadding(new Insets(12));
        getChildren().addAll(new Label("Dungeon"), mapSelector, activeRoomLabel);
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

    public void setActiveRoomName(String name) {
        activeRoomLabel.setText(name == null ? "Kein aktiver Raum" : "Aktiv: " + name);
    }
}
