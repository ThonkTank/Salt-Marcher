package src.domain.dungeon.model.runtime.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSession;

public interface DungeonEditorSnapshotStateProjectionHelper {

    static DungeonEditorSession safeState(@Nullable DungeonEditorSession state) {
        return state == null ? DungeonEditorSession.empty() : state;
    }
}
