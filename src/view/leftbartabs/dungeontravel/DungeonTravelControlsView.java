package src.view.leftbartabs.dungeontravel;

import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;

public final class DungeonTravelControlsView extends VBox {

    private final Label zoomLabel = new Label("Zoom: 100%");
    private final Label mapLabel = new Label("Dungeon");
    private final Label levelLabel = new Label("Ebene z=0");
    private final Button refreshButton = new Button("Refresh");
    private final Button resetViewButton = new Button("Reset view");
    private final Button previousLevelButton = new Button("Ebene -");
    private final Button nextLevelButton = new Button("Ebene +");
    private final Button overlayButton = new Button();
    private final Popup overlayPopup = new Popup();
    private Consumer<OverlayMode> onOverlayModeChanged = ignored -> {};

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonTravelControlsView() {
        getStyleClass().addAll("surface-root", "dungeon-editor-toolbar");
        setSpacing(10);
        setPadding(new Insets(12));
        configureOverlayPopup();
        getChildren().addAll(sectionLabel("Dungeon"), zoomLabel, mapLabel, levelRow(), actionRow());
    }

    public void onRefresh(Runnable action) {
        refreshButton.setOnAction(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    public void onResetView(Runnable action) {
        resetViewButton.setOnAction(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    public void onPreviousLevel(Runnable action) {
        previousLevelButton.setOnAction(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    public void onNextLevel(Runnable action) {
        nextLevelButton.setOnAction(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    public void onOverlayModeChanged(Consumer<OverlayMode> action) {
        onOverlayModeChanged = action == null ? ignored -> {} : action;
    }

    public void showMapName(String mapName) {
        mapLabel.setText(mapName == null || mapName.isBlank() ? "Dungeon" : mapName);
    }

    public void showLevel(int level) {
        levelLabel.setText("Ebene z=" + level);
    }

    public void showOverlayMode(OverlayMode overlayMode) {
        OverlayMode resolved = overlayMode == null ? OverlayMode.OFF : overlayMode;
        overlayButton.setText(resolved.label());
    }

    private HBox levelRow() {
        overlayButton.getStyleClass().addAll("toolbar-action-button", "dungeon-overlay-trigger");
        overlayButton.setOnAction(event -> toggleOverlayPopup(overlayButton));
        HBox row = new HBox(8, levelLabel, previousLevelButton, nextLevelButton, spacer(), overlayButton);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private HBox actionRow() {
        HBox row = new HBox(8, refreshButton, resetViewButton);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private void configureOverlayPopup() {
        VBox content = new VBox(6);
        content.setPadding(new Insets(8));
        content.getStyleClass().addAll("filter-dropdown", "dungeon-overlay-dropdown");
        content.getChildren().addAll(
                overlayOption(OverlayMode.OFF),
                overlayOption(OverlayMode.NEARBY),
                overlayOption(OverlayMode.SELECTED));
        overlayPopup.getContent().setAll(content);
        overlayPopup.setAutoHide(true);
        overlayPopup.addEventFilter(KeyEvent.KEY_PRESSED, event -> {
            if (event.getCode() == KeyCode.ESCAPE) {
                overlayPopup.hide();
                event.consume();
            }
        });
    }

    private Button overlayOption(OverlayMode mode) {
        Button button = new Button(mode.label());
        button.getStyleClass().add("tool-btn");
        button.setMaxWidth(Double.MAX_VALUE);
        button.setOnAction(event -> {
            onOverlayModeChanged.accept(mode);
            overlayPopup.hide();
        });
        return button;
    }

    private void toggleOverlayPopup(Node anchor) {
        if (overlayPopup.isShowing()) {
            overlayPopup.hide();
            return;
        }
        var bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        if (bounds != null) {
            overlayPopup.show(anchor, bounds.getMinX(), bounds.getMaxY() + 2.0);
        }
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    private static Region spacer() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        return spacer;
    }

    enum OverlayMode {
        OFF("Aus"),
        NEARBY("Nachbarn"),
        SELECTED("Auswahl");

        private final String label;

        OverlayMode(String label) {
            this.label = label;
        }

        String label() {
            return label;
        }
    }
}
