package features.world.quarantine.dungeonmap.editor.session.edit;

import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;

/**
 * Narrow port through which {@link features.world.quarantine.dungeonmap.editor.session.tool.DungeonCorridorDraftController}
 * submits a completed corridor endpoint pair to the edit layer.
 */
public interface DungeonCorridorEditPort {
    void dispatchCorridorSelection(DungeonCorridorEndpoint start, DungeonCorridorEndpoint target);
}
