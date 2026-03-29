package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import javafx.scene.Node;

import java.util.Set;

public sealed interface EditorTool
        permits SelectionTool, PaintTool, BoundaryTool,
                TransitionTool, TraversalTool {

    Set<DungeonEditorTool> supportedTools();

    void activate(DungeonEditorTool tool);

    void deactivate();

    boolean pressed(EditorToolContext ctx);

    boolean dragged(EditorToolContext ctx);

    boolean released(EditorToolContext ctx);

    default void levelScrolled(int delta) {
    }

    Node statePaneContent();

    void setRefreshCallback(Runnable callback);
}
