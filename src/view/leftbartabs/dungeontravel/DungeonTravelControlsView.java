package src.view.leftbartabs.dungeontravel;

import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.stage.Popup;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;

public final class DungeonTravelControlsView extends DungeonControlPanelView {

    static final String OVERLAY_OFF = "Aus";
    static final String OVERLAY_NEARBY = "Nachbarn";
    static final String OVERLAY_SELECTED = "Auswahl";

    private final Label zoomLabel = new Label("Zoom: 100%");
    private final Label mapLabel = new Label("Dungeon");
    private final Label levelLabel = new Label("Ebene z=0");
    private final Button refreshButton = new Button("Refresh");
    private final Button resetViewButton = new Button("Reset view");
    private final Button previousLevelButton = new Button("Ebene -");
    private final Button nextLevelButton = new Button("Ebene +");
    private final Button overlayButton = new Button();
    private final Popup overlayPopup;
    private Consumer<String> onOverlayModeChanged = ignored -> {};

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonTravelControlsView() {
        super("");
        overlayPopup = createOverlayPopup(
                mode -> onOverlayModeChanged.accept(mode),
                OVERLAY_OFF,
                OVERLAY_NEARBY,
                OVERLAY_SELECTED);
        getStyleClass().add("dungeon-editor-toolbar");
        getChildren().addAll(sectionLabel("Dungeon"), zoomLabel, mapLabel, levelRow(), actionRow());
    }

    public void onRefresh(Runnable action) {
        bindAction(refreshButton, action);
    }

    public void onResetView(Runnable action) {
        bindAction(resetViewButton, action);
    }

    public void onPreviousLevel(Runnable action) {
        bindAction(previousLevelButton, action);
    }

    public void onNextLevel(Runnable action) {
        bindAction(nextLevelButton, action);
    }

    public void onOverlayModeChanged(Consumer<String> action) {
        onOverlayModeChanged = action == null ? ignored -> {} : action;
    }

    public void showMapName(String mapName) {
        mapLabel.setText(mapName == null || mapName.isBlank() ? "Dungeon" : mapName);
    }

    public void showLevel(int level) {
        levelLabel.setText("Ebene z=" + level);
    }

    public void showOverlayMode(String overlayMode) {
        overlayButton.setText(overlayMode == null || overlayMode.isBlank() ? OVERLAY_OFF : overlayMode);
    }

    private HBox levelRow() {
        overlayButton.getStyleClass().addAll("toolbar-action-button", "dungeon-overlay-trigger");
        overlayButton.setOnAction(event -> togglePopup(overlayPopup, overlayButton));
        HBox row = new HBox(8, levelLabel, previousLevelButton, nextLevelButton, spacer(), overlayButton);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private HBox actionRow() {
        HBox row = new HBox(8, refreshButton, resetViewButton);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }
}
