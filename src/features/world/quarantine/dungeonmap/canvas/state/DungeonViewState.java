package features.world.quarantine.dungeonmap.canvas.state;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLocation;

public record DungeonViewState(DungeonLayout layout, DungeonSelection selectedTarget, DungeonRuntimeLocation activeLocation) {

    public static DungeonViewState editor(DungeonLayout layout, DungeonSelection selection) {
        return new DungeonViewState(layout, selection, null);
    }
}
