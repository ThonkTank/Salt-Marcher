package features.dungeon.api.editor;

import java.util.function.Consumer;

/** Atomic editor-session capability consumed outside the Dungeon application layer. */
public interface DungeonEditorApi {

    DungeonEditorState current();

    Runnable subscribe(Consumer<DungeonEditorState> subscriber);

    void dispatch(DungeonEditorIntent intent);
}
