package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.state.EditorHover;
import features.world.dungeonmap.state.EditorPreview;

public record DungeonEditorRenderState(
        DungeonSelectionRef selectedRef,
        EditorHover hovered,
        EditorPreview preview
) {
    public static DungeonEditorRenderState empty() {
        return new DungeonEditorRenderState(null, null, null);
    }
}
