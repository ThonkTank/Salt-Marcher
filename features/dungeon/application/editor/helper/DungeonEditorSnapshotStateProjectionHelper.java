package features.dungeon.application.editor.helper;

import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorSession;

public interface DungeonEditorSnapshotStateProjectionHelper {

    static DungeonEditorSession safeState(@Nullable DungeonEditorSession state) {
        return state == null ? DungeonEditorSession.empty() : state;
    }
}
