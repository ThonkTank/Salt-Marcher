package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasInteractionHandler;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.shell.interaction.DungeonHitCollector;
import features.world.dungeonmap.shell.interaction.DungeonHitProbe;
import features.world.dungeonmap.shell.interaction.DungeonHitSnapshot;
import features.world.dungeonmap.state.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonViewMode;
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
    private final DungeonHitCollector hitCollector;
    private EditorTool activeTool;
    private Runnable toolStateChanged = () -> { };

    public EditorInteraction(
            DungeonMapState mapState,
            DungeonEditorSessionState sessionState,
            EditorInteractionState state,
            DungeonHitCollector hitCollector,
            List<EditorTool> tools
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.state = Objects.requireNonNull(state, "state");
        this.hitCollector = Objects.requireNonNull(hitCollector, "hitCollector");
        List<EditorTool> toolList = List.copyOf(Objects.requireNonNull(tools, "tools"));
        this.toolsByEnum = buildToolMap(toolList);
        toolList.forEach(tool -> tool.setRefreshCallback(() -> toolStateChanged.run()));
    }

    @Override
    public boolean handlePressed(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled() || activeTool == null || !dispatchAllowed(EditorToolPhase.PRESS, event)) {
            return false;
        }
        EditorToolContext context = collect(event, camera);
        if (context == null) {
            return false;
        }
        return activeTool.pressed(resolve(context, EditorToolPhase.PRESS));
    }

    @Override
    public void handleMoved(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled() || activeTool == null) {
            state.clearHover();
            return;
        }
        EditorToolContext context = collect(event, camera);
        if (context == null) {
            state.clearHover();
            return;
        }
        resolve(context, EditorToolPhase.HOVER);
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled() || activeTool == null || !dispatchAllowed(EditorToolPhase.DRAG, event)) {
            return false;
        }
        EditorToolContext context = collect(event, camera);
        if (context == null) {
            return false;
        }
        return activeTool.dragged(resolve(context, EditorToolPhase.DRAG));
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled() || activeTool == null || !dispatchAllowed(EditorToolPhase.RELEASE, event)) {
            return false;
        }
        EditorToolContext context = collect(event, camera);
        if (context == null) {
            return false;
        }
        return activeTool.released(resolve(context, EditorToolPhase.RELEASE));
    }

    @Override
    public void levelScrolled(int levelDelta) {
        if (activeTool != null) {
            activeTool.levelScrolled(levelDelta);
        }
    }

    @Override
    public void handleExited() {
        state.clearHover();
    }

    public void activateTool(DungeonEditorTool tool) {
        EditorTool next = toolsByEnum.get(tool);
        if (activeTool != null && activeTool != next) {
            activeTool.deactivate();
            state.clearPreview();
        }
        activeTool = next;
        state.clearHover();
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

    private EditorToolContext resolve(EditorToolContext baseContext, EditorToolPhase phase) {
        EditorHitResolution resolution = activeTool == null
                ? EditorHitResolution.none()
                : activeTool.resolveHit(baseContext, phase);
        if (phase == EditorToolPhase.HOVER) {
            state.showHover(resolution.hover());
        }
        return new EditorToolContext(
                baseContext.event(),
                baseContext.activeMap(),
                baseContext.probe(),
                baseContext.snapshot(),
                resolution.subject(),
                resolution.resolvedRef(),
                baseContext.state());
    }

    private EditorToolContext collect(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (event == null || event.canvasPoint() == null || event.gridCell() == null || camera == null) {
            return null;
        }
        DungeonLayout layout = mapState.activeMap();
        DungeonLayout activeMap = layout == null ? DungeonLayout.empty() : layout;
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        DungeonHitProbe probe = new DungeonHitProbe(
                event.canvasPoint(),
                event.gridCell(),
                DungeonHitProbe.point2xForCanvas(event.canvasPoint(), camera.panX(), camera.panY(), gridSize),
                mapState.activeProjectionLevel(),
                camera.panX(),
                camera.panY(),
                gridSize);
        DungeonHitSnapshot hitSnapshot = hitCollector.collect(activeMap, probe);
        return new EditorToolContext(event, activeMap, probe, hitSnapshot, null, null, state);
    }

    private static boolean dispatchAllowed(EditorToolPhase phase, DungeonCanvasPointerEvent event) {
        if (event == null) {
            return false;
        }
        return switch (phase) {
            case HOVER -> true;
            case PRESS -> event.isPrimaryButton() || event.isSecondaryButton();
            case DRAG -> event.isPrimaryButtonDown();
            case RELEASE -> true;
        };
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
