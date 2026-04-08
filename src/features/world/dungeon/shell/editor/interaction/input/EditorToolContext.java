package features.world.dungeon.shell.editor.interaction.input;

import features.world.dungeon.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.shell.interaction.DungeonHitProbe;
import features.world.dungeon.shell.interaction.DungeonHitSnapshot;
import features.world.dungeon.state.EditorInteractionState;

public record EditorToolContext(
        DungeonCanvasPointerEvent event,
        DungeonMap activeMap,
        DungeonHitProbe probe,
        DungeonHitSnapshot snapshot,
        DungeonSelectionRef hitRef,
        DungeonSelectionRef resolvedRef,
        EditorInteractionState state
) {
    public EditorToolContext {
        activeMap = activeMap == null ? DungeonMap.empty() : activeMap;
    }

    public DungeonSelectionRef ownerRef(DungeonSelectionRef ref) {
        return activeMap.ownerRef(ref);
    }
}
