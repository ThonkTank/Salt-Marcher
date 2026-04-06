package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.state.DungeonEditorTool;
import javafx.scene.Node;

import java.util.List;
import java.util.Set;

public sealed interface EditorTool
        permits SelectionTool, PaintTool, FloorTool, BoundaryTool, DoorTool, CorridorTool, StairTool, TransitionTool {

    Set<DungeonEditorTool> supportedTools();

    void activate(DungeonEditorTool tool);

    void deactivate();

    boolean pressed(EditorToolContext ctx);

    boolean dragged(EditorToolContext ctx);

    boolean released(EditorToolContext ctx);

    List<EditorInteractionCapability> interactionCapabilities(EditorToolContext ctx, EditorToolPhase phase);

    default void levelScrolled(int delta) {
    }

    Node statePaneContent();

    void setRefreshCallback(Runnable callback);
}
