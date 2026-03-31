package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.shell.interaction.DungeonHitProbe;
import features.world.dungeonmap.shell.interaction.DungeonHitSnapshot;
import features.world.dungeonmap.shell.interaction.DungeonSelection;
import features.world.dungeonmap.state.EditorInteractionState;

public record EditorToolContext(
        DungeonCanvasPointerEvent event,
        DungeonLayout activeMap,
        DungeonHitProbe probe,
        DungeonHitSnapshot snapshot,
        DungeonSelection selection,
        EditorInteractionState state
) {
    public EditorToolContext {
        activeMap = activeMap == null ? DungeonLayout.empty() : activeMap;
    }
}
