package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonBoundaryDraftState;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.Objects;
import java.util.Set;

public final class BoundaryToolHandler implements EditorToolHandler {

    private final BoundaryInteractionController controller;
    private final DungeonBoundaryDraftState boundaryDraftState;
    private final Label statusLabel = new Label("Kein Wandpfad aktiv");
    private final VBox statusCard = createCard("Wandpfad", statusLabel);

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };

    public BoundaryToolHandler(
            BoundaryInteractionController controller,
            DungeonBoundaryDraftState boundaryDraftState
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.boundaryDraftState = Objects.requireNonNull(boundaryDraftState, "boundaryDraftState");
        this.boundaryDraftState.addListener(this::refreshStatePane);
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(
                DungeonEditorTool.CLUSTER_WALL,
                DungeonEditorTool.CLUSTER_WALL_DELETE,
                DungeonEditorTool.CLUSTER_DOOR,
                DungeonEditorTool.CLUSTER_DOOR_DELETE);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
    }

    @Override
    public void deactivate() {
        activeTool = null;
        controller.clear();
    }

    @Override
    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        return controller.handlePressed(event);
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        return controller.handleDragged(event);
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        return controller.handleReleased(event);
    }

    @Override
    public Node statePaneContent() {
        String statusText = boundaryStatusText();
        if (statusText == null || statusText.isBlank()) {
            statusLabel.setText("Kein Wandpfad aktiv");
            return null;
        }
        statusLabel.setText(statusText);
        return statusCard;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
    }

    private void refreshStatePane() {
        if (activeTool != null) {
            refreshCallback.run();
        }
    }

    private String boundaryStatusText() {
        if (activeTool == null) {
            return null;
        }
        DungeonBoundaryDraftState.Draft draft = boundaryDraftState.draft();
        if (draft != null) {
            return draft.statusMessage();
        }
        if (activeTool == DungeonEditorTool.CLUSTER_WALL) {
            return "Eckpunkte anklicken, Rechtsklick schließt ab";
        }
        if (activeTool == DungeonEditorTool.CLUSTER_WALL_DELETE) {
            return "Eckpunkte auf bestehender Innenwand anklicken, Rechtsklick schließt ab";
        }
        return null;
    }

    private static VBox createCard(String title, Label contentLabel) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        contentLabel.setWrapText(true);
        VBox card = new VBox(6, titleLabel, contentLabel);
        card.getStyleClass().add("editor-card");
        return card;
    }
}
