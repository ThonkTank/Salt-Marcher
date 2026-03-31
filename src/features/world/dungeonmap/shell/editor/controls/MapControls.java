package features.world.dungeonmap.shell.editor.controls;

import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import features.world.dungeonmap.shell.editor.DungeonEditorControls.MapActionRequest;
import features.world.dungeonmap.shell.controls.DungeonLevelOverlayControls;
import features.world.dungeonmap.state.DungeonLevelOverlayMode;
import features.world.dungeonmap.state.DungeonLevelOverlaySettings;
import javafx.beans.value.ObservableValue;
import javafx.geometry.Pos;
import javafx.scene.Node;
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
    private final Label statusLabel = new Label();
    private final Label levelLabel = new Label("Ebene z=0");
    private final Button previousLevelButton = new Button("Ebene -");
    private final Button nextLevelButton = new Button("Ebene +");
    private final DungeonLevelOverlayControls overlayControls;
    private final VBox content;
    private boolean syncingSelection;
    private Consumer<DungeonMapCatalogEntry> onMapSelected;

    public MapControls(ViewModeControls viewModeControls, Function<String, Label> sectionLabelFactory) {
        overlayControls = new DungeonLevelOverlayControls(sectionLabelFactory);
        previousLevelButton.getStyleClass().add("toolbar-action-button");
        nextLevelButton.getStyleClass().add("toolbar-action-button");
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
        statusLabel.setWrapText(true);
        statusLabel.getStyleClass().add("text-muted");
        editMapButton.setDisable(true);
        newMapButton.setMinWidth(Region.USE_PREF_SIZE);
        editMapButton.setMinWidth(Region.USE_PREF_SIZE);
        previousLevelButton.setMinWidth(Region.USE_PREF_SIZE);
        nextLevelButton.setMinWidth(Region.USE_PREF_SIZE);
        HBox row = new HBox(
                8,
                selector,
                newMapButton,
                editMapButton,
                viewModeControls.gridButton());
        row.setAlignment(Pos.CENTER_LEFT);
        row.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(selector, Priority.ALWAYS);
        Region levelSpacer = new Region();
        HBox.setHgrow(levelSpacer, Priority.ALWAYS);
        HBox levelRow = new HBox(8, levelLabel, previousLevelButton, nextLevelButton, levelSpacer, overlayControls.trigger());
        levelRow.setAlignment(Pos.CENTER_LEFT);
        content = new VBox(6, sectionLabelFactory.apply("Dungeon"), row, statusLabel, levelRow);
        content.setMaxWidth(Double.MAX_VALUE);
        content.getStyleClass().add("editor-toolbar-group");
    }

    public void setOnMapSelected(Consumer<DungeonMapCatalogEntry> onMapSelected) {
        this.onMapSelected = onMapSelected;
        selector.getSelectionModel().selectedItemProperty().addListener(
                (ObservableValue<? extends DungeonMapCatalogEntry> ignored, DungeonMapCatalogEntry oldValue, DungeonMapCatalogEntry newValue) -> {
                    editMapButton.setDisable(newValue == null);
                    if (!syncingSelection && this.onMapSelected != null && newValue != null && newValue != oldValue) {
                        this.onMapSelected.accept(newValue);
                    }
                });
    }

    public void setOnNewMapRequested(Consumer<Node> onNewMapRequested) {
        newMapButton.setOnAction(event -> {
            if (onNewMapRequested != null) {
                onNewMapRequested.accept(newMapButton);
            }
        });
    }

    public void setOnEditMapRequested(Consumer<MapActionRequest> onEditMapRequested) {
        editMapButton.setOnAction(event -> {
            DungeonMapCatalogEntry selected = selector.getSelectionModel().getSelectedItem();
            if (selected != null && onEditMapRequested != null) {
                onEditMapRequested.accept(new MapActionRequest(selected, editMapButton));
            }
        });
    }

    public void setOnPreviousLevelRequested(Runnable action) {
        previousLevelButton.setOnAction(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    public void setOnNextLevelRequested(Runnable action) {
        nextLevelButton.setOnAction(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    public void setOnOverlayModeChanged(Consumer<DungeonLevelOverlayMode> action) {
        overlayControls.setOnModeChanged(action);
    }

    public void setOnOverlayRangeChanged(Consumer<Integer> action) {
        overlayControls.setOnRangeChanged(action);
    }

    public void setOnOverlayOpacityChanged(Consumer<Double> action) {
        overlayControls.setOnOpacityChanged(action);
    }

    public void setOnSelectedOverlayLevelsChanged(Consumer<List<Integer>> action) {
        overlayControls.setOnSelectedLevelsChanged(action);
    }

    public void showMaps(List<DungeonMapCatalogEntry> maps, Long activeMapId, boolean busy, String statusMessage) {
        syncingSelection = true;
        List<DungeonMapCatalogEntry> visibleMaps = maps == null ? List.of() : List.copyOf(maps);
        selector.getItems().setAll(visibleMaps);
        selector.setDisable(busy || visibleMaps.isEmpty());
        newMapButton.setDisable(busy);
        editMapButton.setDisable(busy || selector.getSelectionModel().getSelectedItem() == null);
        statusLabel.setText(statusMessage == null ? "" : statusMessage);
        if (activeMapId != null) {
            for (DungeonMapCatalogEntry entry : visibleMaps) {
                if (entry != null && entry.mapId() == activeMapId) {
                    selector.getSelectionModel().select(entry);
                    editMapButton.setDisable(busy);
                    syncingSelection = false;
                    return;
                }
            }
        }
        if (visibleMaps.isEmpty()) {
            selector.getSelectionModel().clearSelection();
            editMapButton.setDisable(true);
        } else {
            selector.getSelectionModel().selectFirst();
            editMapButton.setDisable(busy);
        }
        syncingSelection = false;
    }

    public VBox content() {
        return content;
    }

    public void showLevels(List<Integer> levels, int activeLevel, boolean busy, boolean navigationEnabled) {
        levelLabel.setText("Ebene z=" + activeLevel);
        previousLevelButton.setDisable(busy || !navigationEnabled);
        nextLevelButton.setDisable(busy || !navigationEnabled);
    }

    public void showOverlaySettings(DungeonLevelOverlaySettings settings, boolean disabled) {
        overlayControls.showSettings(settings, disabled);
    }
}
