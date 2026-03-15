package features.world.dungeonmap.ui.shared.cell;

import features.world.dungeonmap.model.DungeonMap;
import javafx.scene.control.ComboBox;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public final class DungeonMapSelectorController {

    private final ComboBox<DungeonMap> mapSelector;
    private boolean updatingSelection;

    public DungeonMapSelectorController(ComboBox<DungeonMap> mapSelector) {
        this.mapSelector = Objects.requireNonNull(mapSelector, "mapSelector");
        this.mapSelector.setCellFactory(list -> new DungeonMapCell());
        this.mapSelector.setButtonCell(new DungeonMapCell());
    }

    public void setMaps(List<DungeonMap> maps) {
        mapSelector.getItems().setAll(maps);
    }

    public void selectMap(Long mapId) {
        updatingSelection = true;
        if (mapId == null) {
            mapSelector.getSelectionModel().clearSelection();
            updatingSelection = false;
            return;
        }
        for (DungeonMap map : mapSelector.getItems()) {
            if (mapId.equals(map.mapId())) {
                mapSelector.getSelectionModel().select(map);
                updatingSelection = false;
                return;
            }
        }
        mapSelector.getSelectionModel().clearSelection();
        updatingSelection = false;
    }

    public void setOnMapSelected(Consumer<Long> onMapSelected) {
        mapSelector.setOnAction(event -> {
            if (updatingSelection) {
                return;
            }
            DungeonMap map = mapSelector.getSelectionModel().getSelectedItem();
            if (map != null) {
                onMapSelected.accept(map.mapId());
            }
        });
    }
}
