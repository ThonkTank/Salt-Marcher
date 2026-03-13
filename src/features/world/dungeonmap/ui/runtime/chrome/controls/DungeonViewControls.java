package features.world.dungeonmap.ui.runtime.chrome.controls;

import features.world.dungeonmap.model.domain.DungeonMap;
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

        getChildren().addAll(
                header,
                ThemeColors.controlSeparator(),
                karteLabel,
                mapCombo,
                ThemeColors.controlSeparator());
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

    public void setOnMapSelected(Consumer<Long> onMapSelected) {
        this.onMapSelected = onMapSelected;
    }
}
