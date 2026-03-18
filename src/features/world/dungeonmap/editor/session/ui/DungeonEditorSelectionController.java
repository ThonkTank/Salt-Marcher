package features.world.dungeonmap.editor.session.ui;

import features.world.dungeonmap.editor.session.ui.edit.DungeonEditorSessionEditOutcome;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.view.model.DungeonSelection;

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
