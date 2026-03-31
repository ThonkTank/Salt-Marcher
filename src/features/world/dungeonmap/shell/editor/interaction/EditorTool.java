package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.interaction.DungeonSelectionKey;
import javafx.scene.Node;

import java.util.Set;

public sealed interface EditorTool
        permits SelectionTool, PaintTool, BoundaryTool, ConnectionsTool, TransitionTool {

    Set<DungeonEditorTool> supportedTools();

    void activate(DungeonEditorTool tool);

    void deactivate();

    boolean pressed(EditorToolContext ctx);

    boolean dragged(EditorToolContext ctx);

    boolean released(EditorToolContext ctx);

    default DungeonSelectionKey hoverSelectionKey(EditorToolContext ctx) {
        return ctx == null || ctx.selection() == null ? null : ctx.selection().primaryKey();
    }

    default void levelScrolled(int delta) {
    }

    Node statePaneContent();

    void setRefreshCallback(Runnable callback);
}
