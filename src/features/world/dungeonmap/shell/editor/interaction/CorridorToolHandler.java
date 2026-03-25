package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonCorridorDraftState;
import features.world.dungeonmap.state.EditorSelectionState;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.Objects;
import java.util.Set;

public final class CorridorToolHandler implements EditorToolHandler {

    private final CorridorInteractionController controller;
    private final EditorSelectionState selectionState;
    private final DungeonCorridorDraftState corridorDraftState;
    private final Label statusLabel = new Label("Kein Korridor gewählt");
    private final VBox statusCard = createCard("Korridor", statusLabel);

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };

    public CorridorToolHandler(
            CorridorInteractionController controller,
            EditorSelectionState selectionState,
            DungeonCorridorDraftState corridorDraftState
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.selectionState = Objects.requireNonNull(selectionState, "selectionState");
        this.corridorDraftState = Objects.requireNonNull(corridorDraftState, "corridorDraftState");
        this.selectionState.addListener(this::refreshStatePane);
        this.corridorDraftState.addListener(this::refreshStatePane);
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.CORRIDOR_CREATE, DungeonEditorTool.CORRIDOR_DELETE);
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
        String statusText = corridorStatusText();
        if (statusText == null || statusText.isBlank()) {
            statusLabel.setText("Kein Korridor gewählt");
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

    private String corridorStatusText() {
        if (activeTool == null) {
            return null;
        }
        if (corridorDraftState.hasPendingStart()) {
            String startLabel = corridorDraftState.pendingStartDisplayLabel();
            return (startLabel == null || startLabel.isBlank() ? "Start gewählt" : "Start: " + startLabel)
                    + " auf z=" + corridorDraftState.pendingStartLevel()
                    + ", Zielraum oder Korridor anklicken";
        }
        String selectedTargetKey = selectionState.selectedTargetKey();
        if (Corridor.isTargetKey(selectedTargetKey)) {
            Long corridorId = Corridor.corridorIdFromKey(selectedTargetKey);
            return "Gewählt: " + (corridorId == null ? "Korridor" : "Korridor " + corridorId);
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
