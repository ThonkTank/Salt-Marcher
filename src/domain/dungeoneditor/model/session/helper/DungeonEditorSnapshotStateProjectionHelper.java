package src.domain.dungeoneditor.model.session.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSession;

final class DungeonEditorSnapshotStateProjectionHelper {

    private DungeonEditorSnapshotStateProjectionHelper() {
    }

    static DungeonEditorSession safeState(@Nullable DungeonEditorSession state) {
        return state == null ? DungeonEditorSession.empty() : state;
    }
}
