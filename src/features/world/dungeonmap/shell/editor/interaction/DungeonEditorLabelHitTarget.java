package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;

import java.util.Objects;

public record DungeonEditorLabelHitTarget(
        InteractiveLabelHandle handle,
        DungeonEditorTargetRef targetRef,
        long priority
) implements DungeonEditorHitTarget {

    public DungeonEditorLabelHitTarget {
        handle = Objects.requireNonNull(handle, "handle");
        targetRef = Objects.requireNonNull(targetRef, "targetRef");
    }

    @Override
    public String targetKey() {
        return handle.key();
    }
}
