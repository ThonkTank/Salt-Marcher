package features.world.dungeonmap.ui.editor.screen;

import features.world.dungeonmap.ui.editor.chrome.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.chrome.map.DungeonMapControlsPane;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.StackPane;
import ui.shell.AppView;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class DungeonEditorWorkspaceView implements AppView {

    private enum Mode {
        RASTER,
        CONCEPT
    }

    private final ModeBinding rasterMode;
    private final ModeBinding conceptMode;
    private final StackPane controlsHost = new StackPane();
    private final StackPane mainHost = new StackPane();
    private final StackPane stateHost = new StackPane();
    private final HBox modeToggle = new HBox(4);
    private final ToggleButton rasterButton = new ToggleButton("Raster");
    private final ToggleButton conceptButton = new ToggleButton("Konzept");

    private Mode activeMode = Mode.RASTER;
    private boolean showing = false;

    public DungeonEditorWorkspaceView(ModeBinding rasterMode, ModeBinding conceptMode) {
        this.rasterMode = Objects.requireNonNull(rasterMode, "rasterMode");
        this.conceptMode = Objects.requireNonNull(conceptMode, "conceptMode");

        ToggleGroup modeGroup = new ToggleGroup();
        rasterButton.setToggleGroup(modeGroup);
        conceptButton.setToggleGroup(modeGroup);
        rasterButton.getStyleClass().add("tool-btn");
        conceptButton.getStyleClass().add("tool-btn");
        rasterButton.setSelected(true);
        rasterButton.setOnAction(event -> switchMode(Mode.RASTER));
        conceptButton.setOnAction(event -> switchMode(Mode.CONCEPT));

        modeToggle.setAlignment(Pos.CENTER_LEFT);
        modeToggle.getChildren().addAll(rasterButton, conceptButton);

        refreshHosts();
    }

    @Override
    public Node getMainContent() {
        return mainHost;
    }

    @Override
    public String getTitle() {
        return "Dungeoneditor";
    }

    @Override
    public String getIconText() {
        return "\u25a6";
    }

    @Override
    public Node getControlsContent() {
        return controlsHost;
    }

    @Override
    public Node getStateContent() {
        return stateHost;
    }

    @Override
    public void onShow() {
        showing = true;
        activeView().onShow();
    }

    @Override
    public void onHide() {
        showing = false;
        activeView().onHide();
    }

    private void switchMode(Mode nextMode) {
        if (nextMode == activeMode) {
            syncToggleSelection();
            return;
        }
        Long mapId = activeMode().currentMapId().get();
        if (showing) {
            activeView().onHide();
        }
        activeMode = nextMode;
        activeMode().setPreferredMapId().accept(mapId);
        refreshHosts();
        syncToggleSelection();
        if (showing) {
            activeView().onShow();
        }
    }

    private void refreshHosts() {
        AppView activeView = activeView();
        setHostContent(controlsHost, activeView.getControlsContent());
        setHostContent(mainHost, activeView.getMainContent());
        setHostContent(stateHost, activeView.getStateContent());
        Node controls = activeView.getControlsContent();
        if (controls instanceof DungeonMapControlsPane mapControlsPane) {
            mapControlsPane.setInlineTrailingNode(modeToggle);
        } else if (controls instanceof DungeonEditorControls editorControls) {
            editorControls.setInlineTrailingNode(modeToggle);
        }
    }

    private void setHostContent(StackPane host, Node content) {
        if (content == null) {
            host.getChildren().clear();
            return;
        }
        if (!host.getChildren().contains(content)) {
            host.getChildren().setAll(content);
        }
    }

    private void syncToggleSelection() {
        rasterButton.setSelected(activeMode == Mode.RASTER);
        conceptButton.setSelected(activeMode == Mode.CONCEPT);
    }

    private AppView activeView() {
        return activeMode().view();
    }

    private ModeBinding activeMode() {
        return activeMode == Mode.RASTER ? rasterMode : conceptMode;
    }

    public record ModeBinding(AppView view, Supplier<Long> currentMapId, Consumer<Long> setPreferredMapId) {
        public ModeBinding {
            Objects.requireNonNull(view, "view");
            Objects.requireNonNull(currentMapId, "currentMapId");
            Objects.requireNonNull(setPreferredMapId, "setPreferredMapId");
        }
    }
}
