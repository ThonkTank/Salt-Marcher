package features.world.dungeon.shell.editor.interaction.input;

import features.world.dungeon.state.DungeonEditorTool;
import javafx.scene.Node;

import java.util.List;
import java.util.Set;

public interface EditorTool {

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
