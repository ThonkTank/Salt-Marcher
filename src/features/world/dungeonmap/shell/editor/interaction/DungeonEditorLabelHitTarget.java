package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;

import java.util.Objects;

public record DungeonEditorLabelHitTarget(
        InteractiveLabelHandle handle,
        Long clusterId,
        long priority
) implements DungeonEditorHitTarget {

    public DungeonEditorLabelHitTarget {
        handle = Objects.requireNonNull(handle, "handle");
        clusterId = Objects.requireNonNull(clusterId, "clusterId");
    }

    @Override
    public String targetKey() {
        return handle.key();
    }
}
