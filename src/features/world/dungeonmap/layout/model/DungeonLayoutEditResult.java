package features.world.dungeonmap.layout.model;

import features.world.dungeonmap.view.model.DungeonSelection;

public record DungeonLayoutEditResult(
        DungeonLayout layout,
        DungeonSelection focusSelection
) {
}
