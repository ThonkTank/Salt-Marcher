package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import javafx.scene.Node;

import java.util.Objects;
import java.util.Set;

public final class LegacyEditorToolAdapter implements EditorTool {

    private final EditorToolHandler handler;

    public LegacyEditorToolAdapter(EditorToolHandler handler) {
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
