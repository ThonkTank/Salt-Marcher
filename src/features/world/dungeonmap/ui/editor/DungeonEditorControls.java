package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonMap;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonEditorControls extends VBox {

    private final ComboBox<DungeonMap> mapSelector = new ComboBox<>();
    private final Button reloadButton = new Button("Neu laden");
    private final Label selectionLabel = new Label("Kein Raum gewählt");

    public DungeonEditorControls() {
        setSpacing(10);
        setPadding(new Insets(12));
        Label mapLabel = new Label("Dungeon");
        mapSelector.setMaxWidth(Double.MAX_VALUE);
        mapSelector.setCellFactory(list -> new DungeonMapCell());
        mapSelector.setButtonCell(new DungeonMapCell());
        getChildren().addAll(mapLabel, mapSelector, reloadButton, selectionLabel);
    }

    public void setMaps(List<DungeonMap> maps) {
        mapSelector.getItems().setAll(maps);
    }

    public void selectMap(Long mapId) {
        if (mapId == null) {
            mapSelector.getSelectionModel().clearSelection();
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

    public void setOnReloadRequested(Runnable onReloadRequested) {
        reloadButton.setOnAction(event -> onReloadRequested.run());
    }

    public void setSelectionText(String text) {
        selectionLabel.setText(text);
    }
}
