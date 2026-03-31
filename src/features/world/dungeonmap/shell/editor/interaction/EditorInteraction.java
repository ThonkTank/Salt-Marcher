package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasInteractionHandler;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.interaction.DungeonDragService;
import features.world.dungeonmap.shell.interaction.DungeonEditorInteractionPolicy;
import features.world.dungeonmap.shell.interaction.DungeonHitService;
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
    private final DungeonEditorHitService hitService = new DungeonEditorHitService();
    private final DungeonEditorInteractionPolicy interactionPolicy = new DungeonEditorInteractionPolicy(
            new DungeonHitService(),
            new DungeonDragService(),
            new DungeonPlacementValidator(),
            hitService);
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
        DungeonEditorInteractionPolicy.EditorInteractionDecision decision = interactionPolicy.decidePress(
                projectedLayout(),
                event,
                camera,
                mapState.activeProjectionLevel());
        if (!decision.dispatchToTool()) {
            return false;
        }
        return activeTool.pressed(contextFor(event, camera));
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled()) {
            return false;
        }
        if (activeTool == null) {
            return false;
        }
        if (!interactionPolicy.decideDrag(projectedLayout(), event, camera, mapState.activeProjectionLevel())) {
            return false;
        }
        return activeTool.dragged(contextFor(event, camera));
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled()) {
            return false;
        }
        if (activeTool == null) {
            return false;
        }
        if (!interactionPolicy.decideRelease(projectedLayout(), event, camera, mapState.activeProjectionLevel())) {
            return false;
        }
        return activeTool.released(contextFor(event, camera));
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

    private EditorToolContext contextFor(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        return new EditorToolContext(event, projectedLayout(), hitService, camera, state);
    }

    private DungeonLayout projectedLayout() {
        DungeonLayout layout = mapState.activeMap();
        return layout == null ? DungeonLayout.empty() : layout.projectedToLevel(mapState.activeProjectionLevel());
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
}
