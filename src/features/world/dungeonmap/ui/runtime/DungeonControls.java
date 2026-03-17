package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.domain.model.DungeonMap;
import javafx.geometry.Insets;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonControls extends VBox {

    private final ComboBox<DungeonMap> mapSelector = new ComboBox<>();
    private final Label activeRoomLabel = new Label("Kein aktiver Ort");
    private boolean updatingSelection;

    public DungeonControls() {
        mapSelector.setCellFactory(list -> new features.world.dungeonmap.ui.selector.DungeonMapCell());
        mapSelector.setButtonCell(new features.world.dungeonmap.ui.selector.DungeonMapCell());
        setSpacing(10);
        setPadding(new Insets(12));
        getChildren().addAll(new Label("Dungeon"), mapSelector, activeRoomLabel);
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
            if (updatingSelection || onMapSelected == null) {
                return;
            }
            DungeonMap map = mapSelector.getSelectionModel().getSelectedItem();
            if (map != null) {
                onMapSelected.accept(map.mapId());
            }
        });
    }

    public void setActiveRoomName(String name) {
        activeRoomLabel.setText(name == null ? "Kein aktiver Ort" : "Aktiv: " + name);
    }
}
