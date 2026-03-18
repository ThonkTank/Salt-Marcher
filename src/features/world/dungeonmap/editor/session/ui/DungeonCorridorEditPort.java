package features.world.dungeonmap.editor.session.ui;

import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;

/**
 * Narrow port through which {@link features.world.dungeonmap.editor.session.ui.tool.DungeonCorridorDraftController}
 * submits a completed corridor endpoint pair to the edit layer.
 */
public interface DungeonCorridorEditPort {
    void dispatchCorridorSelection(DungeonCorridorEndpoint start, DungeonCorridorEndpoint target);
}
