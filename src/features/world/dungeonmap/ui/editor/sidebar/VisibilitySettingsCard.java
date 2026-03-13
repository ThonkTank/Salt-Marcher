package features.world.dungeonmap.ui.editor.sidebar;

import features.world.dungeonmap.ui.editor.toolbar.DungeonColorRenderMode;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

import java.util.function.Consumer;

final class VisibilitySettingsCard {

    private final CheckBox linksVisibleCheckBox = new CheckBox("Links anzeigen");
    private final CheckBox endpointsVisibleCheckBox = new CheckBox("Übergänge anzeigen");
    private final CheckBox featuresVisibleCheckBox = new CheckBox("Features anzeigen");
    private final ToggleGroup colorRenderModeGroup = new ToggleGroup();
    private final ToggleButton roomColorModeButton = new ToggleButton(DungeonColorRenderMode.ROOMS.label());
    private final ToggleButton areaColorModeButton = new ToggleButton(DungeonColorRenderMode.AREAS.label());
    private final VBox root;
    private boolean updating;
    private Consumer<DungeonColorRenderMode> onColorRenderModeChanged;

    public VisibilitySettingsCard() {
        linksVisibleCheckBox.setSelected(true);
        endpointsVisibleCheckBox.setSelected(true);
        featuresVisibleCheckBox.setSelected(true);

        roomColorModeButton.setToggleGroup(colorRenderModeGroup);
        roomColorModeButton.setUserData(DungeonColorRenderMode.ROOMS);
        roomColorModeButton.setSelected(true);
        areaColorModeButton.setToggleGroup(colorRenderModeGroup);
        areaColorModeButton.setUserData(DungeonColorRenderMode.AREAS);
        colorRenderModeGroup.selectedToggleProperty().addListener((obs, oldToggle, newToggle) -> {
            if (newToggle == null && oldToggle != null) {
                oldToggle.setSelected(true);
                return;
            }
            if (!updating && newToggle != null && onColorRenderModeChanged != null) {
                onColorRenderModeChanged.accept((DungeonColorRenderMode) newToggle.getUserData());
            }
        });

        Label colorModeLabel = new Label("Farben");
        colorModeLabel.getStyleClass().add("text-muted");
        HBox colorModeRow = new HBox(6, roomColorModeButton, areaColorModeButton);
        colorModeRow.setAlignment(Pos.CENTER_LEFT);
        root = DungeonSidebarCards.createCard("Anzeige", new VBox(6, colorModeLabel, colorModeRow, featuresVisibleCheckBox, linksVisibleCheckBox, endpointsVisibleCheckBox));
    }

    public Node root() {
        return root;
    }

    public void setColorRenderMode(DungeonColorRenderMode mode) {
        updating = true;
        DungeonColorRenderMode effectiveMode = mode == null ? DungeonColorRenderMode.ROOMS : mode;
        if (effectiveMode == DungeonColorRenderMode.AREAS) {
            areaColorModeButton.setSelected(true);
        } else {
            roomColorModeButton.setSelected(true);
        }
        updating = false;
    }

    public boolean linksVisible() {
        return linksVisibleCheckBox.isSelected();
    }

    public boolean endpointsVisible() {
        return endpointsVisibleCheckBox.isSelected();
    }

    public boolean featuresVisible() {
        return featuresVisibleCheckBox.isSelected();
    }

    public void setOnLinksVisibilityChanged(Consumer<Boolean> callback) {
        Consumer<Boolean> safeCallback = callback == null ? ignored -> { } : callback;
        linksVisibleCheckBox.selectedProperty().addListener((obs, oldValue, newValue) -> safeCallback.accept(newValue));
    }

    public void setOnEndpointsVisibilityChanged(Consumer<Boolean> callback) {
        Consumer<Boolean> safeCallback = callback == null ? ignored -> { } : callback;
        endpointsVisibleCheckBox.selectedProperty().addListener((obs, oldValue, newValue) -> safeCallback.accept(newValue));
    }

    public void setOnFeaturesVisibilityChanged(Consumer<Boolean> callback) {
        Consumer<Boolean> safeCallback = callback == null ? ignored -> { } : callback;
        featuresVisibleCheckBox.selectedProperty().addListener((obs, oldValue, newValue) -> safeCallback.accept(newValue));
    }

    public void setOnColorRenderModeChanged(Consumer<DungeonColorRenderMode> callback) {
        onColorRenderModeChanged = callback;
    }
}
