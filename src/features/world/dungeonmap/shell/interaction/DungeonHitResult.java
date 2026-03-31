package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.shell.editor.interaction.DungeonEditorHitTarget;

public record DungeonHitResult(
        DungeonEditorHitTarget editorTarget,
        DungeonHitService.DungeonHitTarget coarseTarget
) {
    public boolean hasEditorTarget() {
        return editorTarget != null;
    }
}
