package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasInteractionHandler;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.interaction.DungeonHitCollector;
import features.world.dungeonmap.shell.interaction.DungeonHitProbe;
import features.world.dungeonmap.shell.interaction.DungeonHitSnapshot;
import features.world.dungeonmap.shell.interaction.DungeonPlacementValidator;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import javafx.scene.Node;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class EditorInteraction implements DungeonCanvasInteractionHandler {

    private final DungeonMapState mapState;
    private final DungeonEditorSessionState sessionState;
    private final EditorInteractionState state;
    private final Map<DungeonEditorTool, EditorTool> toolsByEnum;
    private final DungeonHitCollector hitCollector = new DungeonHitCollector();
    private final DungeonEditorSelectionPolicy selectionPolicy = new DungeonEditorSelectionPolicy(
            new DungeonPlacementValidator());
    private EditorTool activeTool;
    private Runnable toolStateChanged = () -> { };

    public EditorInteraction(
            DungeonMapState mapState,
            DungeonEditorSessionState sessionState,
            EditorInteractionState state,
            List<EditorTool> tools
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.state = Objects.requireNonNull(state, "state");
        List<EditorTool> toolList = List.copyOf(Objects.requireNonNull(tools, "tools"));
        this.toolsByEnum = buildToolMap(toolList);
        toolList.forEach(tool -> tool.setRefreshCallback(() -> toolStateChanged.run()));
    }

    @Override
    public boolean handlePressed(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled()) {
            return false;
        }
        if (activeTool == null) {
            return false;
        }
        EditorContextSnapshot snapshot = collect(event, camera);
        if (snapshot == null) {
            return false;
        }
        var decision = selectionPolicy.select(
                DungeonEditorSelectionPolicy.EditorInteractionPhase.PRESS,
                sessionState.selectedTool(),
                snapshot.activeMap(),
                event,
                snapshot.hitSnapshot());
        if (!decision.dispatchToTool()) {
            return false;
        }
        return activeTool.pressed(contextFor(event, snapshot, decision.selection()));
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled()) {
            return false;
        }
        if (activeTool == null) {
            return false;
        }
        EditorContextSnapshot snapshot = collect(event, camera);
        if (snapshot == null) {
            return false;
        }
        var decision = selectionPolicy.select(
                DungeonEditorSelectionPolicy.EditorInteractionPhase.DRAG,
                sessionState.selectedTool(),
                snapshot.activeMap(),
                event,
                snapshot.hitSnapshot());
        if (!decision.dispatchToTool()) {
            return false;
        }
        return activeTool.dragged(contextFor(event, snapshot, decision.selection()));
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled()) {
            return false;
        }
        if (activeTool == null) {
            return false;
        }
        EditorContextSnapshot snapshot = collect(event, camera);
        if (snapshot == null) {
            return false;
        }
        var decision = selectionPolicy.select(
                DungeonEditorSelectionPolicy.EditorInteractionPhase.RELEASE,
                sessionState.selectedTool(),
                snapshot.activeMap(),
                event,
                snapshot.hitSnapshot());
        if (!decision.dispatchToTool()) {
            return false;
        }
        return activeTool.released(contextFor(event, snapshot, decision.selection()));
    }

    @Override
    public void levelScrolled(int levelDelta) {
        if (activeTool != null) {
            activeTool.levelScrolled(levelDelta);
        }
    }

    public void activateTool(DungeonEditorTool tool) {
        EditorTool next = toolsByEnum.get(tool);
        if (activeTool != null && activeTool != next) {
            activeTool.deactivate();
            state.clearPreview();
        }
        activeTool = next;
        if (activeTool != null) {
            activeTool.activate(tool);
        }
    }

    public EditorInteractionState state() {
        return state;
    }

    public Node activeToolPane() {
        return activeTool == null ? null : activeTool.statePaneContent();
    }

    public void setOnToolStateChanged(Runnable callback) {
        toolStateChanged = callback == null ? () -> { } : callback;
    }

    private boolean interactionEnabled() {
        return sessionState.viewMode() == DungeonViewMode.GRID && !mapState.busy();
    }

    private EditorToolContext contextFor(
            DungeonCanvasPointerEvent event,
            EditorContextSnapshot snapshot,
            features.world.dungeonmap.shell.interaction.DungeonSelection selection
    ) {
        return new EditorToolContext(
                event,
                snapshot.activeMap(),
                snapshot.probe(),
                snapshot.hitSnapshot(),
                selection,
                state);
    }

    private EditorContextSnapshot collect(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (event == null || event.canvasPoint() == null || event.gridCell() == null || camera == null) {
            return null;
        }
        DungeonLayout layout = mapState.activeMap();
        DungeonLayout activeMap = layout == null ? DungeonLayout.empty() : layout;
        DungeonHitProbe probe = new DungeonHitProbe(
                event.canvasPoint(),
                event.gridCell(),
                mapState.activeProjectionLevel(),
                camera.panX(),
                camera.panY(),
                DungeonCanvasTheme.BASE_GRID * camera.zoom());
        DungeonHitSnapshot hitSnapshot = hitCollector.collect(activeMap, probe);
        return new EditorContextSnapshot(activeMap, camera, probe, hitSnapshot);
    }

    private static Map<DungeonEditorTool, EditorTool> buildToolMap(List<EditorTool> tools) {
        Map<DungeonEditorTool, EditorTool> toolsByEnum = new EnumMap<>(DungeonEditorTool.class);
        for (EditorTool tool : tools) {
            Objects.requireNonNull(tool, "tool");
            for (DungeonEditorTool supportedTool : tool.supportedTools()) {
                EditorTool previous = toolsByEnum.put(supportedTool, tool);
                if (previous != null) {
                    throw new IllegalArgumentException("Duplicate editor tool for " + supportedTool);
                }
            }
        }
        return Map.copyOf(toolsByEnum);
    }

    private record EditorContextSnapshot(
            DungeonLayout activeMap,
            DungeonCanvasCamera camera,
            DungeonHitProbe probe,
            DungeonHitSnapshot hitSnapshot
    ) {
    }
}
