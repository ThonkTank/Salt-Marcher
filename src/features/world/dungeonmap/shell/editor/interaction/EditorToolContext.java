package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.shell.interaction.DungeonHitResult;
import features.world.dungeonmap.state.EditorInteractionState;

public record EditorToolContext(
        DungeonCanvasPointerEvent event,
        DungeonLayout projectedLayout,
        DungeonEditorHitService hitService,
        DungeonCanvasCamera camera,
        EditorInteractionState state,
        DungeonHitResult hitResult
) {
    public EditorToolContext {
        projectedLayout = projectedLayout == null ? DungeonLayout.empty() : projectedLayout;
    }
}
