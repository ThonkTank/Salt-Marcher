package src.domain.dungeon.model.editor.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSession;

public final class DungeonEditorSnapshotStateProjectionHelper {

    private DungeonEditorSnapshotStateProjectionHelper() {
    }

    public static DungeonEditorSession safeState(@Nullable DungeonEditorSession state) {
        return state == null ? DungeonEditorSession.empty() : state;
    }
}
