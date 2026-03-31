package features.world.dungeonmap.shell.interaction;

import java.util.Objects;

public record DungeonSelectionDecision(
        DungeonSelection selection,
        boolean dispatchToTool,
        boolean beginDrag
) {

    public DungeonSelectionDecision {
        selection = Objects.requireNonNull(selection, "selection");
    }
}
