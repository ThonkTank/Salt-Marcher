package src.domain.dungeoneditor.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.session.entity.DungeonEditorSession;

final class DungeonEditorSnapshotStateSupport {

    private DungeonEditorSnapshotStateSupport() {
    }

    static DungeonEditorSession safeState(@Nullable DungeonEditorSession state) {
        return state == null ? DungeonEditorSession.empty() : state;
    }
}
