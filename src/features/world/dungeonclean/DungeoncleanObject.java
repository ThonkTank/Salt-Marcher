package features.world.dungeonclean;

import features.world.dungeonclean.cluster.ClusterObject;
import features.world.dungeonclean.cluster.input.LoadClusterRewriteTailStatusInput;
import features.world.dungeonclean.editor.EditorObject;
import features.world.dungeonclean.editor.input.ComposeEditorInput;
import features.world.dungeonclean.input.ViewsInput;

/**
 * Public clean dungeon rebuild seam. Migrated capabilities live under clean child owners until a stable top-level
 * composition surface is warranted.
 */
@SuppressWarnings("unused")
public final class DungeoncleanObject {

    private final ViewsInput views;

    public DungeoncleanObject() {
        ClusterObject clusterObject = new ClusterObject();
        EditorObject editorObject = new EditorObject(new ComposeEditorInput(
                () -> {
                    LoadClusterRewriteTailStatusInput.StatusInput status =
                            clusterObject.loadClusterRewriteTailStatus(new LoadClusterRewriteTailStatusInput());
                    return new ComposeEditorInput.StatusSnapshot(
                            status.roomCount(),
                            status.roomLevelCount(),
                            status.roomNarrationCount(),
                            status.errorMessage());
                }));
        this.views = new ViewsInput(
                editorObject.views(new features.world.dungeonclean.editor.input.ViewsInput(null)).dungeonEditorView());
    }

    public ViewsInput views(ViewsInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return views;
    }
}
