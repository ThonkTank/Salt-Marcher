package features.world.dungeon.shell.editor.interaction.input;

import features.world.dungeon.shell.editor.interaction.state.BoundaryTool;
import features.world.dungeon.shell.editor.interaction.state.CorridorTool;
import features.world.dungeon.shell.editor.interaction.state.DoorTool;
import features.world.dungeon.shell.editor.interaction.state.FloorTool;
import features.world.dungeon.shell.editor.interaction.state.PaintTool;
import features.world.dungeon.shell.editor.interaction.state.SelectionTool;
import features.world.dungeon.shell.editor.interaction.state.StairTool;
import features.world.dungeon.shell.editor.interaction.state.TransitionTool;

import features.world.dungeon.state.DungeonEditorTool;
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
