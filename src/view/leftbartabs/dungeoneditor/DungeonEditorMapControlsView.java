package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import javafx.beans.value.ChangeListener;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.SplitMenuButton;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.util.StringConverter;

final class DungeonEditorMapControlsView {

    private final ComboBox<DungeonEditorControlsView.MapItem> mapSelector = new ComboBox<>();
    private final SplitMenuButton mapActionButton = new SplitMenuButton();
    private final MenuItem editMapItem = new MenuItem("Dungeon bearbeiten");
    private final MenuItem deleteMapItem = new MenuItem("Dungeon löschen");
    private final Label statusLabel = new Label();
    private final ChangeListener<DungeonEditorControlsView.MapItem> selectionListener =
            (ignored, before, after) -> handleSelectionChanged(after);
    private final DungeonEditorMapEditorPopupView mapEditorPopup;
    private final HBox row;
    private final DungeonEditorControlsEvents events;

    DungeonEditorMapControlsView(DungeonEditorControlsView panelView, DungeonEditorControlsEvents events) {
        this.events = events;
        mapSelector.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonEditorControlsView.MapItem item) {
                return item == null ? "" : item.mapName();
            }

            @Override
            public DungeonEditorControlsView.MapItem fromString(String string) {
                return null;
            }
        });
        mapSelector.setMaxWidth(Double.MAX_VALUE);
        mapSelector.setMinWidth(0.0);
        DungeonEditorControlsListeners.onSelectedItemChanged(mapSelector, selectionListener);

        mapActionButton.setText("Neu");
        DungeonEditorControlsFxAccess.setItems(mapActionButton, editMapItem, deleteMapItem);
        DungeonEditorControlsFxAccess.addStyles(mapActionButton, "toolbar-action-button", "dungeon-toolbar-menu");
        mapActionButton.setMinWidth(Region.USE_PREF_SIZE);

        mapEditorPopup = new DungeonEditorMapEditorPopupView(panelView, events, mapActionButton);
        mapActionButton.setOnAction(event -> mapEditorPopup.publishInput(true, false, false, false, false, false));
        editMapItem.setOnAction(event -> mapEditorPopup.publishInput(false, true, false, false, false, false));
        deleteMapItem.setOnAction(event -> mapEditorPopup.publishInput(false, false, true, false, false, false));
        panelView.describeNode(mapActionButton, "Neuen Dungeon erstellen; weitere Dungeon-Aktionen im Menü");

        DungeonEditorControlsFxAccess.addStyle(statusLabel, "text-muted");
        statusLabel.setWrapText(false);
        statusLabel.setVisible(false);
        statusLabel.setManaged(false);
        statusLabel.setMinWidth(0.0);
        statusLabel.setMaxWidth(160.0);

        HBox.setHgrow(mapSelector, Priority.ALWAYS);
        row = panelView.controlsRow(mapSelector, mapActionButton, statusLabel);
        DungeonEditorControlsFxAccess.addStyle(row, "dungeon-control-map-row");
    }

    HBox row() {
        return row;
    }

    void showMaps(List<DungeonEditorControlsView.MapItem> maps, String selectedKey, boolean busy, String statusText) {
        List<DungeonEditorControlsView.MapItem> safeMaps = maps == null ? List.of() : List.copyOf(maps);
        DungeonEditorControlsListeners.withDetachedSelectionUpdate(mapSelector, selectionListener, () -> {
            DungeonEditorControlsFxAccess.setItems(mapSelector, safeMaps);
            DungeonEditorControlsFxAccess.select(mapSelector, resolveSelected(safeMaps, selectedKey));
        });
        mapSelector.setDisable(busy || safeMaps.isEmpty());
        mapActionButton.setDisable(busy);
        boolean selectionMissing = DungeonEditorControlsFxAccess.selectedItem(mapSelector) == null;
        editMapItem.setDisable(busy || selectionMissing);
        deleteMapItem.setDisable(busy || selectionMissing);
        String resolvedStatus = statusText == null ? "" : statusText;
        statusLabel.setText(resolvedStatus);
        statusLabel.setVisible(!resolvedStatus.isBlank());
        statusLabel.setManaged(!resolvedStatus.isBlank());
    }

    void showMapEditor(DungeonEditorContributionModel.MapEditorUiState mapEditorUiState) {
        mapEditorPopup.show(mapEditorUiState);
    }

    private void handleSelectionChanged(DungeonEditorControlsView.MapItem selectedMap) {
        boolean hasSelection = selectedMap != null;
        editMapItem.setDisable(!hasSelection);
        deleteMapItem.setDisable(!hasSelection);
        if (hasSelection) {
            events.mapSelection(selectedMap.mapId());
        }
    }

    private DungeonEditorControlsView.MapItem resolveSelected(
            List<DungeonEditorControlsView.MapItem> maps,
            String selectedKey
    ) {
        DungeonEditorControlsView.MapItem selectedMap = maps.stream()
                .filter(item -> Objects.equals(item.key(), selectedKey))
                .findFirst()
                .orElse(null);
        if (selectedMap != null || maps.isEmpty()) {
            return selectedMap;
        }
        return maps.getFirst();
    }
}
