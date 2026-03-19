package features.world.quarantine.dungeonmap.editor.session.selection;

import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorSessionEditOutcome;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;

/**
 * Narrow selection port used by edit and tool subclasses to feed selection changes
 * back into the session without depending on the full coordinator.
 */
public interface DungeonEditorSelectionController {

    void selectCorridorTargetSelection(DungeonCorridorEndpoint target);

    void prepareLayoutRefreshSelection(
            DungeonLayout layout,
            DungeonSelection target,
            DungeonEditorSessionEditOutcome.CorridorSelectionIntent corridorSelectionIntent);

    DungeonSelection selectedTarget();
}
