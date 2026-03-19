package features.world.dungeonmap.shell.editor.controls;

import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import javafx.beans.value.ObservableValue;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

public final class MapControls {

    private final ComboBox<DungeonMapCatalogEntry> selector = new ComboBox<>();
    private final Button newMapButton = new Button("Neuen Dungeon");
    private final Button editMapButton = new Button("Dungeon bearbeiten");
    private final VBox content;
    private boolean syncingSelection;

    public MapControls(ViewModeControls viewModeControls, Function<String, Label> sectionLabelFactory) {
        selector.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonMapCatalogEntry entry) {
                return entry == null ? "" : entry.name();
            }

            @Override
            public DungeonMapCatalogEntry fromString(String string) {
                return null;
            }
        });
        selector.setCellFactory(ignored -> new ListCell<>() {
            @Override
            protected void updateItem(DungeonMapCatalogEntry item, boolean empty) {
                super.updateItem(item, empty);
                setText(empty || item == null ? null : item.name());
            }
        });
        selector.setPrefWidth(220);
        selector.setMaxWidth(Double.MAX_VALUE);
        newMapButton.setDisable(true);
        editMapButton.setDisable(true);
        newMapButton.setMinWidth(Region.USE_PREF_SIZE);
        editMapButton.setMinWidth(Region.USE_PREF_SIZE);
        HBox row = new HBox(
                8,
                selector,
                newMapButton,
                editMapButton,
                viewModeControls.gridButton(),
                viewModeControls.graphButton());
        row.setAlignment(Pos.CENTER_LEFT);
        row.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(selector, Priority.ALWAYS);
        content = new VBox(6, sectionLabelFactory.apply("Dungeon"), row);
        content.setMaxWidth(Double.MAX_VALUE);
        content.getStyleClass().add("editor-toolbar-group");
    }

    public void setOnMapSelected(Consumer<DungeonMapCatalogEntry> onMapSelected) {
        selector.getSelectionModel().selectedItemProperty().addListener(
                (ObservableValue<? extends DungeonMapCatalogEntry> ignored, DungeonMapCatalogEntry oldValue, DungeonMapCatalogEntry newValue) -> {
                    if (!syncingSelection && onMapSelected != null && newValue != null && newValue != oldValue) {
                        onMapSelected.accept(newValue);
                    }
                });
    }

    public void showMaps(List<DungeonMapCatalogEntry> maps, Long activeMapId, boolean loading) {
        syncingSelection = true;
        List<DungeonMapCatalogEntry> visibleMaps = maps == null ? List.of() : List.copyOf(maps);
        selector.getItems().setAll(visibleMaps);
        selector.setDisable(loading || visibleMaps.isEmpty());
        if (activeMapId != null) {
            for (DungeonMapCatalogEntry entry : visibleMaps) {
                if (entry != null && entry.mapId() == activeMapId) {
                    selector.getSelectionModel().select(entry);
                    syncingSelection = false;
                    return;
                }
            }
        }
        if (visibleMaps.isEmpty()) {
            selector.getSelectionModel().clearSelection();
        } else {
            selector.getSelectionModel().selectFirst();
        }
        syncingSelection = false;
    }

    public VBox content() {
        return content;
    }
}
