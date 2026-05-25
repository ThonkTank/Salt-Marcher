package src.domain.dungeon.model.worldspace.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSession;

public interface DungeonEditorSnapshotStateProjectionHelper {

    static DungeonEditorSession safeState(@Nullable DungeonEditorSession state) {
        return state == null ? DungeonEditorSession.empty() : state;
    }
}
