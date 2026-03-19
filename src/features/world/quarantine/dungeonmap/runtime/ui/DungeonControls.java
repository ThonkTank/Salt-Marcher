package features.world.quarantine.dungeonmap.runtime.ui;

import features.world.quarantine.dungeonmap.catalog.model.DungeonMap;
import features.world.quarantine.dungeonmap.catalog.ui.DungeonMapSelector;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonControls extends VBox {

    private final DungeonMapSelector selector = new DungeonMapSelector();
    private final Label activeRoomLabel = new Label("Kein aktiver Ort");
    private Consumer<Long> onMapSelected;

    public DungeonControls() {
        selector.setOnMapSelected(map -> {
            if (onMapSelected != null) {
                onMapSelected.accept(map.mapId());
            }
        });
        setSpacing(10);
        setPadding(new Insets(12));
        getChildren().addAll(new Label("Dungeon"), selector.getNode(), activeRoomLabel);
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

    public void setActiveRoomName(String name) {
        activeRoomLabel.setText(name == null ? "Kein aktiver Ort" : "Aktiv: " + name);
    }
}
