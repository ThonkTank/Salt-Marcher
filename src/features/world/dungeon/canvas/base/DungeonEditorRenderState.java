package features.world.dungeon.canvas.base;

import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.state.EditorHover;
import features.world.dungeon.state.EditorPreview;

public record DungeonEditorRenderState(
        DungeonSelectionRef selectedRef,
        EditorHover hovered,
        EditorPreview preview
) {
    public static DungeonEditorRenderState empty() {
        return new DungeonEditorRenderState(null, null, null);
    }
}
