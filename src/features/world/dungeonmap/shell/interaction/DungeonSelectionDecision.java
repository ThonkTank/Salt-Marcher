package features.world.dungeonmap.shell.interaction;

import java.util.Objects;

public record DungeonSelectionDecision(
        DungeonHitSnapshot snapshot,
        boolean dispatchToTool,
        boolean beginDrag
) {

    public DungeonSelectionDecision {
        snapshot = Objects.requireNonNull(snapshot, "snapshot");
    }
}
