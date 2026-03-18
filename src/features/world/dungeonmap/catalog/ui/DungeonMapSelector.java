package features.world.dungeonmap.catalog.ui;

import features.world.dungeonmap.catalog.model.DungeonMap;
import javafx.scene.control.ComboBox;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonMapSelector {

    private final ComboBox<DungeonMap> comboBox = new ComboBox<>();
    private boolean updatingSelection;

    public DungeonMapSelector() {
        comboBox.setCellFactory(list -> new DungeonMapCell());
        comboBox.setButtonCell(new DungeonMapCell());
    }

    public void setMaps(List<DungeonMap> maps) {
        updatingSelection = true;
        try {
            comboBox.getItems().setAll(maps);
        } finally {
            updatingSelection = false;
        }
    }

    public void selectMap(Long mapId) {
        updatingSelection = true;
        try {
            if (mapId == null) {
                comboBox.getSelectionModel().clearSelection();
                return;
            }
            for (DungeonMap map : comboBox.getItems()) {
                if (mapId.equals(map.mapId())) {
                    comboBox.getSelectionModel().select(map);
                    return;
                }
            }
            comboBox.getSelectionModel().clearSelection();
        } finally {
            updatingSelection = false;
        }
    }

    public void setOnMapSelected(Consumer<DungeonMap> onMapSelected) {
        comboBox.setOnAction(event -> {
            if (updatingSelection || onMapSelected == null) {
                return;
            }
            DungeonMap map = comboBox.getSelectionModel().getSelectedItem();
            if (map != null) {
                onMapSelected.accept(map);
            }
        });
    }

    public ComboBox<DungeonMap> getNode() {
        return comboBox;
    }
}
