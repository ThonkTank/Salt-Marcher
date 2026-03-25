package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasInteractionHandler;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import javafx.scene.Node;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonEditorGridInteractionController implements DungeonCanvasInteractionHandler {

    private final DungeonMapState mapState;
    private final DungeonEditorSessionState sessionState;
    private final DungeonGridHitTester hitTester = new DungeonGridHitTester();
    private final Map<DungeonEditorTool, EditorTool> toolsByTool;
    private EditorTool activeToolInstance;
    private DungeonEditorTool activeTool;

    public DungeonEditorGridInteractionController(
            DungeonMapState mapState,
            DungeonEditorSessionState sessionState,
            List<EditorTool> tools
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.toolsByTool = buildToolMap(Objects.requireNonNull(tools, "tools"));
    }

    @Override
    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        if (!interactionEnabled()) {
            clearActiveTool();
            return false;
        }
        return activeToolInstance != null && activeToolInstance.pressed(context(event));
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        if (!interactionEnabled()) {
            return false;
        }
        return activeToolInstance != null && activeToolInstance.dragged(context(event));
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        if (!interactionEnabled()) {
            return false;
        }
        return activeToolInstance != null && activeToolInstance.released(context(event));
    }

    @Override
    public boolean handleLevelScroll(int levelDelta) {
        if (!interactionEnabled()) {
            return false;
        }
        return activeToolInstance != null && activeToolInstance.levelScrolled(context(null), levelDelta);
    }

    public void activateTool(DungeonEditorTool tool) {
        EditorTool nextTool = toolsByTool.get(tool);
        if (nextTool == null) {
            clearActiveTool();
            return;
        }
        if (activeToolInstance == nextTool && Objects.equals(activeTool, tool)) {
            return;
        }
        if (activeToolInstance != null && activeToolInstance != nextTool) {
            activeToolInstance.deactivate();
        }
        activeToolInstance = nextTool;
        activeTool = tool;
        activeToolInstance.activate(tool);
    }

    public void clearActiveTool() {
        if (activeToolInstance == null) {
            return;
        }
        activeToolInstance.deactivate();
        activeToolInstance = null;
        activeTool = null;
    }

    public EditorTool activeTool() {
        return activeToolInstance;
    }

    private boolean interactionEnabled() {
        return sessionState.viewMode() == DungeonViewMode.GRID && !mapState.loading();
    }

    private EditorToolContext context(DungeonCanvasPointerEvent event) {
        return new EditorToolContext(
                event,
                projectedLayout(),
                hitTester,
                event == null ? null : event.camera(),
                null);
    }

    private DungeonLayout projectedLayout() {
        DungeonLayout layout = mapState.activeMap();
        if (layout == null) {
            return DungeonLayout.empty();
        }
        return layout.projectedToLevel(mapState.activeProjectionLevel());
    }

    private static Map<DungeonEditorTool, EditorTool> buildToolMap(List<EditorTool> tools) {
        Map<DungeonEditorTool, EditorTool> toolsByTool = new EnumMap<>(DungeonEditorTool.class);
        for (EditorTool editorTool : tools) {
            Objects.requireNonNull(editorTool, "editorTool");
            for (DungeonEditorTool tool : editorTool.supportedTools()) {
                EditorTool previous = toolsByTool.put(tool, editorTool);
                if (previous != null) {
                    throw new IllegalArgumentException("Duplicate editor tool for " + tool);
                }
            }
        }
        return Map.copyOf(toolsByTool);
    }
}

final class LegacyEditorToolAdapter implements EditorTool {

    private final EditorToolHandler handler;

    LegacyEditorToolAdapter(EditorToolHandler handler) {
        this.handler = Objects.requireNonNull(handler, "handler");
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return handler.supportedTools();
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        handler.activate(tool);
    }

    @Override
    public void deactivate() {
        handler.deactivate();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        return handler.handlePressed(ctx == null ? null : ctx.event());
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        return handler.handleDragged(ctx == null ? null : ctx.event());
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        return handler.handleReleased(ctx == null ? null : ctx.event());
    }

    @Override
    public boolean levelScrolled(EditorToolContext ctx, int delta) {
        return handler.handleLevelScroll(delta);
    }

    @Override
    public Node statePaneContent() {
        return handler.statePaneContent();
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        handler.setRefreshCallback(callback);
    }
}
