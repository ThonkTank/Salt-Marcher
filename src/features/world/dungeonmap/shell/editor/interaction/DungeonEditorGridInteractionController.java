package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasInteractionHandler;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DungeonEditorGridInteractionController implements DungeonCanvasInteractionHandler {

    private final DungeonMapState mapState;
    private final DungeonEditorSessionState sessionState;
    private final Map<DungeonEditorTool, EditorToolHandler> handlersByTool;
    private EditorToolHandler activeHandler;
    private DungeonEditorTool activeTool;

    public DungeonEditorGridInteractionController(
            DungeonMapState mapState,
            DungeonEditorSessionState sessionState,
            List<EditorToolHandler> handlers
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.handlersByTool = buildHandlerMap(Objects.requireNonNull(handlers, "handlers"));
    }

    @Override
    public boolean handlePressed(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled()) {
            clearActiveHandler();
            return false;
        }
        return activeHandler != null && activeHandler.handlePressed(event);
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled()) {
            return false;
        }
        return activeHandler != null && activeHandler.handleDragged(event);
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled()) {
            return false;
        }
        return activeHandler != null && activeHandler.handleReleased(event);
    }

    @Override
    public boolean handleLevelScroll(int levelDelta) {
        if (!interactionEnabled()) {
            return false;
        }
        return activeHandler != null && activeHandler.handleLevelScroll(levelDelta);
    }

    public void activateTool(DungeonEditorTool tool) {
        EditorToolHandler nextHandler = handlersByTool.get(tool);
        if (nextHandler == null) {
            clearActiveHandler();
            return;
        }
        if (activeHandler == nextHandler && Objects.equals(activeTool, tool)) {
            return;
        }
        if (activeHandler != null && activeHandler != nextHandler) {
            activeHandler.deactivate();
        }
        activeHandler = nextHandler;
        activeTool = tool;
        activeHandler.activate(tool);
    }

    public void clearActiveHandler() {
        if (activeHandler == null) {
            return;
        }
        activeHandler.deactivate();
        activeHandler = null;
        activeTool = null;
    }

    public EditorToolHandler activeHandler() {
        return activeHandler;
    }

    private boolean interactionEnabled() {
        return sessionState.viewMode() == DungeonViewMode.GRID && !mapState.loading();
    }

    private static Map<DungeonEditorTool, EditorToolHandler> buildHandlerMap(List<EditorToolHandler> handlers) {
        Map<DungeonEditorTool, EditorToolHandler> handlersByTool = new EnumMap<>(DungeonEditorTool.class);
        for (EditorToolHandler handler : handlers) {
            Objects.requireNonNull(handler, "handler");
            for (DungeonEditorTool tool : handler.supportedTools()) {
                EditorToolHandler previous = handlersByTool.put(tool, handler);
                if (previous != null) {
                    throw new IllegalArgumentException("Duplicate editor tool handler for " + tool);
                }
            }
        }
        return Map.copyOf(handlersByTool);
    }
}
