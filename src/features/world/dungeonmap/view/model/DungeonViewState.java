package features.world.dungeonmap.view.model;
import features.world.dungeonmap.layout.model.DungeonLayout;

import features.world.dungeonmap.view.model.DungeonRuntimeLocation;
import features.world.dungeonmap.view.model.DungeonSelection;

public record DungeonViewState(DungeonLayout layout, DungeonSelection selectedTarget, DungeonRuntimeLocation activeLocation) {}
